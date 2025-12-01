import { generateAmortizationSchedule } from "./emi-calculator";

export interface LoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  paid_on: string;
  payment_type: string;
  reference?: string | null;
}

export interface LoanWithSchedule {
  id: string;
  principal_amount: number;
  interest_rate_apy: number;
  tenure_months: number;
  disbursed_on: string;
  due_day?: number | null;
  rate_type: 'REDUCING' | 'FLAT';
  emi_amount?: number | null;
}

export interface LoanStats {
  emisPaid: number;
  emisPending: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingTotal: number; // Principal + Interest remaining
  totalEMIs: number;
}

/**
 * Parse principal and interest from payment reference string
 * Format: "Period X - Principal: ₹XX,XXX, Interest: ₹X,XXX"
 */
function parsePaymentComponents(payment: LoanPayment): { principal: number; interest: number } {
  if (payment.reference) {
    const principalMatch = payment.reference.match(/Principal:\s*₹?([\d,]+(?:\.\d+)?)/i);
    const interestMatch = payment.reference.match(/Interest:\s*₹?([\d,]+(?:\.\d+)?)/i);
    
    if (principalMatch && interestMatch) {
      const principal = parseFloat(principalMatch[1].replace(/,/g, ''));
      const interest = parseFloat(interestMatch[1].replace(/,/g, ''));
      return { principal, interest };
    }
  }
  
  // Fallback: if no breakdown in reference, return 0 for both
  // The caller should use the amortization schedule for calculation
  return { principal: 0, interest: 0 };
}

/**
 * Calculate loan statistics based on actual payment records
 * This is the source of truth for outstanding and EMIs pending
 * Outstanding = remaining principal + remaining interest (sum of future EMI components)
 */
export function calculateLoanStatsFromPayments(
  loan: LoanWithSchedule,
  payments: LoanPayment[]
): LoanStats {
  const totalEMIs = loan.tenure_months;
  
  // Generate the amortization schedule for this loan
  const dueDay = loan.due_day || new Date(loan.disbursed_on).getDate();
  const schedule = generateAmortizationSchedule(
    loan.principal_amount,
    loan.interest_rate_apy,
    loan.tenure_months,
    new Date(loan.disbursed_on),
    dueDay,
    loan.rate_type
  );
  
  // Filter EMI payments only (not fees, late fees, etc.)
  // EMIs Paid = COUNT of payment records
  const emiPayments = payments.filter(p => p.payment_type === 'EMI');
  const emisPaid = emiPayments.length;
  
  // Pending EMIs = Tenure - EMIs Paid (strictly based on payment count)
  const emisPending = Math.max(totalEMIs - emisPaid, 0);
  
  // Calculate total principal and interest paid from EMI payments
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  
  // Try to get breakdown from payment references first
  let hasReferenceData = false;
  emiPayments.forEach(payment => {
    const { principal, interest } = parsePaymentComponents(payment);
    if (principal > 0 || interest > 0) {
      totalPrincipalPaid += principal;
      totalInterestPaid += interest;
      hasReferenceData = true;
    }
  });
  
  // If we couldn't get from references, calculate from schedule
  if (!hasReferenceData && emisPaid > 0) {
    // Use the first N rows from the schedule where N = emisPaid
    const paidScheduleRows = schedule.slice(0, Math.min(emisPaid, schedule.length));
    totalPrincipalPaid = paidScheduleRows.reduce((sum, row) => sum + row.principalComponent, 0);
    totalInterestPaid = paidScheduleRows.reduce((sum, row) => sum + row.interestComponent, 0);
  }
  
  // Calculate outstanding from FUTURE EMI components (remaining schedule rows)
  // Outstanding = sum of all future EMI principal + interest components
  const remainingScheduleRows = schedule.slice(Math.min(emisPaid, schedule.length));
  const outstandingPrincipal = remainingScheduleRows.reduce((sum, row) => sum + row.principalComponent, 0);
  const outstandingInterest = remainingScheduleRows.reduce((sum, row) => sum + row.interestComponent, 0);
  const outstandingTotal = outstandingPrincipal + outstandingInterest;
  
  // Handle when all EMIs are paid
  if (emisPaid >= totalEMIs) {
    return {
      emisPaid,
      emisPending: 0,
      totalPrincipalPaid: Math.round(loan.principal_amount * 100) / 100,
      totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
      outstandingPrincipal: 0,
      outstandingInterest: 0,
      outstandingTotal: 0,
      totalEMIs,
    };
  }
  
  return {
    emisPaid,
    emisPending,
    totalPrincipalPaid: Math.round(totalPrincipalPaid * 100) / 100,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    outstandingPrincipal: Math.round(outstandingPrincipal * 100) / 100,
    outstandingInterest: Math.round(outstandingInterest * 100) / 100,
    outstandingTotal: Math.round(outstandingTotal * 100) / 100,
    totalEMIs,
  };
}

