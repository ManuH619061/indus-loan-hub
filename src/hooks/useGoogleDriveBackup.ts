import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Backup {
  id: string;
  name: string;
  created_at: string;
  size: number;
  location: "google_drive" | "cloud_storage";
}

interface BackupData {
  version: string;
  user_id: string;
  backup_date: string;
  data: Record<string, any[]>;
}

export function useGoogleDriveBackup() {
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [hasGoogleDrive, setHasGoogleDrive] = useState(false);

  const fetchUserData = async (): Promise<BackupData> => {
    if (!user) throw new Error("User not authenticated");

    const backupData: BackupData = {
      version: "2.0",
      user_id: user.id,
      backup_date: new Date().toISOString(),
      data: {},
    };

    // Tables to backup
    const tables = [
      "loans",
      "lenders",
      "payments",
      "bank_accounts",
      "bank_statement_entries",
      "monthly_expenses",
      "monthly_budgets",
      "transactions",
      "profiles",
      "tags",
      "documents",
      "goals",
      "income_sources",
      "savings_goals",
      "expense_groups",
      "expense_subgroups",
      "amortization_rows",
      "charges",
      "rate_changes",
      "penalty_rules",
      "loan_tags",
      "bank_rules",
      "bank_statement_imports",
      "ai_chat_conversations",
      "ai_chat_messages",
      "reconciliation_matches",
      "salary_settings",
      "activity_logs",
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table as any).select("*");
        if (!error && data) {
          backupData.data[table] = data;
        }
      } catch (e) {
        console.warn(`Could not backup table ${table}:`, e);
      }
    }

    return backupData;
  };

  const createBackup = async (destination: "google_drive" | "cloud_storage" | "local") => {
    if (!user) {
      toast.error("Please sign in to create a backup");
      return;
    }

    setLoading(true);
    try {
      const backupData = await fetchUserData();

      if (destination === "local") {
        // Download locally
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `loan_tracker_backup_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Backup downloaded successfully");
        return;
      }

      // Upload to cloud (Google Drive or Supabase storage)
      const { data, error } = await supabase.functions.invoke("google-drive-backup", {
        body: {
          action: "create_backup",
          backup_data: backupData,
        },
      });

      if (error) throw error;

      if (data.location === "cloud_storage") {
        toast.success("Backup saved to cloud storage", {
          description: data.note,
        });
      } else {
        toast.success("Backup saved to Google Drive");
      }

      // Refresh backup list
      await listBackups();
    } catch (error: any) {
      console.error("Backup error:", error);
      toast.error("Failed to create backup: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const listBackups = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-backup", {
        body: { action: "list_backups" },
      });

      if (error) throw error;

      setBackups(data.backups || []);
      setHasGoogleDrive(data.has_google_drive || false);
    } catch (error: any) {
      console.error("List backups error:", error);
      // Don't show error toast for listing - might just be no backups yet
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!user) {
      toast.error("Please sign in to restore a backup");
      return;
    }

    const confirmed = window.confirm(
      "This will restore your data from the backup. Current data may be overwritten. Continue?"
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-backup", {
        body: {
          action: "restore_backup",
          backup_id: backupId,
        },
      });

      if (error) throw error;

      const backupContent: BackupData = data.backup_data;

      // Restore data table by table
      for (const [table, records] of Object.entries(backupContent.data)) {
        if (Array.isArray(records) && records.length > 0) {
          try {
            // Delete existing data for this user
            await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

            // Insert backup data
            const { error: insertError } = await supabase.from(table as any).insert(records);
            if (insertError) {
              console.warn(`Error restoring ${table}:`, insertError);
            }
          } catch (e) {
            console.warn(`Could not restore table ${table}:`, e);
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

  const restoreFromFile = async (file: File) => {
    if (!user) {
      toast.error("Please sign in to restore a backup");
      return;
    }

    const confirmed = window.confirm(
      "This will restore your data from the backup file. Current data may be overwritten. Continue?"
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const text = await file.text();
      const backupContent: BackupData = JSON.parse(text);

      // Validate backup
      if (!backupContent.user_id || !backupContent.data) {
        throw new Error("Invalid backup file format");
      }

      // Restore data table by table
      for (const [table, records] of Object.entries(backupContent.data)) {
        if (Array.isArray(records) && records.length > 0) {
          try {
            // Update user_id to current user for all records
            const updatedRecords = records.map((record: any) => ({
              ...record,
              user_id: user.id,
            }));

            // Delete existing data
            await supabase.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");

            // Insert backup data
            const { error: insertError } = await supabase.from(table as any).insert(updatedRecords);
            if (insertError) {
              console.warn(`Error restoring ${table}:`, insertError);
            }
          } catch (e) {
            console.warn(`Could not restore table ${table}:`, e);
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

  const deleteBackup = async (backupId: string) => {
    if (!user) return;

    const confirmed = window.confirm("Are you sure you want to delete this backup?");
    if (!confirmed) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("google-drive-backup", {
        body: {
          action: "delete_backup",
          backup_id: backupId,
        },
      });

      if (error) throw error;

      toast.success("Backup deleted");
      await listBackups();
    } catch (error: any) {
      console.error("Delete backup error:", error);
      toast.error("Failed to delete backup: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    backups,
    hasGoogleDrive,
    createBackup,
    listBackups,
    restoreBackup,
    restoreFromFile,
    deleteBackup,
  };
}
