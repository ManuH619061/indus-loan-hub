import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Loader2 } from "lucide-react";

export function BackupManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isBackingUp, setIsBackingUp] = useState(false);

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
      <CardContent>
        <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
          {isBackingUp ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Backup...
            </>
          ) : (
            <>
              <Cloud className="h-4 w-4 mr-2" />
              Create Backup
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
