import type { Account } from '../types/banking';

export function totalBalanceInDop(accounts: Account[], usdToDop: number): number {
  const totalCents = accounts.reduce((sum, account) => {
    const amountInDop = account.currency === 'USD' ? account.balance * usdToDop : account.balance;
    return sum + Math.round(amountInDop * 100);
  }, 0);

  return totalCents / 100;
}
