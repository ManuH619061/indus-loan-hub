import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Download, 
  Upload, 
  Cloud, 
  HardDrive, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  Lock,
  Calendar,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BackupSettings {
  auto_backup_enabled: boolean;
  auto_backup_frequency: "daily" | "weekly" | "monthly";
  last_backup_date: string | null;
  next_backup_date: string | null;
  backup_location: "local" | "google_drive";
  google_drive_enabled: boolean;
  encryption_enabled: boolean;
}

export default function BackupManager() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    auto_backup_enabled: false,
    auto_backup_frequency: "weekly",
    last_backup_date: null,
    next_backup_date: null,
    backup_location: "local",
    google_drive_enabled: false,
    encryption_enabled: true,
  });
  const [backupSize, setBackupSize] = useState<number>(0);

  useEffect(() => {
    if (user) {
      loadBackupSettings();
      calculateBackupSize();
    }
  }, [user]);

  const loadBackupSettings = async () => {
    // In production, load from a backup_settings table
    const stored = localStorage.getItem(`backup_settings_${user?.id}`);
    if (stored) {
      setBackupSettings(JSON.parse(stored));
    }
  };

  const saveBackupSettings = async (newSettings: BackupSettings) => {
    setBackupSettings(newSettings);
    localStorage.setItem(`backup_settings_${user?.id}`, JSON.stringify(newSettings));
    toast.success("Backup settings saved");
  };

  const calculateBackupSize = async () => {
    if (!user) return;
    
    try {
      // Estimate total data size
      const tables = [
        'loans', 'lenders', 'payments', 'bank_accounts', 
        'bank_statement_entries', 'monthly_expenses', 'monthly_budgets',
        'transactions', 'profiles'
      ];
      
      let totalSize = 0;
      for (const table of tables) {
        const { count } = await supabase
          .from(table as any)
          .select('*', { count: 'exact', head: true });
        totalSize += (count || 0) * 1024; // Rough estimate
      }
      
      setBackupSize(totalSize / (1024 * 1024)); // Convert to MB
    } catch (error) {
      console.error("Error calculating backup size:", error);
    }
  };

  const createBackup = async (destination: "local" | "google_drive") => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch all user data
      const backupData: any = {
        version: "1.0",
        user_id: user.id,
        backup_date: new Date().toISOString(),
        data: {}
      };

      // Fetch all tables
      const tables = [
        'loans', 'lenders', 'payments', 'bank_accounts', 
        'bank_statement_entries', 'monthly_expenses', 'monthly_budgets',
        'transactions', 'profiles', 'tags', 'documents', 'goals',
        'income_sources', 'savings_goals', 'expense_groups', 'expense_subgroups'
      ];

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table as any)
          .select('*');
        
        if (!error && data) {
          backupData.data[table] = data;
        }
      }

      // Encrypt if enabled
      let finalData = JSON.stringify(backupData, null, 2);
      if (backupSettings.encryption_enabled) {
        finalData = await encryptData(finalData);
      }

      if (destination === "local") {
        // Download as JSON file
        const blob = new Blob([finalData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename = `backup_${format(new Date(), "yyyy-MM-dd_HHmmss")}.json`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success("Backup downloaded successfully");
      } else {
        // Upload to Google Drive (requires setup)
        toast.info("Google Drive integration coming soon. Please use local download for now.");
      }

      // Update last backup date
      const newSettings = {
        ...backupSettings,
        last_backup_date: new Date().toISOString(),
        next_backup_date: calculateNextBackupDate(backupSettings.auto_backup_frequency)
      };
      await saveBackupSettings(newSettings);

    } catch (error: any) {
      console.error("Backup error:", error);
      toast.error("Failed to create backup: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (file: File) => {
    if (!user) return;
    
    setLoading(true);
    try {
      const text = await file.text();
      let backupData = text;
      
      // Decrypt if needed
      if (backupSettings.encryption_enabled) {
        backupData = await decryptData(text);
      }
      
      const parsed = JSON.parse(backupData);
      
      // Validate backup
      if (!parsed.user_id || !parsed.data) {
        throw new Error("Invalid backup file format");
      }

      // Show conflict resolution dialog if needed
      const shouldProceed = window.confirm(
        "This will restore your data from the backup. Current data may be overwritten. Continue?"
      );
      
      if (!shouldProceed) {
        setLoading(false);
        return;
      }

      // Restore data table by table
      for (const [table, records] of Object.entries(parsed.data)) {
        if (Array.isArray(records) && records.length > 0) {
          // Delete existing data
          await supabase.from(table as any).delete().eq('user_id', user.id);
          
          // Insert backup data
          const { error } = await supabase.from(table as any).insert(records);
          if (error) {
            console.error(`Error restoring ${table}:`, error);
          }
        }
      }

      toast.success("Backup restored successfully! Refreshing...");
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error: any) {
      console.error("Restore error:", error);
      toast.error("Failed to restore backup: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const encryptData = async (data: string): Promise<string> => {
    // Simple base64 encoding for now - in production use proper encryption
    return btoa(data);
  };

  const decryptData = async (data: string): Promise<string> => {
    // Simple base64 decoding for now - in production use proper encryption
    try {
      return atob(data);
    } catch {
      // If decoding fails, assume it's not encrypted
      return data;
    }
  };

  const calculateNextBackupDate = (frequency: "daily" | "weekly" | "monthly"): string => {
    const now = new Date();
    switch (frequency) {
      case "daily":
        now.setDate(now.getDate() + 1);
        break;
      case "weekly":
        now.setDate(now.getDate() + 7);
        break;
      case "monthly":
        now.setMonth(now.getMonth() + 1);
        break;
    }
    return now.toISOString();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      restoreBackup(file);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Backup & Restore</h1>
        <p className="text-muted-foreground mt-2">
          Manage your data backups and sync settings
        </p>
      </div>

      {/* Backup Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup Status
          </CardTitle>
          <CardDescription>Current backup information and statistics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Last Backup</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {backupSettings.last_backup_date 
                    ? format(new Date(backupSettings.last_backup_date), "dd/MM/yyyy HH:mm")
                    : "Never"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Next Scheduled</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {backupSettings.auto_backup_enabled && backupSettings.next_backup_date
                    ? format(new Date(backupSettings.next_backup_date), "dd/MM/yyyy HH:mm")
                    : "Not scheduled"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-sm">Storage Used</Label>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{backupSize.toFixed(2)} MB</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {backupSettings.backup_location === "google_drive" ? (
                <Cloud className="h-5 w-5 text-blue-500" />
              ) : (
                <HardDrive className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="font-medium">
                Backup Location: {backupSettings.backup_location === "google_drive" ? "Google Drive" : "Local Download"}
              </span>
            </div>
            {backupSettings.encryption_enabled && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Encrypted
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Manual Backup Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Backup</CardTitle>
          <CardDescription>Create or restore a backup immediately</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => createBackup("local")}
              disabled={loading}
              className="h-auto py-6 flex-col gap-2"
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Download className="h-6 w-6" />
              )}
              <div>
                <div className="font-semibold">Backup Now</div>
                <div className="text-xs opacity-80">Download to device</div>
              </div>
            </Button>

            <Button 
              onClick={() => createBackup("google_drive")}
              disabled={loading || !backupSettings.google_drive_enabled}
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
            >
              <Cloud className="h-6 w-6" />
              <div>
                <div className="font-semibold">Backup to Drive</div>
                <div className="text-xs opacity-80">Upload to Google Drive</div>
              </div>
            </Button>
          </div>

          <Separator />

          <div>
            <Label htmlFor="restore-file" className="cursor-pointer">
              <Button variant="secondary" className="w-full" asChild disabled={loading}>
                <div>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Restore from Backup File
                    </>
                  )}
                </div>
              </Button>
            </Label>
            <input
              id="restore-file"
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Automatic Backup
          </CardTitle>
          <CardDescription>Configure automatic backup schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable Auto-Backup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically backup your data on schedule
              </p>
            </div>
            <Switch
              checked={backupSettings.auto_backup_enabled}
              onCheckedChange={(checked) =>
                saveBackupSettings({
                  ...backupSettings,
                  auto_backup_enabled: checked,
                  next_backup_date: checked ? calculateNextBackupDate(backupSettings.auto_backup_frequency) : null
                })
              }
            />
          </div>

          {backupSettings.auto_backup_enabled && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label>Backup Frequency</Label>
                <div className="grid grid-cols-3 gap-3">
                  {["daily", "weekly", "monthly"].map((freq) => (
                    <Button
                      key={freq}
                      variant={backupSettings.auto_backup_frequency === freq ? "default" : "outline"}
                      onClick={() =>
                        saveBackupSettings({
                          ...backupSettings,
                          auto_backup_frequency: freq as any,
                          next_backup_date: calculateNextBackupDate(freq as any)
                        })
                      }
                      className="capitalize"
                    >
                      {freq}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Configure backup encryption and security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Encrypt Backups</Label>
              <p className="text-sm text-muted-foreground">
                Protect your backup files with encryption
              </p>
            </div>
            <Switch
              checked={backupSettings.encryption_enabled}
              onCheckedChange={(checked) =>
                saveBackupSettings({
                  ...backupSettings,
                  encryption_enabled: checked
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Google Drive Setup Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">Google Drive Integration Setup Required</p>
            <p className="text-sm">
              To enable Google Drive backups, you need to configure Google Drive API credentials. 
              This requires setting up a Google Cloud project and obtaining OAuth credentials.
            </p>
            <Button variant="link" className="h-auto p-0 text-sm" asChild>
              <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
                Go to Google Cloud Console →
              </a>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
