export type BillingCurrency = 'EUR' | 'CDF' | 'USD';

export function formatMoney(amount: number, currency: BillingCurrency | string = 'EUR') {
  const code = currency === 'CDF' || currency === 'USD' || currency === 'EUR' ? currency : 'EUR';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }).format(amount);
}
