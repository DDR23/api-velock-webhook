export const withdrawsSelectedFields = {
  id: true,
  transactionId: true,
  amount: true,
  method: true,
  date: true,
  currency: true,
  playerId: false,
  player: {
    select: {
      id: true,
      externalId: true,
      tenantId: true,
      name: true,
      email: true,
    },
  },
  createdAt: true,
  updatedAt: true
}
