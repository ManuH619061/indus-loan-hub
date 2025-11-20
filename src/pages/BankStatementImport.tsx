import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { bankTemplates, BankType, generateTemplate } from "@/lib/bank-templates";
import { parseStatement } from "@/lib/statement-parser";
import * as XLSX from 'xlsx';

export default function BankStatementImport() {
  const { session } = useAuth();
  const [selectedBank, setSelectedBank] = useState<BankType>('GENERIC');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'select' | 'upload' | 'processing' | 'complete'>('select');
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(ext || '')) {
      toast.error('Please upload Excel, CSV, or PDF file');
      return;
    }

    setFile(selectedFile);
    setStep('upload');
  };

  const downloadTemplate = () => {
    const templateData = generateTemplate(selectedBank);
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${bankTemplates[selectedBank].name}_Template.xlsx`);
    toast.success('Template downloaded');
  };

  const processFile = async () => {
    if (!file || !session) return;

    setImporting(true);
    setStep('processing');
    setProgress(10);

    try {
      // Read file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      setProgress(30);

      // Parse statement
      const parseResult = parseStatement(rows as any[][], selectedBank);
      
      if (!parseResult.success || parseResult.transactions.length === 0) {
        throw new Error('No valid transactions found in file');
      }

      setProgress(50);

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('bank_statement_imports')
        .insert({
          user_id: session.user.id,
          bank_type: selectedBank,
          file_name: file.name,
          file_size: file.size,
          total_rows: parseResult.transactions.length,
          status: 'processing',
        })
        .select()
        .single();

      if (importError) throw importError;

      setProgress(60);

      // Insert transactions in batches
      const batchSize = 100;
      let successCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < parseResult.transactions.length; i += batchSize) {
        const batch = parseResult.transactions.slice(i, i + batchSize);
        const { error } = await supabase.from('transactions').insert(
          batch.map(t => ({
            user_id: session.user.id,
            import_id: importRecord.id,
            bank_type: selectedBank,
            ...t,
          }))
        );

        if (error) {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += batch.length;
        }

        setProgress(60 + ((i / parseResult.transactions.length) * 30));
      }

      // Update import record
      await supabase
        .from('bank_statement_imports')
        .update({
          successful_rows: successCount,
          failed_rows: parseResult.transactions.length - successCount,
          status: successCount > 0 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          error_message: errors.length > 0 ? errors.join('; ') : null,
        })
        .eq('id', importRecord.id);

      setProgress(100);
      setImportResult({
        success: successCount,
        failed: parseResult.transactions.length - successCount,
        errors: [...parseResult.errors, ...errors],
      });
      setStep('complete');
      
      if (successCount > 0) {
        toast.success(`Imported ${successCount} transactions successfully`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to import statement');
      setStep('upload');
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setStep('select');
    setProgress(0);
    setImportResult(null);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bank Statement Import</h1>
        <p className="text-muted-foreground mt-2">
          Import transactions from your bank statements to track expenses and EMI payments automatically
        </p>
      </div>

      <Card className="p-6">
        {step === 'select' && (
          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Bank or Card Type</label>
              <Select value={selectedBank} onValueChange={(v) => setSelectedBank(v as BankType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(bankTemplates).map(([key, template]) => (
                    <SelectItem key={key} value={key}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              
              <label htmlFor="file-upload">
                <Button asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Statement
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-medium flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" />
                Supported Formats
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Excel (.xlsx, .xls)</li>
                <li>CSV (.csv)</li>
                <li>PDF statements (experimental)</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'upload' && file && (
          <div className="space-y-6">
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="w-5 h-5 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB • {bankTemplates[selectedBank].name}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={processFile} disabled={importing}>
                Import Transactions
              </Button>
              <Button onClick={reset} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <h3 className="font-medium mb-2">Processing your statement...</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Parsing transactions and auto-classifying
              </p>
              <Progress value={progress} className="max-w-md mx-auto" />
            </div>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Import Complete!</h3>
              <div className="flex gap-8 justify-center mt-4">
                <div>
                  <div className="text-3xl font-bold text-green-600">{importResult.success}</div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                {importResult.failed > 0 && (
                  <div>
                    <div className="text-3xl font-bold text-destructive">{importResult.failed}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                )}
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-destructive/10 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-destructive mb-2">Errors</h4>
                    <ul className="text-sm space-y-1">
                      {importResult.errors.slice(0, 5).map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li className="text-muted-foreground">
                          ...and {importResult.errors.length - 5} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => window.location.href = '/expenses'}>
                View Transactions
              </Button>
              <Button onClick={reset} variant="outline">
                Import Another Statement
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}