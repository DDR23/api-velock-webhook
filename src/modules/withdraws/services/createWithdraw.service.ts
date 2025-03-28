import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WITHDRAW_SERVICE_TOKEN } from '../utils/withdrawsServiceToken';
import { IWithdrawsRepositories } from '../domain/repositories/IWithdraw.repositories';
import { IPlayersRepositories } from 'src/modules/players/domain/repositories/IPlayers.repositories';
import { CreateWithdrawDto } from '../domain/dto/create-withdraw.dto';
import { Withdraw } from '@prisma/client';
import { UpdatePlayerDto } from 'src/modules/players/domain/dto/update-player.dto';
import { CreateWithdrawEventDto } from '../domain/dto/create-withdraw-event.dto';
import { WithdrawsListener } from 'src/modules/socket/infra/listeners/withsraws.listener';
import { PLAYERS_SERVICE_TOKEN } from 'src/modules/players/utils/playersServiceToken';

@Injectable()
export class CreateWithdrawService {
  constructor(
    @Inject(WITHDRAW_SERVICE_TOKEN)
    private readonly withdrawsRepositories: IWithdrawsRepositories,
    @Inject(PLAYERS_SERVICE_TOKEN)
    private readonly playersRepositories: IPlayersRepositories,
    private readonly withdrawsListener: WithdrawsListener,
  ) { }

  async execute(data: CreateWithdrawEventDto): Promise<Withdraw> {
    const { data: withdrawData } = data;

    const [playerExternalIdExisting, withdrawIdExisting] = await Promise.all([
      this.playersRepositories.findPlayerByExternalId(withdrawData.userId),
      this.withdrawsRepositories.findWithdrawByTransactionId(withdrawData.id),
    ]);

    if (!playerExternalIdExisting) throw new NotFoundException('Player não existe');
    if (withdrawIdExisting) throw new BadRequestException('Esse saque já foi registrado');

    const withdrawAmountInCents = Math.round(withdrawData.amount * 100);

    const updatePlayerData: UpdatePlayerDto = {
      balance: (playerExternalIdExisting.balance ?? 0) - withdrawAmountInCents,
      lastWithdrawalDate: new Date(),
      lastWithdrawalValue: withdrawAmountInCents ?? playerExternalIdExisting.lastWithdrawalValue ?? 0,
      totalWithdrawalCount: (playerExternalIdExisting.totalWithdrawalCount ?? 0) + 1,
      totalWithdrawalValue: (playerExternalIdExisting.totalWithdrawalValue ?? 0) + withdrawAmountInCents,
    };

    await this.playersRepositories.updatePlayer(playerExternalIdExisting.id, updatePlayerData);

    const updateWithdrawData: CreateWithdrawDto = {
      transactionId: withdrawData.id,
      amount: withdrawAmountInCents,
      method: withdrawData.method,
      date: withdrawData.date,
      currency: withdrawData.currency,
      playerId: playerExternalIdExisting.id,
    };

    const createdWithdraw = await this.withdrawsRepositories.createWithdraw(updateWithdrawData);

    const updatedPlayer = await this.playersRepositories.findPlayerByExternalId(withdrawData.userId);
    this.withdrawsListener.emitWithdrawCreated(createdWithdraw, updatedPlayer);

    return createdWithdraw;
  }
}
