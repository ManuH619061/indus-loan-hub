import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, addMonths, isWithinInterval, differenceInDays } from "date-fns";

export interface LoanWithAmortization {
  id: string;
  loan_name: string;
  principal_amount: number;
  interest_rate_apy: number;
  tenure_months: number;
  lender_id: string | null;
  status: string;
  lenders?: { name: string; logo_url: string | null } | null;
  amortization_rows: AmortizationRow[];
}

export interface AmortizationRow {
  id: string;
  loan_id: string;
  period_no: number;
  due_on: string;
  scheduled_emi: number;
  principal_component: number;
  interest_component: number;
  is_paid: boolean | null;
  closing_principal: number;
}

export interface PortfolioStats {
  totalOutstanding: number;
  totalOutstandingPrincipal: number;
  totalOutstandingInterest: number;
  activeLoansCount: number;
  avgInterestRate: number;
}

export interface Next30DaysEMI {
  total: number;
  count: number;
  payments: {
    loanId: string;
    loanName: string;
    lenderName: string | null;
    amount: number;
    dueDate: string;
    daysUntilDue: number;
  }[];
}

export interface MonthlyProjection {
  month: string;
  monthStart: Date;
  emi: number;
  count: number;
}

export interface LenderStats {
  lenderId: string;
  lenderName: string;
  lenderType: string;
  logoUrl: string | null;
  totalOutstanding: number;
  loanCount: number;
  avgInterest: number;
}

/**
 * Calculate total outstanding from unpaid amortization rows
 * Outstanding = sum of (principal_component + interest_component) for unpaid rows
 */
export function calculateOutstandingFromAmortization(rows: AmortizationRow[]): {
  total: number;
  principal: number;
  interest: number;
} {
  const unpaidRows = rows.filter(r => !r.is_paid);
  
  const principal = unpaidRows.reduce((sum, row) => sum + row.principal_component, 0);
  const interest = unpaidRows.reduce((sum, row) => sum + row.interest_component, 0);
  
  return {
    total: Math.round((principal + interest) * 100) / 100,
    principal: Math.round(principal * 100) / 100,
    interest: Math.round(interest * 100) / 100,
  };
}

/**
 * Calculate Next 30 Days EMI from unpaid amortization rows
 */
export function calculateNext30DaysEMI(
  loans: LoanWithAmortization[],
  today: Date = new Date()
): Next30DaysEMI {
  const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const payments: Next30DaysEMI['payments'] = [];
  let total = 0;

  loans.forEach(loan => {
    const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
    
    unpaidRows.forEach(row => {
      const dueDate = new Date(row.due_on);
      
      if (dueDate >= today && dueDate <= next30Days) {
        const daysUntilDue = differenceInDays(dueDate, today);
        total += row.scheduled_emi;
        
        payments.push({
          loanId: loan.id,
          loanName: loan.loan_name,
          lenderName: loan.lenders?.name || null,
          amount: row.scheduled_emi,
          dueDate: row.due_on,
          daysUntilDue,
        });
      }
    });
  });

  return {
    total: Math.round(total * 100) / 100,
    count: payments.length,
    payments: payments.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
  };
}

/**
 * Calculate 6-Month EMI Projection from unpaid amortization rows
 */
export function calculate6MonthProjection(
  loans: LoanWithAmortization[],
  today: Date = new Date()
): MonthlyProjection[] {
  const projections: MonthlyProjection[] = [];

  for (let i = 0; i < 6; i++) {
    const monthStart = startOfMonth(addMonths(today, i));
    const monthEnd = endOfMonth(addMonths(today, i));
    let monthTotal = 0;
    let monthCount = 0;

    loans.forEach(loan => {
      const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
      
      unpaidRows.forEach(row => {
        const dueDate = new Date(row.due_on);
        if (isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
          monthTotal += row.scheduled_emi;
          monthCount++;
        }
      });
    });

    projections.push({
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      monthStart,
      emi: Math.round(monthTotal * 100) / 100,
      count: monthCount,
    });
  }

  return projections;
}

/**
 * Calculate THIS MONTH EMI (current calendar month unpaid EMIs)
 */
