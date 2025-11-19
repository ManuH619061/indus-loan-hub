import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Papa from "papaparse";
import { formatINR } from "@/lib/currency";
import { format } from "date-fns";

interface ParsedPayment {
  date: string;
  loanName: string;
  amount: number;
  method?: string;
  notes?: string;
  matchedLoanId?: string;
  matchedLoanName?: string;
  status: 'matched' | 'unmatched' | 'error';
  error?: string;
}

export default function BulkPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsedPayments, setParsedPayments] = useState<ParsedPayment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const downloadTemplate = () => {
    const csvContent = "date,loan_name,amount,method,notes\n2024-01-15,My Personal Loan,5000,UPI,January EMI\n2024-01-15,Car Loan,8000,NETBANKING,Monthly payment";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_payments_template.csv';
    a.click();
  };

  const matchLoanToPayment = async (loanName: string, amount: number): Promise<{ id: string; name: string } | null> => {
    const { data: loans } = await supabase
      .from('loans')
      .select('id, loan_name, emi_amount')
      .eq('user_id', user?.id)
      .eq('status', 'ACTIVE');

    if (!loans || loans.length === 0) return null;

    // First try exact match by name
    let match = loans.find(l => l.loan_name.toLowerCase() === loanName.toLowerCase());
    
    // Then try partial match by name
    if (!match) {
      match = loans.find(l => 
        l.loan_name.toLowerCase().includes(loanName.toLowerCase()) ||
        loanName.toLowerCase().includes(l.loan_name.toLowerCase())
      );
    }

    // Finally try to match by EMI amount
    if (!match) {
      match = loans.find(l => Math.abs((l.emi_amount || 0) - amount) < 10);
    }

    return match ? { id: match.id, name: match.loan_name } : null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true);

    Papa.parse(uploadedFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const payments: ParsedPayment[] = [];

        for (const row of results.data as any[]) {
          const payment: ParsedPayment = {
            date: row.date || row.Date || '',
            loanName: row.loan_name || row['Loan Name'] || '',
            amount: parseFloat(row.amount || row.Amount || '0'),
            method: row.method || row.Method || 'UPI',
            notes: row.notes || row.Notes || '',
            status: 'unmatched'
          };

          // Validate required fields
          if (!payment.date || !payment.loanName || !payment.amount) {
            payment.status = 'error';
            payment.error = 'Missing required fields (date, loan_name, amount)';
            payments.push(payment);
            continue;
          }

          // Validate date format
          const datePattern = /^\d{4}-\d{2}-\d{2}$/;
          if (!datePattern.test(payment.date)) {
            payment.status = 'error';
            payment.error = 'Invalid date format. Use YYYY-MM-DD';
            payments.push(payment);
            continue;
          }

          // Try to match loan
          const matchedLoan = await matchLoanToPayment(payment.loanName, payment.amount);
          if (matchedLoan) {
            payment.matchedLoanId = matchedLoan.id;
            payment.matchedLoanName = matchedLoan.name;
            payment.status = 'matched';
          } else {
            payment.status = 'unmatched';
            payment.error = 'No matching active loan found';
          }

          payments.push(payment);
        }

        setParsedPayments(payments);
        setIsProcessing(false);
      },
      error: (error) => {
        toast({
          title: "Error parsing CSV",
          description: error.message,
          variant: "destructive"
        });
        setIsProcessing(false);
      }
    });
  };

  const processPayments = async () => {
    const validPayments = parsedPayments.filter(p => p.status === 'matched' && p.matchedLoanId);
    
    if (validPayments.length === 0) {
      toast({
        title: "No valid payments",
        description: "Please ensure at least one payment is matched to a loan",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      for (const payment of validPayments) {
        // Insert payment
        const { error: paymentError } = await supabase
          .from('payments')
          .insert([{
            loan_id: payment.matchedLoanId!,
            amount: payment.amount,
            paid_on: payment.date,
            method: payment.method || 'UPI',
            source: payment.method?.toUpperCase() as any || 'UPI',
            payment_type: 'EMI',
            notes: payment.notes
          }]);

        if (paymentError) throw paymentError;

        // Get unpaid amortization rows
        const { data: unpaidRows } = await supabase
          .from('amortization_rows')
          .select('*')
          .eq('loan_id', payment.matchedLoanId)
          .eq('is_paid', false)
          .order('period_no', { ascending: true });

        if (!unpaidRows || unpaidRows.length === 0) continue;

        let remainingAmount = payment.amount;
        const rowsToUpdate = [];

        // Allocate payment to unpaid rows
        for (const row of unpaidRows) {
          if (remainingAmount <= 0) break;

          const emiAmount = row.scheduled_emi;
          if (remainingAmount >= emiAmount) {
            rowsToUpdate.push({ id: row.id, is_paid: true, extra_payment: 0 });
            remainingAmount -= emiAmount;
          } else {
            break;
          }
        }

        // Update paid rows
        for (const update of rowsToUpdate) {
          await supabase
            .from('amortization_rows')
            .update({ is_paid: update.is_paid })
            .eq('id', update.id);
        }

        // Handle extra payment
        if (remainingAmount > 0 && unpaidRows.length > rowsToUpdate.length) {
          const nextRow = unpaidRows[rowsToUpdate.length];
          await supabase
            .from('amortization_rows')
            .update({ extra_payment: remainingAmount })
            .eq('id', nextRow.id);
        }
      }

      toast({
        title: "Payments processed",
        description: `Successfully processed ${validPayments.length} payment(s)`
      });

      // Reset
      setFile(null);
      setParsedPayments([]);
      setIsUploading(false);
    } catch (error: any) {
      toast({
        title: "Error processing payments",
        description: error.message,
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  const matchedCount = parsedPayments.filter(p => p.status === 'matched').length;
  const unmatchedCount = parsedPayments.filter(p => p.status === 'unmatched').length;
  const errorCount = parsedPayments.filter(p => p.status === 'error').length;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Payment Upload</h1>
        <p className="text-muted-foreground">Upload multiple payments at once via CSV file</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload CSV File</CardTitle>
          <CardDescription>
            Download the template, fill in your payment details, and upload the file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
            
            <div className="flex-1">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </div>
          </div>

          {isProcessing && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>Processing CSV file...</AlertDescription>
            </Alert>
          )}

          {parsedPayments.length > 0 && (
            <Alert>
              <AlertDescription className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="default" className="bg-success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {matchedCount} Matched
                  </Badge>
                  {unmatchedCount > 0 && (
                    <Badge variant="secondary">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {unmatchedCount} Unmatched
                    </Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {errorCount} Errors
                    </Badge>
                  )}
                </div>
                <Button 
                  onClick={processPayments}
                  disabled={matchedCount === 0 || isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Process {matchedCount} Payment(s)
                    </>
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {parsedPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Preview</CardTitle>
            <CardDescription>Review and verify the parsed payments before processing</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Original Loan Name</TableHead>
                  <TableHead>Matched Loan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedPayments.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {payment.status === 'matched' && (
                        <Badge variant="default" className="bg-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Matched
                        </Badge>
                      )}
                      {payment.status === 'unmatched' && (
                        <Badge variant="secondary">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Unmatched
                        </Badge>
                      )}
                      {payment.status === 'error' && (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{payment.date}</TableCell>
                    <TableCell>{payment.loanName}</TableCell>
                    <TableCell>
                      {payment.matchedLoanName || (
                        <span className="text-muted-foreground text-sm">
                          {payment.error || 'No match'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatINR(payment.amount)}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
