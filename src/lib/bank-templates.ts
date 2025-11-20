export type BankType = 'SBI' | 'YES_BANK' | 'CANARA' | 'KOTAK' | 'SBI_CARD' | 'HDFC_CARD' | 'GENERIC';

export interface BankTemplate {
  name: string;
  type: BankType;
  columns: {
    date: string;
    valueDate?: string;
    narration: string;
    reference?: string;
    debit: string;
    credit: string;
    balance: string;
  };
  dateFormat: string;
  skipRows?: number;
}

export const bankTemplates: Record<BankType, BankTemplate> = {
  SBI: {
    name: 'State Bank of India',
    type: 'SBI',
    columns: {
      date: 'Txn Date',
      valueDate: 'Value Date',
      narration: 'Description',
      reference: 'Ref No./Cheque No.',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormat: 'DD MMM YYYY',
    skipRows: 1,
  },
  YES_BANK: {
    name: 'YES Bank',
    type: 'YES_BANK',
    columns: {
      date: 'Date',
      valueDate: 'Value Date',
      narration: 'Narration',
      reference: 'Chq/Ref Number',
      debit: 'Withdrawal Amt.',
      credit: 'Deposit Amt.',
      balance: 'Closing Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },
  CANARA: {
    name: 'Canara Bank',
    type: 'CANARA',
    columns: {
      date: 'Transaction Date',
      valueDate: 'Value Date',
      narration: 'Particulars',
      reference: 'Cheque Number',
      debit: 'Debit Amount',
      credit: 'Credit Amount',
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },
  KOTAK: {
    name: 'Kotak Mahindra Bank',
    type: 'KOTAK',
    columns: {
      date: 'Transaction Date',
      narration: 'Description',
      reference: 'Chq/Ref no',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },
  SBI_CARD: {
    name: 'SBI Credit Card',
    type: 'SBI_CARD',
    columns: {
      date: 'Transaction Date',
      narration: 'Transaction Details',
      reference: 'Reference',
      debit: 'Amount',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },
  HDFC_CARD: {
    name: 'HDFC Credit Card',
    type: 'HDFC_CARD',
    columns: {
      date: 'Date',
      narration: 'Description',
      reference: 'Reference Number',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },
  GENERIC: {
    name: 'Generic Bank Statement',
    type: 'GENERIC',
    columns: {
      date: 'Date',
      valueDate: 'Value Date',
      narration: 'Narration',
      reference: 'Reference',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    },
    dateFormat: 'DD/MM/YYYY',
  },
};

export const transactionCategories = [
  'Income',
  'Expense',
  'EMI Payment',
  'Credit Card Payment',
  'Transfer',
  'Fee',
  'Interest',
] as const;

export const expenseSubcategories = [
  'Food & Dining',
  'Shopping',
  'Travel',
  'Entertainment',
  'Utilities',
  'Healthcare',
  'Education',
  'Insurance',
  'Investment',
  'Other',
] as const;

// Keywords for auto-classification
export const classificationKeywords = {
  income: ['salary', 'credit interest', 'refund', 'cashback', 'bonus', 'dividend'],
  emi: ['emi', 'loan', 'instalment', 'installment', 'repayment'],
  creditCard: ['credit card', 'card payment', 'cc payment'],
  transfer: ['transfer', 'imps', 'neft', 'rtgs', 'upi', 'self'],
  fee: ['charges', 'fee', 'penalty', 'gst'],
  interest: ['interest charged', 'finance charge'],
  food: ['swiggy', 'zomato', 'uber eats', 'restaurant', 'cafe', 'food'],
  shopping: ['amazon', 'flipkart', 'myntra', 'shopping', 'store'],
  travel: ['uber', 'ola', 'rapido', 'flight', 'hotel', 'booking', 'irctc'],
  entertainment: ['netflix', 'spotify', 'prime', 'hotstar', 'cinema', 'movie'],
  utilities: ['electricity', 'water', 'gas', 'broadband', 'mobile', 'recharge'],
};

export function generateTemplate(bankType: BankType): string[][] {
  const template = bankTemplates[bankType];
  const headers = [
    template.columns.date,
    template.columns.valueDate || 'Value Date',
    template.columns.narration,
    template.columns.reference || 'Reference',
    template.columns.debit,
    template.columns.credit,
    template.columns.balance,
    'Account Name',
    'Account Type',
  ];

  const sampleRow = [
    '01/01/2024',
    '01/01/2024',
    'Sample Transaction Description',
    'REF123456',
    '1000.00',
    '',
    '50000.00',
    'Savings Account',
    'Savings',
  ];

  return [headers, sampleRow];
}