export function calculateThisMonthEMI(
  loans: LoanWithAmortization[],
  today: Date = new Date()
): { total: number; count: number } {
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  let total = 0;
  let count = 0;

  loans.forEach(loan => {
    const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
    
    unpaidRows.forEach(row => {
      const dueDate = new Date(row.due_on);
      if (isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
        total += row.scheduled_emi;
        count++;
      }
    });
  });

  return {
    total: Math.round(total * 100) / 100,
    count,
  };
}

/**
 * Calculate NEXT MONTH EMI (next calendar month unpaid EMIs)
 */
export function calculateNextMonthEMI(
  loans: LoanWithAmortization[],
  today: Date = new Date()
): { total: number; count: number } {
  const nextMonth = addMonths(today, 1);
  const monthStart = startOfMonth(nextMonth);
  const monthEnd = endOfMonth(nextMonth);
  let total = 0;
  let count = 0;

  loans.forEach(loan => {
    const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
    
    unpaidRows.forEach(row => {
      const dueDate = new Date(row.due_on);
      if (isWithinInterval(dueDate, { start: monthStart, end: monthEnd })) {
        total += row.scheduled_emi;
        count++;
      }
    });
  });

  return {
    total: Math.round(total * 100) / 100,
    count,
  };
}

/**
 * Calculate Total Paid Till Date (all paid EMIs + interest)
 */
export function calculateTotalPaidToDate(loans: LoanWithAmortization[]): number {
  let totalPaid = 0;

  loans.forEach(loan => {
    const paidRows = loan.amortization_rows?.filter(r => r.is_paid) || [];
    totalPaid += paidRows.reduce((sum, row) => sum + row.scheduled_emi, 0);
  });

  return Math.round(totalPaid * 100) / 100;
}

/**
 * Calculate Weighted Average Interest Rate (weighted by remaining balance)
 */
export function calculateWeightedAvgInterest(loans: LoanWithAmortization[]): number {
  let totalWeightedRate = 0;
  let totalOutstanding = 0;

  loans.forEach(loan => {
    const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
    totalWeightedRate += loan.interest_rate_apy * outstanding.total;
    totalOutstanding += outstanding.total;
  });

  return totalOutstanding > 0 
    ? Math.round((totalWeightedRate / totalOutstanding) * 100) / 100 
    : 0;
}

/**
 * Calculate Upcoming 7 Days EMI (for alerts)
 */
export function calculateUpcoming7DaysEMI(
  loans: LoanWithAmortization[],
  today: Date = new Date()
): { total: number; count: number; payments: any[] } {
  const next7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const payments: any[] = [];
  let total = 0;

  loans.forEach(loan => {
    const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
    
    unpaidRows.forEach(row => {
      const dueDate = new Date(row.due_on);
      
      if (dueDate >= today && dueDate <= next7Days) {
        const daysUntilDue = differenceInDays(dueDate, today);
        total += row.scheduled_emi;
        
        payments.push({
          loanId: loan.id,
          loanName: loan.loan_name,
          lenderName: loan.lenders?.name || null,
          amount: row.scheduled_emi,
          dueDate: row.due_on,
          daysUntilDue,
          interestRate: loan.interest_rate_apy,
        });
      }
    });
  });

  return {
    total: Math.round(total * 100) / 100,
    count: payments.length,
    payments: payments.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
  };
}

/**
 * Calculate portfolio-wide stats from loans with amortization
 */
export function calculatePortfolioStatsFromAmortization(
  loans: LoanWithAmortization[]
): PortfolioStats {
  let totalOutstanding = 0;
  let totalOutstandingPrincipal = 0;
  let totalOutstandingInterest = 0;
  let totalInterestRate = 0;

  loans.forEach(loan => {
    const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
    totalOutstanding += outstanding.total;
    totalOutstandingPrincipal += outstanding.principal;
    totalOutstandingInterest += outstanding.interest;
    totalInterestRate += loan.interest_rate_apy;
  });

  return {
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    totalOutstandingPrincipal: Math.round(totalOutstandingPrincipal * 100) / 100,
    totalOutstandingInterest: Math.round(totalOutstandingInterest * 100) / 100,
    activeLoansCount: loans.length,
    avgInterestRate: loans.length > 0 ? totalInterestRate / loans.length : 0,
  };
}

