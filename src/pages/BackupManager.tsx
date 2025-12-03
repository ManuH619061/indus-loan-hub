import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleDriveBackup } from "@/hooks/useGoogleDriveBackup";
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
  RefreshCw,
  Trash2,
  ExternalLink,
  CloudOff
} from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BackupSettings {
  auto_backup_enabled: boolean;
  auto_backup_frequency: "daily" | "weekly" | "monthly";
  last_backup_date: string | null;
  next_backup_date: string | null;
  encryption_enabled: boolean;
}

export default function BackupManager() {
  const { user } = useAuth();
  const {
    loading,
    backups,
    hasGoogleDrive,
    createBackup,
    listBackups,
    restoreBackup,
    restoreFromFile,
    deleteBackup,
  } = useGoogleDriveBackup();

  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    auto_backup_enabled: false,
    auto_backup_frequency: "weekly",
    last_backup_date: null,
    next_backup_date: null,
    encryption_enabled: true,
  });

  useEffect(() => {
    if (user) {
      loadBackupSettings();
      listBackups();
    }
  }, [user]);

  const loadBackupSettings = async () => {
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
      restoreFromFile(file);
    }
  };

  const handleCreateBackup = async (destination: "google_drive" | "cloud_storage" | "local") => {
    await createBackup(destination);
    
    // Update last backup date
    const newSettings = {
      ...backupSettings,
      last_backup_date: new Date().toISOString(),
      next_backup_date: backupSettings.auto_backup_enabled 
        ? calculateNextBackupDate(backupSettings.auto_backup_frequency) 
        : null,
    };
    await saveBackupSettings(newSettings);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold">Backup & Restore</h1>
        <p className="text-muted-foreground mt-2">
          Manage your data backups and sync to Google Drive
        </p>
      </div>

      {/* Google Drive Status */}
      <Card className={hasGoogleDrive ? "border-emerald-500/50 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5"}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            {hasGoogleDrive ? (
              <>
                <div className="p-3 rounded-full bg-emerald-500/20">
                  <Cloud className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-700 dark:text-emerald-400">Google Drive Connected</h3>
                  <p className="text-sm text-muted-foreground">
                    Your backups will be saved to your personal Google Drive folder
                  </p>
                </div>
                <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </>
            ) : (
              <>
                <div className="p-3 rounded-full bg-amber-500/20">
                  <CloudOff className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-700 dark:text-amber-400">Google Drive Not Connected</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign out and sign in again to grant Google Drive permissions. Backups will be saved to cloud storage.
                  </p>
                </div>
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Limited
                </Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backup Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup Status
          </CardTitle>
          <CardDescription>Current backup information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>
        </CardContent>
      </Card>

      {/* Manual Backup Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Create Backup</CardTitle>
          <CardDescription>Create a backup of all your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={() => handleCreateBackup("google_drive")}
              disabled={loading}
              className="h-auto py-6 flex-col gap-2"
              variant={hasGoogleDrive ? "default" : "secondary"}
            >
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Cloud className="h-6 w-6" />
              )}
              <div>
                <div className="font-semibold">
                  {hasGoogleDrive ? "Backup to Google Drive" : "Backup to Cloud"}
                </div>
                <div className="text-xs opacity-80">
                  {hasGoogleDrive ? "Save to your Drive" : "Save to cloud storage"}
                </div>
              </div>
            </Button>

            <Button 
              onClick={() => handleCreateBackup("local")}
              disabled={loading}
              variant="outline"
              className="h-auto py-6 flex-col gap-2"
            >
              <Download className="h-6 w-6" />
              <div>
                <div className="font-semibold">Download Locally</div>
                <div className="text-xs opacity-80">Save JSON to device</div>
              </div>
            </Button>

            <div>
              <Label htmlFor="restore-file" className="cursor-pointer">
                <div className="h-full border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 hover:bg-muted/50 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Restore from File</div>
                    <div className="text-xs text-muted-foreground">Upload JSON backup</div>
                  </div>
                </div>
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
          </div>
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Your Backups
            </CardTitle>
            <CardDescription>Previously created backups</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={listBackups} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No backups found</p>
              <p className="text-sm">Create your first backup above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Backup Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell className="font-medium">{backup.name}</TableCell>
                      <TableCell>
                        {format(new Date(backup.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {backup.location === "google_drive" ? (
                            <>
                              <Cloud className="h-3 w-3" />
                              Google Drive
                            </>
                          ) : (
                            <>
                              <HardDrive className="h-3 w-3" />
                              Cloud Storage
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatFileSize(backup.size)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreBackup(backup.id)}
                            disabled={loading}
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteBackup(backup.id)}
                            disabled={loading}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">About Your Backups</p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Backups include all your loans, lenders, payments, bank accounts, expenses, budgets, and AI chat history</li>
              <li>Each user's data is completely isolated - you only see your own backups</li>
              <li>Google Drive backups are stored in a "LoanTracker Backups" folder in your personal Drive</li>
              <li>Restoring a backup will replace your current data with the backup data</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
