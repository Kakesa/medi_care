export type BillingCurrency = 'EUR' | 'CDF' | 'USD';

export function formatMoney(amount: number, currency: BillingCurrency | string = 'EUR') {
  const code = currency === 'CDF' || currency === 'USD' || currency === 'EUR' ? currency : 'EUR';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(amount);
}

export function formatBalances(
  rows: Array<{ currency: string; income: number; expense: number; balance: number }> | undefined,
  fallbackCurrency: string,
  kind: 'income' | 'expense' | 'balance',
) {
  const list = rows?.length ? rows : [{ currency: fallbackCurrency, income: 0, expense: 0, balance: 0 }];
  const parts = list.filter((row) => (kind === 'balance' ? row.income !== 0 || row.expense !== 0 : row[kind] !== 0));
  const chosen = parts.length ? parts : [list[0]];
  return chosen.map((row) => formatMoney(row[kind], row.currency)).join(' + ');
}
