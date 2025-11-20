import { parse } from 'date-fns';
import { bankTemplates, BankType, classificationKeywords } from './bank-templates';

export interface ParsedTransaction {
  transaction_date: string;
  value_date?: string;
  narration: string;
  reference?: string;
  debit?: number;
  credit?: number;
  balance?: number;
  category: string;
  subcategory?: string;
  is_transfer: boolean;
  is_emi: boolean;
}

export interface ParseResult {
  success: boolean;
  transactions: ParsedTransaction[];
  errors: string[];
}

export function parseAmount(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numStr = String(value).replace(/[,\s]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? undefined : num;
}

export function parseDate(dateStr: string, format: string): string | undefined {
  try {
    const parsed = parse(dateStr, format, new Date());
    if (isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString().split('T')[0];
  } catch {
    // Try common formats
    const formats = ['dd/MM/yyyy', 'dd-MM-yyyy', 'dd MMM yyyy', 'yyyy-MM-dd'];
    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }
}

export function classifyTransaction(narration: string, debit?: number, credit?: number): {
  category: string;
  subcategory?: string;
  is_transfer: boolean;
  is_emi: boolean;
} {
  const text = narration.toLowerCase();
  
  // Check for income
  if (credit && classificationKeywords.income.some(kw => text.includes(kw))) {
    return { category: 'Income', is_transfer: false, is_emi: false };
  }
  
  // Check for EMI
  if (debit && classificationKeywords.emi.some(kw => text.includes(kw))) {
    return { category: 'EMI Payment', is_transfer: false, is_emi: true };
  }
  
  // Check for credit card payment
  if (debit && classificationKeywords.creditCard.some(kw => text.includes(kw))) {
    return { category: 'Credit Card Payment', is_transfer: false, is_emi: false };
  }
  
  // Check for transfer
  if (classificationKeywords.transfer.some(kw => text.includes(kw))) {
    return { category: 'Transfer', is_transfer: true, is_emi: false };
  }
  
  // Check for fees
  if (debit && classificationKeywords.fee.some(kw => text.includes(kw))) {
    return { category: 'Fee', is_transfer: false, is_emi: false };
  }
  
  // Check for interest
  if (debit && classificationKeywords.interest.some(kw => text.includes(kw))) {
    return { category: 'Interest', is_transfer: false, is_emi: false };
  }
  
  // Classify expenses by subcategory
  if (debit) {
    for (const [subcat, keywords] of Object.entries(classificationKeywords)) {
      if (['income', 'emi', 'creditCard', 'transfer', 'fee', 'interest'].includes(subcat)) continue;
      if (keywords.some(kw => text.includes(kw))) {
        const subcategoryMap: Record<string, string> = {
          food: 'Food & Dining',
          shopping: 'Shopping',
          travel: 'Travel',
          entertainment: 'Entertainment',
          utilities: 'Utilities',
        };
        return { 
          category: 'Expense', 
          subcategory: subcategoryMap[subcat], 
          is_transfer: false, 
          is_emi: false 
        };
      }
    }
    return { category: 'Expense', subcategory: 'Other', is_transfer: false, is_emi: false };
  }
  
  return { category: credit ? 'Income' : 'Expense', is_transfer: false, is_emi: false };
}

export function parseStatement(
  rows: any[][],
  bankType: BankType,
  columnMapping?: Record<string, number>
): ParseResult {
  const template = bankTemplates[bankType];
  const transactions: ParsedTransaction[] = [];
  const errors: string[] = [];
  
  // Skip header rows
  const startRow = template.skipRows || 1;
  const dataRows = rows.slice(startRow);
  
  // Determine column indices
  const getColumnIndex = (colName: string): number => {
    if (columnMapping) {
      return columnMapping[colName] ?? -1;
    }
    // Auto-detect from header
    const header = rows[0];
    return header.findIndex((h: string) => 
      h && String(h).toLowerCase().includes(colName.toLowerCase())
    );
  };
  
  const dateIdx = getColumnIndex(template.columns.date);
  const valueDateIdx = template.columns.valueDate ? getColumnIndex(template.columns.valueDate) : -1;
  const narrationIdx = getColumnIndex(template.columns.narration);
  const refIdx = template.columns.reference ? getColumnIndex(template.columns.reference) : -1;
  const debitIdx = getColumnIndex(template.columns.debit);
  const creditIdx = getColumnIndex(template.columns.credit);
  const balanceIdx = getColumnIndex(template.columns.balance);
  
  dataRows.forEach((row, idx) => {
    try {
      const dateStr = row[dateIdx];
      const narration = row[narrationIdx];
      
      if (!dateStr || !narration) {
        errors.push(`Row ${idx + startRow + 1}: Missing date or narration`);
        return;
      }
      
      const transaction_date = parseDate(String(dateStr), template.dateFormat);
      if (!transaction_date) {
        errors.push(`Row ${idx + startRow + 1}: Invalid date format: ${dateStr}`);
        return;
      }
      
      const debit = parseAmount(row[debitIdx]);
      const credit = parseAmount(row[creditIdx]);
      const balance = parseAmount(row[balanceIdx]);
      
      const classification = classifyTransaction(String(narration), debit, credit);
      
      transactions.push({
        transaction_date,
        value_date: valueDateIdx >= 0 ? parseDate(String(row[valueDateIdx]), template.dateFormat) : undefined,
        narration: String(narration),
        reference: refIdx >= 0 ? String(row[refIdx] || '') : undefined,
        debit,
        credit,
        balance,
        ...classification,
      });
    } catch (error) {
      errors.push(`Row ${idx + startRow + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  });
  
  return {
    success: transactions.length > 0,
    transactions,
    errors,
  };
}