import { addMonths, format, startOfMonth, isBefore, isAfter } from 'date-fns';

export interface LoanPayment {
  loanId: string;
  loanName: string;
  lenderName: string;
  dueDate: Date;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  outstandingBalance: number;
}

export interface MonthlyForecast {
  month: string;
  monthDate: Date;
  totalPayments: number;
  loanPayments: LoanPayment[];
  loanCount: number;
  totalPrincipal: number;
  totalInterest: number;
}

export interface LoanData {
  id: string;
  loan_name: string;
  emi_amount: number;
  due_day: number;
  status: string;
  lender?: {
    name: string;
  };
  amortization_rows: Array<{
    due_on: string;
    scheduled_emi: number;
    principal_component: number;
    interest_component: number;
    closing_principal: number;
    is_paid: boolean;
  }>;
}

/**
 * Generate payment forecast for the next N months
 */
export function generatePaymentForecast(
  loans: LoanData[],
  monthsAhead: number = 12
): MonthlyForecast[] {
  const forecasts: MonthlyForecast[] = [];
  const today = new Date();
  
  // Generate forecasts for each month
  for (let i = 0; i < monthsAhead; i++) {
    const monthDate = startOfMonth(addMonths(today, i));
    const monthStr = format(monthDate, 'MMM yyyy');
    
    const loanPayments: LoanPayment[] = [];
    
    // Get payments for each active loan in this month
    loans.forEach(loan => {
      if (loan.status !== 'ACTIVE') return;
      
      // Find unpaid amortization rows for this month
      const monthPayments = loan.amortization_rows.filter(row => {
        const dueDate = new Date(row.due_on);
        const rowMonth = startOfMonth(dueDate);
        return !row.is_paid && 
               rowMonth.getTime() === monthDate.getTime() &&
               isAfter(dueDate, today);
      });
      
      monthPayments.forEach(payment => {
        loanPayments.push({
          loanId: loan.id,
          loanName: loan.loan_name,
          lenderName: loan.lender?.name || 'Unknown',
          dueDate: new Date(payment.due_on),
          emiAmount: payment.scheduled_emi,
          principalComponent: payment.principal_component,
          interestComponent: payment.interest_component,
          outstandingBalance: payment.closing_principal,
        });
      });
    });
    
    // Sort payments by due date
    loanPayments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    
    const totalPayments = loanPayments.reduce((sum, p) => sum + p.emiAmount, 0);
    const totalPrincipal = loanPayments.reduce((sum, p) => sum + p.principalComponent, 0);
    const totalInterest = loanPayments.reduce((sum, p) => sum + p.interestComponent, 0);
    
    forecasts.push({
      month: monthStr,
      monthDate,
      totalPayments,
      loanPayments,
      loanCount: loanPayments.length,
      totalPrincipal,
      totalInterest,
    });
  }
  
  return forecasts;
}

/**
 * Calculate quarterly summaries
 */
export function calculateQuarterlySummary(forecasts: MonthlyForecast[]) {
  const quarters: { [key: string]: { total: number; count: number; months: string[] } } = {};
  
  forecasts.forEach(forecast => {
    const quarter = `Q${Math.floor(forecast.monthDate.getMonth() / 3) + 1} ${forecast.monthDate.getFullYear()}`;
    
    if (!quarters[quarter]) {
      quarters[quarter] = { total: 0, count: 0, months: [] };
    }
    
    quarters[quarter].total += forecast.totalPayments;
    quarters[quarter].count += forecast.loanCount;
    quarters[quarter].months.push(forecast.month);
  });
  
  return quarters;
}

/**
 * Get peak payment months
 */
export function getPeakPaymentMonths(forecasts: MonthlyForecast[], topN: number = 3) {
  return [...forecasts]
    .sort((a, b) => b.totalPayments - a.totalPayments)
    .slice(0, topN);
}

/**
 * Calculate average monthly payment
 */
export function calculateAverageMonthlyPayment(forecasts: MonthlyForecast[]): number {
  const total = forecasts.reduce((sum, f) => sum + f.totalPayments, 0);
  return forecasts.length > 0 ? total / forecasts.length : 0;
}

/**
 * Get loans by payment frequency
 */
export function getLoanPaymentDistribution(forecasts: MonthlyForecast[]) {
  const loanFrequency: { [loanId: string]: { name: string; count: number; total: number } } = {};
  
  forecasts.forEach(forecast => {
    forecast.loanPayments.forEach(payment => {
      if (!loanFrequency[payment.loanId]) {
        loanFrequency[payment.loanId] = {
          name: payment.loanName,
          count: 0,
          total: 0,
        };
      }
      loanFrequency[payment.loanId].count++;
      loanFrequency[payment.loanId].total += payment.emiAmount;
    });
  });
  
  return Object.entries(loanFrequency).map(([id, data]) => ({
    loanId: id,
    loanName: data.name,
    paymentCount: data.count,
    totalAmount: data.total,
    averagePayment: data.total / data.count,
  }));
}
