// Currency formatting utility
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Convert USD to ILS
const convertUSDtoILS = (usdAmount: number) => {
  const rate = 3.65; // Example fixed rate, in production this should come from an API
  return Math.round(usdAmount * rate * 100) / 100;
};

// Convert ILS to USD
const convertILStoUSD = (ilsAmount: number) => {
  const rate = 3.65;
  return Math.round(ilsAmount / rate * 100) / 100;
};
