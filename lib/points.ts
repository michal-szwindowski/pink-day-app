import type { Tables } from '@/lib/supabase/types'

export function getPointBalance(transactions: Array<Pick<Tables<'point_transactions'>, 'amount'>>) {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
}

export function formatPoints(value: number) {
  return `${value} pkt`
}

export function canAffordReward(balance: number, cost: number) {
  return balance >= cost
}
