export interface LoanAppLibraryItem {
  id: string;
  name: string;
  category: "INSTANT_LOAN" | "NBFC" | "BANK" | "CREDIT_CARD" | "BNPL" | "SALARY_ADVANCE";
  logo_url?: string;
  typical_interest_min: number;
  typical_interest_max: number;
  min_loan_amount: number;
  max_loan_amount: number;
  badges: string[];
  website?: string;
  app_link?: string;
  upi_vpa?: string;
  description?: string;
}

export const loanAppsLibrary: LoanAppLibraryItem[] = [
  // Banks
  {
    id: "hdfc-bank",
    name: "HDFC Bank",
    category: "BANK",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/HDFC_Bank_Logo.svg/200px-HDFC_Bank_Logo.svg.png",
    typical_interest_min: 10.5,
    typical_interest_max: 21,
    min_loan_amount: 50000,
    max_loan_amount: 4000000,
    badges: ["Trusted Bank", "Quick Approval"],
    website: "https://www.hdfcbank.com",
  },
  {
    id: "icici-bank",
    name: "ICICI Bank",
    category: "BANK",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/ICICI_Bank_Logo.svg/200px-ICICI_Bank_Logo.svg.png",
    typical_interest_min: 10.75,
    typical_interest_max: 19,
    min_loan_amount: 50000,
    max_loan_amount: 2500000,
    badges: ["Trusted Bank", "Paperless"],
  },
  {
    id: "sbi",
    name: "State Bank of India",
    category: "BANK",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/SBI-logo.svg/200px-SBI-logo.svg.png",
    typical_interest_min: 11,
    typical_interest_max: 15.5,
    min_loan_amount: 25000,
    max_loan_amount: 2000000,
    badges: ["Trusted Bank", "Low Interest"],
  },
  {
    id: "axis-bank",
    name: "Axis Bank",
    category: "BANK",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Axis_Bank_logo.svg/200px-Axis_Bank_logo.svg.png",
    typical_interest_min: 11.25,
    typical_interest_max: 22,
    min_loan_amount: 50000,
    max_loan_amount: 4000000,
    badges: ["Trusted Bank"],
  },
  {
    id: "kotak-bank",
    name: "Kotak Mahindra Bank",
    category: "BANK",
    logo_url: "https://upload.wikimedia.org/wikipedia/en/thumb/4/44/Kotak_Mahindra_Bank_logo.svg/200px-Kotak_Mahindra_Bank_logo.svg.png",
    typical_interest_min: 10.99,
    typical_interest_max: 20,
    min_loan_amount: 50000,
    max_loan_amount: 2500000,
    badges: ["Trusted Bank", "Digital First"],
  },

  // NBFCs
  {
    id: "bajaj-finserv",
    name: "Bajaj Finserv",
    category: "NBFC",
    logo_url: "https://www.bajajfinserv.in/sites/all/themes/bajajfinserv/bajaj-finserv-logo.png",
    typical_interest_min: 13,
    typical_interest_max: 26,
    min_loan_amount: 25000,
    max_loan_amount: 2500000,
    badges: ["Quick Disbursal", "Flexible"],
    website: "https://www.bajajfinserv.in",
  },
  {
    id: "tata-capital",
    name: "Tata Capital",
    category: "NBFC",
    logo_url: "https://www.tatacapital.com/content/dam/tata-capital/tatacapital-logo.png",
    typical_interest_min: 10.99,
    typical_interest_max: 21,
    min_loan_amount: 75000,
    max_loan_amount: 3500000,
    badges: ["Trusted NBFC"],
    website: "https://www.tatacapital.com",
  },
  {
    id: "fullerton-india",
    name: "Fullerton India",
    category: "NBFC",
    logo_url: "https://www.fullertonindia.com/content/dam/fullertonindia/images/fullerton-india-logo.png",
    typical_interest_min: 11.99,
    typical_interest_max: 24,
    min_loan_amount: 50000,
    max_loan_amount: 2500000,
    badges: ["Easy Documentation"],
    website: "https://www.fullertonindia.com",
  },

  // Instant Loan Apps
  {
    id: "moneyview",
    name: "MoneyView",
    category: "INSTANT_LOAN",
    logo_url: "https://play-lh.googleusercontent.com/Z8kNhEU-7qL0vKpvs0YqVqLqLJqLYqLqLqLqLqLqLqLq",
    typical_interest_min: 16,
    typical_interest_max: 48,
    min_loan_amount: 5000,
    max_loan_amount: 1000000,
    badges: ["Instant Approval", "High Interest"],
    app_link: "https://play.google.com/store/apps/details?id=com.moneyview",
    website: "https://moneyview.in",
  },
  {
    id: "navi",
    name: "Navi",
    category: "INSTANT_LOAN",
    logo_url: "https://play-lh.googleusercontent.com/tHqCMqHqLqLqLqLqLqLqLqLqLqLqLqLq",
    typical_interest_min: 9.9,
    typical_interest_max: 30,
    min_loan_amount: 5000,
    max_loan_amount: 2000000,
    badges: ["Low Interest", "Quick Disbursal"],
    app_link: "https://play.google.com/store/apps/details?id=com.navi",
    website: "https://www.navi.com",
  },
  {
    id: "lazypay",
    name: "LazyPay",
    category: "INSTANT_LOAN",
    logo_url: "https://www.lazypay.in/static/media/lazypay-logo.png",
    typical_interest_min: 18,
    typical_interest_max: 36,
    min_loan_amount: 1000,
    max_loan_amount: 100000,
    badges: ["Pay Later", "High Interest"],
    website: "https://www.lazypay.in",
  },
  {
    id: "cashe",
    name: "CASHe",
    category: "INSTANT_LOAN",
    logo_url: "https://www.cashe.co.in/images/cashe-logo.png",
    typical_interest_min: 33,
    typical_interest_max: 50,
    min_loan_amount: 1000,
    max_loan_amount: 400000,
    badges: ["Instant Approval", "High Interest"],
    website: "https://www.cashe.co.in",
  },
  {
    id: "earlysalary",
    name: "EarlySalary",
    category: "INSTANT_LOAN",
    logo_url: "https://www.earlysalary.com/images/early-salary-logo.png",
    typical_interest_min: 24,
    typical_interest_max: 48,
    min_loan_amount: 5000,
    max_loan_amount: 500000,
    badges: ["Quick Approval", "High Interest"],
    website: "https://www.earlysalary.com",
  },
  {
    id: "moneytap",
    name: "MoneyTap",
    category: "INSTANT_LOAN",
    logo_url: "https://www.moneytap.com/images/moneytap-logo.png",
    typical_interest_min: 13,
    typical_interest_max: 36,
    min_loan_amount: 3000,
    max_loan_amount: 500000,
    badges: ["Credit Line", "Flexible"],
    website: "https://www.moneytap.com",
  },

  // BNPL
  {
    id: "simpl",
    name: "Simpl",
    category: "BNPL",
    logo_url: "https://www.getsimpl.com/images/simpl-logo.png",
    typical_interest_min: 0,
    typical_interest_max: 18,
    min_loan_amount: 100,
    max_loan_amount: 50000,
    badges: ["BNPL", "Interest Free"],
    website: "https://www.getsimpl.com",
  },
  {
    id: "zestmoney",
    name: "ZestMoney",
    category: "BNPL",
    logo_url: "https://www.zestmoney.in/images/zest-logo.png",
    typical_interest_min: 0,
    typical_interest_max: 24,
    min_loan_amount: 1000,
    max_loan_amount: 200000,
    badges: ["BNPL", "No Cost EMI"],
    website: "https://www.zestmoney.in",
  },
  {
    id: "payu-lazypay",
    name: "LazyPay (PayU)",
    category: "BNPL",
    logo_url: "https://www.lazypay.in/static/media/lazypay-logo.png",
    typical_interest_min: 0,
    typical_interest_max: 24,
    min_loan_amount: 250,
    max_loan_amount: 100000,
    badges: ["BNPL", "Pay Later"],
    website: "https://www.lazypay.in",
  },

  // Salary Advance
  {
    id: "khatabook",
    name: "KhataBook MyMoney",
    category: "SALARY_ADVANCE",
    logo_url: "https://www.khatabook.com/images/khatabook-logo.png",
    typical_interest_min: 18,
    typical_interest_max: 36,
    min_loan_amount: 5000,
    max_loan_amount: 200000,
    badges: ["Salary Advance"],
    website: "https://www.khatabook.com",
  },
  {
    id: "kissht",
    name: "Kissht",
    category: "SALARY_ADVANCE",
    logo_url: "https://www.kissht.com/images/kissht-logo.png",
    typical_interest_min: 15,
    typical_interest_max: 36,
    min_loan_amount: 5000,
    max_loan_amount: 200000,
    badges: ["Salary Advance", "Instant"],
    website: "https://www.kissht.com",
  },

  // Credit Cards
  {
    id: "hdfc-creditcard",
    name: "HDFC Credit Card",
    category: "CREDIT_CARD",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/HDFC_Bank_Logo.svg/200px-HDFC_Bank_Logo.svg.png",
    typical_interest_min: 36,
    typical_interest_max: 48,
    min_loan_amount: 5000,
    max_loan_amount: 1000000,
    badges: ["Credit Card", "High Interest"],
    website: "https://www.hdfcbank.com/personal/pay/cards/credit-cards",
  },
  {
    id: "sbi-creditcard",
    name: "SBI Credit Card",
    category: "CREDIT_CARD",
    logo_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/SBI-logo.svg/200px-SBI-logo.svg.png",
    typical_interest_min: 36,
    typical_interest_max: 42,
    min_loan_amount: 5000,
    max_loan_amount: 500000,
    badges: ["Credit Card", "High Interest"],
    website: "https://www.sbi.co.in/web/personal-banking/cards/credit-card",
  },
];

export const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    INSTANT_LOAN: "Instant Loan",
    NBFC: "NBFC",
    BANK: "Bank",
    CREDIT_CARD: "Credit Card",
    BNPL: "Buy Now Pay Later",
    SALARY_ADVANCE: "Salary Advance",
  };
  return labels[category] || category;
};

export const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    INSTANT_LOAN: "bg-destructive/10 text-destructive border-destructive/20",
    NBFC: "bg-warning/10 text-warning border-warning/20",
    BANK: "bg-success/10 text-success border-success/20",
    CREDIT_CARD: "bg-primary/10 text-primary border-primary/20",
    BNPL: "bg-secondary/10 text-secondary border-secondary/20",
    SALARY_ADVANCE: "bg-accent/10 text-accent border-accent/20",
  };
  return colors[category] || "bg-muted";
};
