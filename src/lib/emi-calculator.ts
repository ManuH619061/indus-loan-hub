/**
 * Calculate EMI for reducing balance loan
 * Formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * where r = monthly interest rate (annual_rate / 12 / 100)
 */
export function calculateReducingEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number
): number {
  if (tenureMonths === 0) return 0;
  
  const monthlyRate = annualRate / 12 / 100;
  
  if (monthlyRate === 0) {
    return principal / tenureMonths;
  }
  
  const powerTerm = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * powerTerm) / (powerTerm - 1);
  
  return Math.round(emi * 100) / 100;
}

/**
 * Calculate EMI for flat rate loan
 * Formula: EMI = (P + (P * flat_rate% * (n/12))) / n
 */
export function calculateFlatEMI(
  principal: number,
  flatRate: number,
  tenureMonths: number
): number {
  if (tenureMonths === 0) return 0;
  
  const totalInterest = principal * (flatRate / 100) * (tenureMonths / 12);
  const emi = (principal + totalInterest) / tenureMonths;
  
  return Math.round(emi * 100) / 100;
}

/**
 * Calculate interest component for a specific month in reducing balance
 */
export function calculateMonthlyInterest(
  outstandingPrincipal: number,
  annualRate: number
): number {
  const monthlyRate = annualRate / 12 / 100;
  return Math.round(outstandingPrincipal * monthlyRate * 100) / 100;
}

/**
 * Generate complete amortization schedule
 */
export interface AmortizationRow {
  periodNo: number;
  periodStart: Date;
  dueOn: Date;
  openingPrincipal: number;
  scheduledEmi: number;
  interestComponent: number;
  principalComponent: number;
  extraPayment: number;
  closingPrincipal: number;
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  disbursedOn: Date,
  dueDay: number,
  rateType: 'REDUCING' | 'FLAT' = 'REDUCING'
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  
  const emi = rateType === 'REDUCING' 
    ? calculateReducingEMI(principal, annualRate, tenureMonths)
    : calculateFlatEMI(principal, annualRate, tenureMonths);
  
  let outstanding = principal;
  let currentDate = new Date(disbursedOn);
  
  for (let period = 1; period <= tenureMonths; period++) {
    // Calculate due date
    currentDate.setMonth(currentDate.getMonth() + 1);
    const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dueDay);
    
    let interestComponent: number;
    let principalComponent: number;
    
    if (rateType === 'REDUCING') {
      interestComponent = calculateMonthlyInterest(outstanding, annualRate);
      principalComponent = emi - interestComponent;
    } else {
      // For flat rate, distribute evenly
      const totalInterest = principal * (annualRate / 100) * (tenureMonths / 12);
      interestComponent = totalInterest / tenureMonths;
      principalComponent = principal / tenureMonths;
    }
    
    // Handle final period rounding
    if (period === tenureMonths) {
      principalComponent = outstanding;
    }
    
    const closingPrincipal = Math.max(0, outstanding - principalComponent);
    
    schedule.push({
      periodNo: period,
      periodStart: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      dueOn: dueDate,
      openingPrincipal: outstanding,
      scheduledEmi: emi,
      interestComponent: Math.round(interestComponent * 100) / 100,
      principalComponent: Math.round(principalComponent * 100) / 100,
      extraPayment: 0,
      closingPrincipal: Math.round(closingPrincipal * 100) / 100,
    });
    
    outstanding = closingPrincipal;
  }
  
  return schedule;
}

/**
 * Calculate total interest paid over loan tenure
 */
export function calculateTotalInterest(
  principal: number,
  emi: number,
  tenureMonths: number
): number {
  return Math.round((emi * tenureMonths - principal) * 100) / 100;
}

/**
 * Calculate effective annual rate (XIRR) considering all fees
 */
export function calculateEffectiveRate(
  principal: number,
  emi: number,
  tenureMonths: number,
  upfrontFees: number
): number {
  // Simplified approximation
  const totalPaid = emi * tenureMonths;
  const totalCost = totalPaid + upfrontFees;
  const effectiveInterest = totalCost - principal;
  const effectiveRate = (effectiveInterest / principal) / (tenureMonths / 12) * 100;
  
  return Math.round(effectiveRate * 100) / 100;
}
