import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatINR, formatPercent } from "./currency";

interface LenderExportData {
  name: string;
  type: string;
  logo_url?: string | null;
  website?: string | null;
  contact?: string | null;
  loan_count: number;
  total_outstanding: number;
}

interface LoanExportData {
  loan_name: string;
  lender_name: string;
  lender_logo?: string | null;
  principal_amount: number;
  outstanding: number;
  interest_rate_apy: number;
  emi_amount: number;
  tenure_months: number;
  status: string;
  loan_type: string;
  disbursed_on: string;
  next_due?: string | null;
}

// Convert image URL to base64
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Generate initials avatar as canvas
function generateInitialsImage(name: string, size: number = 40): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Background
  const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
  const colorIndex = name.charCodeAt(0) % colors.length;
  ctx.fillStyle = colors[colorIndex];
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.4}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  ctx.fillText(initials, size / 2, size / 2);

  return canvas.toDataURL("image/png");
}

export async function exportLendersToPDF(lenders: LenderExportData[], title: string = "Lender Report") {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 20, { align: "center" });
  
  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, pageWidth / 2, 28, { align: "center" });

  // Summary
  const totalOutstanding = lenders.reduce((sum, l) => sum + l.total_outstanding, 0);
  const totalLoans = lenders.reduce((sum, l) => sum + l.loan_count, 0);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total Lenders: ${lenders.length}`, 14, 48);
  doc.text(`Total Active Loans: ${totalLoans}`, 14, 54);
  doc.text(`Total Outstanding: ${formatINR(totalOutstanding)}`, 14, 60);

  // Prepare table data with logos
  const tableData: any[] = [];
  
  for (const lender of lenders) {
    let logoImage: string | null = null;
    if (lender.logo_url) {
      logoImage = await imageToBase64(lender.logo_url);
    }
    if (!logoImage) {
      logoImage = generateInitialsImage(lender.name);
    }
    
    tableData.push({
      logo: logoImage,
      name: lender.name,
      type: getLenderTypeLabel(lender.type),
      loans: lender.loan_count.toString(),
      outstanding: formatINR(lender.total_outstanding),
      contact: lender.contact || "-",
    });
  }

  // Draw table with logos
  autoTable(doc, {
    startY: 70,
    head: [["", "Lender Name", "Type", "Active Loans", "Outstanding", "Contact"]],
    body: tableData.map((row) => ["", row.name, row.type, row.loans, row.outstanding, row.contact]),
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.row.section === "body") {
        const rowData = tableData[data.row.index];
        if (rowData?.logo) {
          const dim = 8;
          const x = data.cell.x + (data.cell.width - dim) / 2;
          const y = data.cell.y + (data.cell.height - dim) / 2;
          try {
            doc.addImage(rowData.logo, "PNG", x, y, dim, dim);
          } catch (e) {
            // Skip if image fails
          }
        }
      }
    },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 40 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25, halign: "center" },
      4: { cellWidth: 35, halign: "right" },
      5: { cellWidth: 40 },
    },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  doc.save(`${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

export async function exportLoansToPDF(loans: LoanExportData[], title: string = "Loans Report") {
  const doc = new jsPDF("landscape");
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, 20, { align: "center" });

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN")}`, pageWidth / 2, 28, { align: "center" });

  // Summary
  const totalOutstanding = loans.reduce((sum, l) => sum + l.outstanding, 0);
  const totalEMI = loans.reduce((sum, l) => sum + l.emi_amount, 0);
  const activeLoans = loans.filter((l) => l.status === "ACTIVE").length;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Summary", 14, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total Loans: ${loans.length} (${activeLoans} Active)`, 14, 48);
  doc.text(`Total Outstanding: ${formatINR(totalOutstanding)}`, 14, 54);
  doc.text(`Total Monthly EMI: ${formatINR(totalEMI)}`, 100, 48);

  // Prepare table data with logos
  const tableData: any[] = [];

  for (const loan of loans) {
    let logoImage: string | null = null;
    if (loan.lender_logo) {
      logoImage = await imageToBase64(loan.lender_logo);
    }
    if (!logoImage) {
      logoImage = generateInitialsImage(loan.lender_name);
    }

    tableData.push({
      logo: logoImage,
      name: loan.loan_name,
      lender: loan.lender_name,
      type: getLoanTypeLabel(loan.loan_type),
      principal: formatINR(loan.principal_amount),
      outstanding: formatINR(loan.outstanding),
      rate: formatPercent(loan.interest_rate_apy, 1),
      emi: formatINR(loan.emi_amount),
      status: loan.status,
      nextDue: loan.next_due ? new Date(loan.next_due).toLocaleDateString("en-IN") : "-",
    });
  }

  // Draw table with logos
  autoTable(doc, {
    startY: 62,
    head: [["", "Loan Name", "Lender", "Type", "Principal", "Outstanding", "Rate", "EMI", "Status", "Next Due"]],
    body: tableData.map((row) => [
      "",
      row.name,
      row.lender,
      row.type,
      row.principal,
      row.outstanding,
      row.rate,
      row.emi,
      row.status,
      row.nextDue,
    ]),
    didDrawCell: (data) => {
      if (data.column.index === 0 && data.row.section === "body") {
        const rowData = tableData[data.row.index];
        if (rowData?.logo) {
          const dim = 8;
          const x = data.cell.x + (data.cell.width - dim) / 2;
          const y = data.cell.y + (data.cell.height - dim) / 2;
          try {
            doc.addImage(rowData.logo, "PNG", x, y, dim, dim);
          } catch (e) {
            // Skip if image fails
          }
        }
      }
      // Color status cells
      if (data.column.index === 8 && data.row.section === "body") {
        const status = tableData[data.row.index]?.status;
        if (status === "ACTIVE") {
          doc.setTextColor(34, 197, 94); // green
        } else if (status === "CLOSED") {
          doc.setTextColor(156, 163, 175); // gray
        } else if (status === "DEFAULTED") {
          doc.setTextColor(239, 68, 68); // red
        }
      }
    },
    willDrawCell: (data) => {
      // Reset text color for non-status cells
      if (data.column.index !== 8) {
        doc.setTextColor(0, 0, 0);
      }
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28, halign: "right" },
      5: { cellWidth: 28, halign: "right" },
      6: { cellWidth: 18, halign: "right" },
      7: { cellWidth: 25, halign: "right" },
      8: { cellWidth: 20, halign: "center" },
      9: { cellWidth: 25, halign: "center" },
    },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  doc.save(`${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
}

function getLenderTypeLabel(type: string): string {
  const types: Record<string, string> = {
    BANK: "Bank",
    NBFC: "NBFC",
    CARD: "Credit Card",
    FRIEND: "Friend/Family",
    OTHER: "Other",
  };
  return types[type] || type;
}

function getLoanTypeLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

// Dashboard Summary PDF Export
interface DashboardSummaryData {
  totalOutstandingPrincipal: number;
  activeLoans: number;
  thisMonthEMI: number;
  thisMonthEMICount: number;
  paidThisMonthCount: number;
  overdueCount: number;
  overdueAmount: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  highInterestLoans: { count: number; outstanding: number };
  closingIn90Days: { count: number; emiTotal: number };
  missedLastSixMonths: number;
  payoffProgress: { paidPrincipal: number; remainingPrincipal: number; progressPercent: number };
  lenderExposure: { lenderName: string; outstanding: number }[];
  alerts: { title: string; description: string; tag?: string }[];
}

export function exportDashboardToPDF(data: DashboardSummaryData, title: string = "Financial Dashboard Summary") {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(99, 102, 241);
  doc.text(title, pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  // Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleDateString("en-IN", { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Section: Key Metrics
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Key Metrics", 14, yPos);
  yPos += 8;

  // Key metrics table
  autoTable(doc, {
    startY: yPos,
    head: [["Metric", "Value"]],
    body: [
      ["Total Outstanding Principal", formatINR(data.totalOutstandingPrincipal)],
      ["Active Loans", data.activeLoans.toString()],
      ["This Month's EMIs", `${formatINR(data.thisMonthEMI)} (${data.thisMonthEMICount} payments)`],
      ["EMIs Paid This Month", `${data.paidThisMonthCount} / ${data.thisMonthEMICount}`],
      ["Overdue EMIs", data.overdueCount > 0 ? `${data.overdueCount} (${formatINR(data.overdueAmount)})` : "None"],
      ["Monthly Income", formatINR(data.monthlyIncome)],
      ["Monthly Expenses", formatINR(data.monthlyExpenses)],
    ],
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 80, halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Section: Loan Risk Overview
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Loan Risk Overview", 14, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [["Risk Factor", "Count", "Amount"]],
    body: [
      ["High-Interest Loans (>30%)", data.highInterestLoans.count.toString(), formatINR(data.highInterestLoans.outstanding)],
      ["Loans Closing in 90 Days", data.closingIn90Days.count.toString(), formatINR(data.closingIn90Days.emiTotal)],
      ["Missed EMIs (Last 6 Months)", data.missedLastSixMonths.toString(), "-"],
    ],
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 50, halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [254, 243, 199] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Section: Loan Closure Progress
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Loan Closure Progress", 14, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    body: [
      ["Principal Paid", formatINR(data.payoffProgress.paidPrincipal)],
      ["Principal Remaining", formatINR(data.payoffProgress.remainingPrincipal)],
      ["Overall Progress", `${data.payoffProgress.progressPercent.toFixed(1)}%`],
    ],
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { cellWidth: 80, halign: 'right' },
    },
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [220, 252, 231] },
  });

  yPos = (doc as any).lastAutoTable.finalY + 12;

  // Section: Lender Exposure (if data exists)
  if (data.lenderExposure.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Lender Exposure", 14, yPos);
    yPos += 8;

    const totalExposure = data.lenderExposure.reduce((sum, l) => sum + l.outstanding, 0);

    autoTable(doc, {
      startY: yPos,
      head: [["Lender", "Outstanding", "% of Total"]],
      body: data.lenderExposure.slice(0, 8).map(l => [
        l.lenderName,
        formatINR(l.outstanding),
        `${((l.outstanding / totalExposure) * 100).toFixed(1)}%`
      ]),
      foot: [["Total", formatINR(totalExposure), "100%"]],
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 50, halign: 'right' },
        2: { cellWidth: 40, halign: 'right' },
      },
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      footStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [239, 246, 255] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // Check if we need a new page for alerts
  if (yPos > 240 && data.alerts.length > 0) {
    doc.addPage();
    yPos = 20;
  }

  // Section: Alerts & Reminders
  if (data.alerts.length > 0) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Active Alerts & Reminders", 14, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Alert", "Details", "Status"]],
      body: data.alerts.slice(0, 10).map(a => [
        a.title,
        a.description,
        a.tag || "-"
      ]),
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 80 },
        2: { cellWidth: 40, halign: 'center' },
      },
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [254, 226, 226] },
    });
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `FinPath Tracker - Page ${i} of ${pageCount}`, 
      pageWidth / 2, 
      doc.internal.pageSize.getHeight() - 10, 
      { align: "center" }
    );
  }

  // Save the PDF
  const fileName = `Dashboard_Summary_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
  
  return fileName;
}