/**
 * Calculate aggregate stats across multiple loans
 * Outstanding = sum of remaining principal + interest (future EMI components)
 */
export function calculatePortfolioStats(
  loans: LoanWithSchedule[],
  paymentsByLoan: Map<string, LoanPayment[]>
): {
  totalOutstanding: number;
  totalOutstandingPrincipal: number;
  totalOutstandingInterest: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalEmisPaid: number;
  totalEmisPending: number;
} {
  let totalOutstanding = 0;
  let totalOutstandingPrincipal = 0;
  let totalOutstandingInterest = 0;
  let totalPrincipalPaid = 0;
  let totalInterestPaid = 0;
  let totalEmisPaid = 0;
  let totalEmisPending = 0;
  
  loans.forEach(loan => {
    const payments = paymentsByLoan.get(loan.id) || [];
    const stats = calculateLoanStatsFromPayments(loan, payments);
    
    // Use outstandingTotal (principal + interest) for total outstanding
    totalOutstanding += stats.outstandingTotal;
    totalOutstandingPrincipal += stats.outstandingPrincipal;
    totalOutstandingInterest += stats.outstandingInterest;
    totalPrincipalPaid += stats.totalPrincipalPaid;
    totalInterestPaid += stats.totalInterestPaid;
    totalEmisPaid += stats.emisPaid;
    totalEmisPending += stats.emisPending;
  });
  
  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalOutstandingPrincipal: Math.round(totalOutstandingPrincipal * 100) / 100,
    totalOutstandingInterest: Math.round(totalOutstandingInterest * 100) / 100,
    totalPrincipalPaid: Math.round(totalPrincipalPaid * 100) / 100,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    totalEmisPaid,
    totalEmisPending,
  };
}

/**
 * Sync amortization rows is_paid status based on payment records
 * Call this after deleting a payment to keep amortization in sync
 */
export async function syncAmortizationWithPayments(
  loanId: string,
  payments: LoanPayment[],
  supabase: any
): Promise<void> {
  const emiPayments = payments.filter(p => p.payment_type === 'EMI');
  const emisPaid = emiPayments.length;
  
  // Get all amortization rows for this loan
  const { data: rows, error } = await supabase
    .from('amortization_rows')
    .select('id, period_no')
    .eq('loan_id', loanId)
    .order('period_no', { ascending: true });
  
  if (error || !rows) {
    console.error('Error fetching amortization rows:', error);
    return;
  }
  
  // Mark first N rows as paid, rest as unpaid
  const paidRowIds = rows.slice(0, emisPaid).map((r: any) => r.id);
  const unpaidRowIds = rows.slice(emisPaid).map((r: any) => r.id);
  
  if (paidRowIds.length > 0) {
    await supabase
      .from('amortization_rows')
      .update({ is_paid: true })
      .in('id', paidRowIds);
  }
  
  if (unpaidRowIds.length > 0) {
    await supabase
      .from('amortization_rows')
      .update({ is_paid: false })
      .in('id', unpaidRowIds);
  }
}
