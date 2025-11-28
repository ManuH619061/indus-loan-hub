import { supabase } from "@/integrations/supabase/client";
import { calculateReducingEMI, calculateFlatEMI, generateAmortizationSchedule } from "./emi-calculator";

export interface LoanData {
  id?: string;
  user_id: string;
  principal_amount: number;
  interest_rate_apy: number;
  tenure_months: number;
  disbursed_on: string;
  due_day: number;
  rate_type: 'REDUCING' | 'FLAT';
  emi_amount?: number;
}

/**
 * Calculate EMI based on loan parameters
 */
export function calculateLoanEMI(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  rateType: 'REDUCING' | 'FLAT'
): number {
  if (rateType === 'REDUCING') {
    return calculateReducingEMI(principal, annualRate, tenureMonths);
  } else {
    return calculateFlatEMI(principal, annualRate, tenureMonths);
  }
}

/**
 * Generate amortization rows for a loan
 */
export function generateLoanAmortization(loan: LoanData) {
  const dueDay = loan.due_day || new Date(loan.disbursed_on).getDate();
  const emi = loan.emi_amount || calculateLoanEMI(
    loan.principal_amount,
    loan.interest_rate_apy,
    loan.tenure_months,
    loan.rate_type
  );

  const schedule = generateAmortizationSchedule(
    loan.principal_amount,
    loan.interest_rate_apy,
    loan.tenure_months,
    new Date(loan.disbursed_on),
    dueDay,
    loan.rate_type
  );

  return schedule.map(row => ({
    loan_id: loan.id,
    period_no: row.periodNo,
    period_start: row.periodStart.toISOString().split('T')[0],
    due_on: row.dueOn.toISOString().split('T')[0],
    opening_principal: row.openingPrincipal,
    scheduled_emi: emi,
    interest_component: row.interestComponent,
    principal_component: row.principalComponent,
    extra_payment: 0,
    closing_principal: row.closingPrincipal,
    is_paid: false,
  }));
}

/**
 * Recalculate and update amortization schedule for a loan
 */
export async function recalculateAmortization(loanId: string, loanData: LoanData): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete existing amortization rows
    const { error: deleteError } = await supabase
      .from("amortization_rows")
      .delete()
      .eq("loan_id", loanId);

    if (deleteError) throw deleteError;

    // Generate new amortization schedule
    const newSchedule = generateLoanAmortization({ ...loanData, id: loanId });

    // Insert new amortization rows
    const { error: insertError } = await supabase
      .from("amortization_rows")
      .insert(newSchedule);

    if (insertError) throw insertError;

    return { success: true };
  } catch (error: any) {
    console.error("Error recalculating amortization:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update loan and recalculate all related data
 */
export async function updateLoanWithRecalculation(
  loanId: string,
  updates: Partial<LoanData> & { [key: string]: any },
  originalLoan: LoanData
): Promise<{ success: boolean; emi?: number; error?: string }> {
  try {
    // Merge updates with original data
    const updatedLoan: LoanData = {
      ...originalLoan,
      ...updates,
      id: loanId,
    };

    // Recalculate EMI if core fields changed
    const coreFieldsChanged = 
      updates.principal_amount !== undefined ||
      updates.interest_rate_apy !== undefined ||
      updates.tenure_months !== undefined ||
      updates.rate_type !== undefined;

    let newEmi = updatedLoan.emi_amount;
    
    if (coreFieldsChanged && !updates.emi_amount) {
      newEmi = calculateLoanEMI(
        updatedLoan.principal_amount,
        updatedLoan.interest_rate_apy,
        updatedLoan.tenure_months,
        updatedLoan.rate_type
      );
    }

    // Update loan record
    const { error: updateError } = await supabase
      .from("loans")
      .update({
        ...updates,
        emi_amount: newEmi,
        updated_at: new Date().toISOString(),
      })
      .eq("id", loanId);

    if (updateError) throw updateError;

    // Recalculate amortization if schedule-affecting fields changed
    const scheduleFieldsChanged = 
      coreFieldsChanged ||
      updates.disbursed_on !== undefined ||
      updates.due_day !== undefined;

    if (scheduleFieldsChanged) {
      const result = await recalculateAmortization(loanId, {
        ...updatedLoan,
        emi_amount: newEmi,
      });
      
      if (!result.success) {
        throw new Error(result.error);
      }
    }

    return { success: true, emi: newEmi };
  } catch (error: any) {
    console.error("Error updating loan:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate required loan fields
 */
export function validateLoanFields(formData: {
  loan_name: string;
  principal_amount: string;
  tenure_months: string;
  interest_rate_apy: string;
  disbursed_on: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!formData.loan_name.trim()) {
    errors.push("Loan name is required");
  }
  
  const principal = parseFloat(formData.principal_amount);
  if (isNaN(principal) || principal <= 0) {
    errors.push("Principal amount must be greater than 0");
  }

  const tenure = parseInt(formData.tenure_months);
  if (isNaN(tenure) || tenure <= 0) {
    errors.push("Tenure must be greater than 0 months");
  }

  const rate = parseFloat(formData.interest_rate_apy);
  if (isNaN(rate) || rate < 0) {
    errors.push("Interest rate must be 0 or greater");
  }

  if (!formData.disbursed_on) {
    errors.push("Disbursement date is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Delete loan and all related data (cascades via FK)
 */
export async function deleteLoan(loanId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Delete amortization rows first (in case FK cascade isn't set up)
    await supabase.from("amortization_rows").delete().eq("loan_id", loanId);
    
    // Delete payments
    await supabase.from("payments").delete().eq("loan_id", loanId);
    
    // Delete documents
    await supabase.from("documents").delete().eq("loan_id", loanId);
    
    // Delete goals
    await supabase.from("goals").delete().eq("loan_id", loanId);
    
    // Delete charges
    await supabase.from("charges").delete().eq("loan_id", loanId);
    
    // Finally delete the loan
    const { error } = await supabase.from("loans").delete().eq("id", loanId);
    
    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting loan:", error);
    return { success: false, error: error.message };
  }
}
