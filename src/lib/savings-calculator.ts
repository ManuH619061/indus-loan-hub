import { generateAmortizationSchedule, AmortizationRow } from './emi-calculator';

export interface SavingsScenario {
  scenarioName: string;
  extraMonthlyPayment: number;
  newTenureMonths: number;
  totalInterestPaid: number;
  interestSaved: number;
  tenureReduced: number;
  totalAmountPaid: number;
}

/**
 * Calculate savings from making extra monthly payments
 */
export function calculateExtraPaymentSavings(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  extraMonthlyPayment: number,
  rateType: 'REDUCING' | 'FLAT' = 'REDUCING'
): SavingsScenario {
  // Generate baseline schedule without extra payments
  const baseSchedule = generateAmortizationSchedule(
    principal,
    annualRate,
    tenureMonths,
    new Date(),
    5,
    rateType
  );
  
  const baseInterest = baseSchedule.reduce((sum, row) => sum + row.interestComponent, 0);
  const baseTotal = principal + baseInterest;

  // Calculate with extra payments
  let outstanding = principal;
  let newTenure = 0;
  let totalInterest = 0;
  const monthlyRate = annualRate / 12 / 100;
  
  const schedule = generateAmortizationSchedule(
    principal,
    annualRate,
    tenureMonths,
    new Date(),
    5,
    rateType
  );
  
  const regularEMI = schedule[0].scheduledEmi;

  for (let month = 0; month < tenureMonths && outstanding > 0; month++) {
    const interest = outstanding * monthlyRate;
    totalInterest += interest;
    
    const principalPayment = Math.min(
      regularEMI - interest + extraMonthlyPayment,
      outstanding
    );
    
    outstanding -= principalPayment;
    newTenure++;
    
    if (outstanding <= 0) break;
  }

  const interestSaved = baseInterest - totalInterest;
  const tenureReduced = tenureMonths - newTenure;
  const totalPaid = principal + totalInterest;

  return {
    scenarioName: `₹${extraMonthlyPayment.toLocaleString('en-IN')} extra/month`,
    extraMonthlyPayment,
    newTenureMonths: newTenure,
    totalInterestPaid: Math.round(totalInterest),
    interestSaved: Math.round(interestSaved),
    tenureReduced,
    totalAmountPaid: Math.round(totalPaid),
  };
}

/**
 * Generate multiple scenarios for comparison
 */
export function generateComparisonScenarios(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  rateType: 'REDUCING' | 'FLAT' = 'REDUCING'
): SavingsScenario[] {
  const scenarios: SavingsScenario[] = [];
  
  // Baseline (no extra payment)
  scenarios.push(calculateExtraPaymentSavings(principal, annualRate, tenureMonths, 0, rateType));
  
  // Various extra payment amounts
  const extraPayments = [1000, 2500, 5000, 10000, 15000];
  
  extraPayments.forEach(extra => {
    scenarios.push(calculateExtraPaymentSavings(principal, annualRate, tenureMonths, extra, rateType));
  });

  return scenarios;
}

/**
 * Calculate one-time prepayment impact
 */
export function calculateLumpSumPrepayment(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  lumpSumAmount: number,
  rateType: 'REDUCING' | 'FLAT' = 'REDUCING'
): SavingsScenario {
  const newPrincipal = Math.max(0, principal - lumpSumAmount);
  
  const baseSchedule = generateAmortizationSchedule(
    principal,
    annualRate,
    tenureMonths,
    new Date(),
    5,
    rateType
  );
  
  const newSchedule = generateAmortizationSchedule(
    newPrincipal,
    annualRate,
    tenureMonths,
    new Date(),
    5,
    rateType
  );

  const baseInterest = baseSchedule.reduce((sum, row) => sum + row.interestComponent, 0);
  const newInterest = newSchedule.reduce((sum, row) => sum + row.interestComponent, 0);

  return {
    scenarioName: `₹${lumpSumAmount.toLocaleString('en-IN')} lump sum`,
    extraMonthlyPayment: 0,
    newTenureMonths: tenureMonths,
    totalInterestPaid: Math.round(newInterest),
    interestSaved: Math.round(baseInterest - newInterest),
    tenureReduced: 0,
    totalAmountPaid: Math.round(newPrincipal + newInterest),
  };
}
