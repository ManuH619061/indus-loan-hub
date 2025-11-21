import { calculateReducingEMI, calculateFlatEMI, calculateMonthlyInterest } from "./emi-calculator";

export interface LoanForOptimization {
  id: string;
  loan_name: string;
  outstanding: number;
  interest_rate_apy: number;
  emi_amount: number;
  rate_type: 'REDUCING' | 'FLAT';
  tenure_months: number;
}

export interface PayoffScheduleMonth {
  month: number;
  date: string;
  loans: {
    loanId: string;
    loanName: string;
    payment: number;
    interestPaid: number;
    principalPaid: number;
    remainingBalance: number;
  }[];
  totalPayment: number;
  totalInterest: number;
  remainingDebt: number;
}

export interface PayoffStrategy {
  name: string;
  description: string;
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  monthlySchedule: PayoffScheduleMonth[];
  debtFreeDate: string;
}

/**
 * Calculate debt snowball strategy (smallest balance first)
 */
export function calculateSnowball(
  loans: LoanForOptimization[],
  extraMonthlyPayment: number
): PayoffStrategy {
  // Sort by outstanding balance (smallest first)
  const sortedLoans = [...loans].sort((a, b) => a.outstanding - b.outstanding);
  return simulatePayoffStrategy(sortedLoans, extraMonthlyPayment, 'Debt Snowball');
}

/**
 * Calculate debt avalanche strategy (highest interest rate first)
 */
export function calculateAvalanche(
  loans: LoanForOptimization[],
  extraMonthlyPayment: number
): PayoffStrategy {
  // Sort by interest rate (highest first)
  const sortedLoans = [...loans].sort((a, b) => b.interest_rate_apy - a.interest_rate_apy);
  return simulatePayoffStrategy(sortedLoans, extraMonthlyPayment, 'Debt Avalanche');
}

/**
 * Calculate custom strategy with user-defined priority order
 */
export function calculateCustomStrategy(
  loans: LoanForOptimization[],
  extraMonthlyPayment: number,
  priorityOrder: string[]
): PayoffStrategy {
  const sortedLoans = priorityOrder
    .map(id => loans.find(l => l.id === id))
    .filter(Boolean) as LoanForOptimization[];
  
  return simulatePayoffStrategy(sortedLoans, extraMonthlyPayment, 'Custom Strategy');
}

/**
 * Core simulation logic for any payoff strategy
 */