/**
 * Calculate per-lender stats from loans with amortization
 */
export function calculateLenderStatsFromAmortization(
  loans: LoanWithAmortization[],
  lenders: { id: string; name: string; type: string; logo_url: string | null }[]
): LenderStats[] {
  const lenderStatsMap = new Map<string, LenderStats>();

  // Initialize lender stats
  lenders.forEach(lender => {
    lenderStatsMap.set(lender.id, {
      lenderId: lender.id,
      lenderName: lender.name,
      lenderType: lender.type,
      logoUrl: lender.logo_url,
      totalOutstanding: 0,
      loanCount: 0,
      avgInterest: 0,
    });
  });

  // Group loans by lender and calculate stats
  const lenderLoansMap = new Map<string, LoanWithAmortization[]>();
  
  loans.forEach(loan => {
    if (loan.lender_id) {
      const existing = lenderLoansMap.get(loan.lender_id) || [];
      existing.push(loan);
      lenderLoansMap.set(loan.lender_id, existing);
    }
  });

  // Calculate stats for each lender
  lenderLoansMap.forEach((lenderLoans, lenderId) => {
    const existing = lenderStatsMap.get(lenderId);
    if (!existing) return;

    let totalOutstanding = 0;
    let totalInterestRate = 0;

    lenderLoans.forEach(loan => {
      const outstanding = calculateOutstandingFromAmortization(loan.amortization_rows || []);
      totalOutstanding += outstanding.total;
      totalInterestRate += loan.interest_rate_apy;
    });

    lenderStatsMap.set(lenderId, {
      ...existing,
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      loanCount: lenderLoans.length,
      avgInterest: lenderLoans.length > 0 ? totalInterestRate / lenderLoans.length : 0,
    });
  });

  // Return only lenders with active loans
  return Array.from(lenderStatsMap.values()).filter(stats => stats.loanCount > 0);
}

/**
 * Fetch active loans with amortization data for the current user
 */
export async function fetchLoansWithAmortization(userId: string): Promise<LoanWithAmortization[]> {
  const { data, error } = await supabase
    .from("loans")
    .select(`
      id,
      loan_name,
      principal_amount,
      interest_rate_apy,
      tenure_months,
      lender_id,
      status,
      lenders (name, logo_url),
      amortization_rows (
        id,
        loan_id,
        period_no,
        due_on,
        scheduled_emi,
        principal_component,
        interest_component,
        is_paid,
        closing_principal
      )
    `)
    .eq("user_id", userId)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("Error fetching loans with amortization:", error);
    return [];
  }

  return (data || []) as LoanWithAmortization[];
}

/**
 * Count overdue EMIs (unpaid with due_on < today)
 */
export function countOverdueEMIs(loans: LoanWithAmortization[], today: Date = new Date()): number {
  let overdueCount = 0;

  loans.forEach(loan => {
    const unpaidRows = loan.amortization_rows?.filter(r => !r.is_paid) || [];
    unpaidRows.forEach(row => {
      const dueDate = new Date(row.due_on);
      if (dueDate < today) {
        overdueCount++;
      }
    });
  });

  return overdueCount;
}

/**
 * Calculate payoff progress (principal paid vs total principal)
 */
export function calculatePayoffProgress(loans: LoanWithAmortization[]): {
  totalPrincipal: number;
  paidPrincipal: number;
  remainingPrincipal: number;
  progressPercent: number;
} {
  let totalPrincipal = 0;
  let paidPrincipal = 0;

  loans.forEach(loan => {
    totalPrincipal += loan.principal_amount;
    
    const paidRows = loan.amortization_rows?.filter(r => r.is_paid) || [];
    paidPrincipal += paidRows.reduce((sum, row) => sum + row.principal_component, 0);
  });

  const remainingPrincipal = totalPrincipal - paidPrincipal;
  const progressPercent = totalPrincipal > 0 ? (paidPrincipal / totalPrincipal) * 100 : 0;

  return {
    totalPrincipal: Math.round(totalPrincipal * 100) / 100,
    paidPrincipal: Math.round(paidPrincipal * 100) / 100,
    remainingPrincipal: Math.round(remainingPrincipal * 100) / 100,
    progressPercent: Math.round(progressPercent * 100) / 100,
  };
}
