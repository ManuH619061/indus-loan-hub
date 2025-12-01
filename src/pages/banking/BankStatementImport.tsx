import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number_masked: string;
}

interface ParsedEntry {
  date: string;
  narration: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  reference: string | null;
}

export default function BankStatementImport() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEntry[]>([]);
  const [columnMapping, setColumnMapping] = useState({
    date: "",
    narration: "",
    debit: "",
    credit: "",
    balance: "",
    reference: "",
  });
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number_masked")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        Date: "2024-01-15",
        Narration: "Sample payment",
        Debit: 1000,
        Credit: "",
        Balance: 5000,
        Reference: "REF123",
      },
      {
        Date: "2024-01-16",
        Narration: "Sample deposit",
        Debit: "",
        Credit: 2000,
        Balance: 7000,
        Reference: "REF124",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Bank Statement");
    XLSX.writeFile(wb, "bank_statement_template.xlsx");

    toast({ title: "Template downloaded" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          toast({
            title: "Invalid file",
            description: "File must have headers and at least one data row",
            variant: "destructive",
          });
          return;
        }

        // Extract column headers
        const headers = jsonData[0].map((h) => String(h).trim());
        setAvailableColumns(headers);

        // Auto-detect columns
        const autoMapping = {
          date: headers.find((h) => /date|txn.*date|transaction.*date/i.test(h)) || "",
          narration: headers.find((h) => /narration|description|details|particulars/i.test(h)) || "",
          debit: headers.find((h) => /debit|withdrawal|dr/i.test(h)) || "",
          credit: headers.find((h) => /credit|deposit|cr/i.test(h)) || "",
          balance: headers.find((h) => /balance|closing/i.test(h)) || "",
          reference: headers.find((h) => /reference|ref|cheque.*no|txn.*id/i.test(h)) || "",
        };
        setColumnMapping(autoMapping);

        setStep("map");
      };

      reader.readAsArrayBuffer(uploadedFile);
    } catch (error) {
      console.error("Error reading file:", error);
      toast({ title: "Error reading file", variant: "destructive" });
    }
  };

  const handlePreview = async () => {
    if (!file || !columnMapping.date || !columnMapping.narration) {
      toast({
        title: "Missing required mappings",
        description: "Date and Narration are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const entries: ParsedEntry[] = jsonData
          .map((row: any) => {
            // Parse date
            let dateStr = row[columnMapping.date];
            let parsedDate: Date;

            if (typeof dateStr === "number") {
              // Excel serial date - convert to JavaScript Date
              const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
              const year = excelDate.getFullYear();
              const month = String(excelDate.getMonth() + 1).padStart(2, "0");
              const day = String(excelDate.getDate()).padStart(2, "0");
              dateStr = `${year}-${month}-${day}`;
            } else if (dateStr) {
              // Try parsing as string
              const parts = String(dateStr).split(/[-\/]/);
              if (parts.length === 3) {
                // Assume DD-MM-YYYY or DD/MM/YYYY format
                const [d, m, y] = parts;
                dateStr = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
              }
            }

            const narration = String(row[columnMapping.narration] || "").trim();
            if (!dateStr || !narration) return null;

            const parseAmount = (val: any): number | null => {
              if (!val) return null;
              const num = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
              return isNaN(num) ? null : num;
            };

            return {
              date: dateStr,
              narration,
              debit: parseAmount(row[columnMapping.debit]),
              credit: parseAmount(row[columnMapping.credit]),
              balance: parseAmount(row[columnMapping.balance]),
              reference: columnMapping.reference ? String(row[columnMapping.reference] || "").trim() : null,
            };
          })
          .filter((entry): entry is ParsedEntry => entry !== null);

        setParsedData(entries);
        setStep("preview");
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error parsing file:", error);
      toast({ title: "Error parsing file", variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!selectedAccount || parsedData.length === 0) {
      toast({ title: "Select account and parse data first", variant: "destructive" });
      return;
    }

    try {
      setImporting(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from("bank_statement_imports")
        .insert({
          user_id: user.id,
          file_name: file?.name || "Unknown",
          file_size: file?.size || 0,
          bank_type: accounts.find((a) => a.id === selectedAccount)?.bank_name || "Unknown",
          total_rows: parsedData.length,
          status: "processing",
        })
        .select()
        .single();

      if (importError) throw importError;

      // Insert entries
      const entries = parsedData.map((entry) => ({
        user_id: user.id,
        bank_account_id: selectedAccount,
        import_id: importRecord.id,
        transaction_date: entry.date,
        narration: entry.narration,
        debit: entry.debit,
        credit: entry.credit,
        balance: entry.balance,
        reference: entry.reference,
        status: "UNMATCHED",
      }));

      const { error: entriesError } = await supabase.from("bank_statement_entries").insert(entries);

      if (entriesError) throw entriesError;

      // Update import record
      await supabase
        .from("bank_statement_imports")
        .update({
          status: "completed",
          successful_rows: parsedData.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importRecord.id);

      // Update bank account last imported timestamp
      await supabase
        .from("bank_accounts")
        .update({ last_imported_at: new Date().toISOString() })
        .eq("id", selectedAccount);

      toast({ title: `Successfully imported ${parsedData.length} entries` });
      navigate("/banking/reconcile");
    } catch (error) {
      console.error("Error importing:", error);
      toast({ title: "Error importing data", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/banking/accounts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Import Bank Statement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and map your bank statement for automatic reconciliation
          </p>
        </div>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-center gap-4">
        {[
          { key: "upload", label: "Upload File" },
          { key: "map", label: "Map Columns" },
          { key: "preview", label: "Preview & Import" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                step === s.key
                  ? "bg-primary text-primary-foreground"
                  : i < ["upload", "map", "preview"].indexOf(step)
                  ? "bg-green-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < ["upload", "map", "preview"].indexOf(step) ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
            {i < 2 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload File */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Bank Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Download Template */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">Download Template</p>
                  <p className="text-sm text-muted-foreground">
                    Use our Excel template for easier import
                  </p>
                </div>
              </div>
              <Button onClick={downloadTemplate} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            {/* Select Account */}
            <div className="space-y-2">
              <Label>Select Bank Account *</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} - {account.account_number_masked}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upload File */}
            <div className="space-y-2">
              <Label>Upload Statement (Excel/CSV) *</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="flex-1"
                />
                {file && (
                  <Badge variant="secondary">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Supported formats: Excel (.xlsx, .xls) or CSV (.csv)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map Columns */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <p className="text-sm text-muted-foreground">
              Match your file columns to the required fields
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date * (Transaction Date)</Label>
                <Select
                  value={columnMapping.date}
                  onValueChange={(val) => setColumnMapping({ ...columnMapping, date: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Narration * (Description)</Label>
                <Select
                  value={columnMapping.narration}
                  onValueChange={(val) => setColumnMapping({ ...columnMapping, narration: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Debit (Withdrawal)</Label>
                <Select
                  value={columnMapping.debit}
                  onValueChange={(val) => setColumnMapping({ ...columnMapping, debit: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Credit (Deposit)</Label>
                <Select
                  value={columnMapping.credit}
                  onValueChange={(val) => setColumnMapping({ ...columnMapping, credit: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Balance</Label>
                <Select
                  value={columnMapping.balance}
                  onValueChange={(val) => setColumnMapping({ ...columnMapping, balance: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reference</Label>
                <Select
                  value={columnMapping.reference}
                  onValueChange={(val) => setColumnMapping({ ...columnMapping, reference: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handlePreview}>
                Preview Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Preview ({parsedData.length} entries)</span>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Importing..." : "Import to Database"}
                <Upload className="h-4 w-4 ml-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {parsedData.slice(0, 20).map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{entry.narration}</span>
                      {entry.reference && (
                        <Badge variant="outline" className="text-xs">
                          {entry.reference}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(entry.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    {entry.debit && (
                      <Badge variant="destructive">- ₹{entry.debit.toLocaleString()}</Badge>
                    )}
                    {entry.credit && (
                      <Badge variant="default">+ ₹{entry.credit.toLocaleString()}</Badge>
                    )}
                    {entry.balance && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Bal: ₹{entry.balance.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {parsedData.length > 20 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ... and {parsedData.length - 20} more entries
                </p>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