function simulatePayoffStrategy(
  loansInPriorityOrder: LoanForOptimization[],
  extraMonthlyPayment: number,
  strategyName: string
): PayoffStrategy {
  const schedule: PayoffScheduleMonth[] = [];
  let month = 0;
  const startDate = new Date();
  
  // Clone loans with remaining balance tracking
  const loanBalances = loansInPriorityOrder.map(loan => ({
    ...loan,
    remainingBalance: loan.outstanding,
    isPaidOff: false,
  }));

  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;

  // Simulate month by month until all loans are paid off
  while (loanBalances.some(l => !l.isPaidOff) && month < 600) { // Max 50 years safety limit
    month++;
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + month);

    const monthData: PayoffScheduleMonth = {
      month,
      date: currentDate.toISOString().split('T')[0],
      loans: [],
      totalPayment: 0,
      totalInterest: 0,
      remainingDebt: 0,
    };

    let remainingExtraPayment = extraMonthlyPayment;

    // Pay minimum EMI on all active loans first
    for (const loan of loanBalances) {
      if (loan.isPaidOff) {
        monthData.loans.push({
          loanId: loan.id,
          loanName: loan.loan_name,
          payment: 0,
          interestPaid: 0,
          principalPaid: 0,
          remainingBalance: 0,
        });
        continue;
      }

      const monthlyInterest = calculateMonthlyInterest(loan.remainingBalance, loan.interest_rate_apy);
      const emiPayment = Math.min(loan.emi_amount, loan.remainingBalance + monthlyInterest);
      const principalPayment = Math.max(0, emiPayment - monthlyInterest);

      loan.remainingBalance -= principalPayment;
      totalInterestPaid += monthlyInterest;
      totalPrincipalPaid += principalPayment;

      if (loan.remainingBalance <= 0.01) {
        loan.remainingBalance = 0;
        loan.isPaidOff = true;
      }

      monthData.loans.push({
        loanId: loan.id,
        loanName: loan.loan_name,
        payment: emiPayment,
        interestPaid: monthlyInterest,
        principalPaid: principalPayment,
        remainingBalance: loan.remainingBalance,
      });

      monthData.totalPayment += emiPayment;
      monthData.totalInterest += monthlyInterest;
    }

    // Apply extra payment to priority loan (first unpaid loan in priority order)
    for (const loan of loanBalances) {
      if (!loan.isPaidOff && remainingExtraPayment > 0) {
        const extraApplied = Math.min(remainingExtraPayment, loan.remainingBalance);
        loan.remainingBalance -= extraApplied;
        totalPrincipalPaid += extraApplied;

        // Update the loan data in monthData
        const loanData = monthData.loans.find(l => l.loanId === loan.id);
        if (loanData) {
          loanData.payment += extraApplied;
          loanData.principalPaid += extraApplied;
          loanData.remainingBalance = loan.remainingBalance;
        }

        monthData.totalPayment += extraApplied;
        remainingExtraPayment -= extraApplied;

        if (loan.remainingBalance <= 0.01) {
          loan.remainingBalance = 0;
          loan.isPaidOff = true;
        }

        // Focus on one loan at a time
        break;
      }
    }

    monthData.remainingDebt = loanBalances.reduce((sum, l) => sum + l.remainingBalance, 0);
    schedule.push(monthData);

    // Stop if all loans are paid off
    if (loanBalances.every(l => l.isPaidOff)) {
      break;
    }
  }

  const debtFreeDate = schedule[schedule.length - 1]?.date || 'N/A';
  const totalAmountPaid = totalInterestPaid + totalPrincipalPaid;

  return {
    name: strategyName,
    description: getStrategyDescription(strategyName),
    totalMonths: month,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    totalAmountPaid: Math.round(totalAmountPaid * 100) / 100,
    monthlySchedule: schedule,
    debtFreeDate,
  };
}

function getStrategyDescription(strategyName: string): string {
  switch (strategyName) {
    case 'Debt Snowball':
      return 'Pay off smallest balances first for psychological wins and momentum';
    case 'Debt Avalanche':
      return 'Pay off highest interest rates first to minimize total interest paid';
    case 'Custom Strategy':
      return 'Pay off loans in your preferred order';
    default:
      return 'Optimized debt payoff strategy';
  }
}

/**
 * Compare multiple strategies and return insights
 */
export function compareStrategies(
  loans: LoanForOptimization[],
  extraMonthlyPayment: number
): {
  snowball: PayoffStrategy;
  avalanche: PayoffStrategy;
  minPaymentOnly: PayoffStrategy;
  insights: {
    bestForSavings: string;
    bestForSpeed: string;
    savingsDifference: number;
    timeDifference: number;
  };
} {
  const snowball = calculateSnowball(loans, extraMonthlyPayment);
  const avalanche = calculateAvalanche(loans, extraMonthlyPayment);
  const minPaymentOnly = simulatePayoffStrategy(loans, 0, 'Minimum Payment Only');

  const bestForSavings = snowball.totalInterestPaid < avalanche.totalInterestPaid ? 'Snowball' : 'Avalanche';
  const bestForSpeed = snowball.totalMonths < avalanche.totalMonths ? 'Snowball' : 'Avalanche';
  const savingsDifference = Math.abs(snowball.totalInterestPaid - avalanche.totalInterestPaid);
  const timeDifference = Math.abs(snowball.totalMonths - avalanche.totalMonths);

  return {
    snowball,
    avalanche,
    minPaymentOnly,
    insights: {
      bestForSavings,
      bestForSpeed,
      savingsDifference: Math.round(savingsDifference * 100) / 100,
      timeDifference,
    },
  };
}
