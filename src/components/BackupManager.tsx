import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Loader2, Upload, Download } from "lucide-react";
import { Input } from "@/components/ui/input";

export function BackupManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You must be logged in to backup data",
      });
      return;
    }

    setIsBackingUp(true);
    try {
      // Fetch all user data
      const [loansRes, lendersRes, paymentsRes, budgetsRes] = await Promise.all([
        supabase.from("loans").select("*").eq("user_id", user.id),
        supabase.from("lenders").select("*").eq("user_id", user.id),
        supabase.from("payments").select("*"),
        supabase.from("monthly_budgets").select("*").eq("user_id", user.id),
      ]);

      const backupData = {
        timestamp: new Date().toISOString(),
        user_email: user.email,
        loans: loansRes.data || [],
        lenders: lendersRes.data || [],
        payments: paymentsRes.data || [],
        budgets: budgetsRes.data || [],
      };

      // Create a blob and download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Backup created successfully",
        description: "Your data has been backed up to your downloads folder",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Backup failed",
        description: error.message,
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    setIsRestoring(true);

    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      // Validate backup structure
      if (!backupData.loans || !backupData.lenders || !backupData.payments || !backupData.budgets) {
        throw new Error("Invalid backup file format");
      }

      // Restore lenders first (they're referenced by loans)
      if (backupData.lenders.length > 0) {
        const { error: lendersError } = await supabase
          .from("lenders")
          .upsert(backupData.lenders.map((l: any) => ({ ...l, user_id: user.id })));
        
        if (lendersError) throw lendersError;
      }

      // Restore loans
      if (backupData.loans.length > 0) {
        const { error: loansError } = await supabase
          .from("loans")
          .upsert(backupData.loans.map((l: any) => ({ ...l, user_id: user.id })));
        
        if (loansError) throw loansError;
      }

      // Restore payments
      if (backupData.payments.length > 0) {
        const { error: paymentsError } = await supabase
          .from("payments")
          .upsert(backupData.payments);
        
        if (paymentsError) throw paymentsError;
      }

      // Restore budgets
      if (backupData.budgets.length > 0) {
        const { error: budgetsError } = await supabase
          .from("monthly_budgets")
          .upsert(backupData.budgets.map((b: any) => ({ ...b, user_id: user.id })));
        
        if (budgetsError) throw budgetsError;
      }

      toast({
        title: "Restore completed successfully",
        description: "Your data has been restored from the backup",
      });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Restore failed",
        description: error.message || "Invalid backup file",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Data Backup
        </CardTitle>
        <CardDescription>
          Backup your financial data to your device
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={handleBackup} disabled={isBackingUp || isRestoring} className="w-full">
          {isBackingUp ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download Backup
            </>
          )}
        </Button>
        
        <div className="relative">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleRestore}
            disabled={isBackingUp || isRestoring}
            className="hidden"
            id="restore-file"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isBackingUp || isRestoring}
            variant="outline"
            className="w-full"
          >
            {isRestoring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Restoring...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Restore Backup
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
