export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatINRDetailed(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(num: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num);
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${formatNumber(value, decimals)}%`;
}

// Format currency with custom symbol and format
export function formatCurrency(
  amount: number, 
  currencySymbol: string = '₹', 
  numberFormat: string = 'indian'
): string {
  const locale = numberFormat === 'indian' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.abs(amount));
  
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currencySymbol}${formatted}`;
}

export function formatCurrencyDetailed(
  amount: number, 
  currencySymbol: string = '₹', 
  numberFormat: string = 'indian'
): string {
  const locale = numberFormat === 'indian' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(Math.abs(amount));
  
  const sign = amount < 0 ? '-' : '';
  return `${sign}${currencySymbol}${formatted}`;
}
