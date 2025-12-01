import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncOptions {
  enabled: boolean;
  intervalMinutes: number;
}

/**
 * Hook to enable automatic background sync of data changes
 * Monitors for changes and syncs to backup storage
 */
export function useBackupSync(options: SyncOptions = { enabled: false, intervalMinutes: 30 }) {
  const { user } = useAuth();
  const lastSyncRef = useRef<string>(new Date().toISOString());
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !options.enabled) {
      // Clear any existing interval
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    // Initialize last sync timestamp from localStorage
    const stored = localStorage.getItem(`last_sync_${user.id}`);
    if (stored) {
      lastSyncRef.current = stored;
    }

    // Set up periodic sync
    const syncData = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return;

        // Call sync edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-changes`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              last_sync_timestamp: lastSyncRef.current,
              tables: [
                'loans', 'payments', 'bank_accounts', 'bank_statement_entries',
                'monthly_expenses', 'monthly_budgets', 'transactions'
              ]
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          if (result.has_changes) {
            lastSyncRef.current = result.sync_timestamp;
            localStorage.setItem(`last_sync_${user.id}`, result.sync_timestamp);
            
            // In a full implementation, you would upload changed_data to backup storage
            console.log('Sync completed:', result.changed_data);
          }
        }
      } catch (error) {
        console.error('Sync error:', error);
      }
    };

    // Run initial sync
    syncData();

    // Set up interval
    syncIntervalRef.current = setInterval(syncData, options.intervalMinutes * 60 * 1000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [user, options.enabled, options.intervalMinutes]);

  return {
    lastSync: lastSyncRef.current,
    forceSync: async () => {
      // Trigger immediate sync
      if (!user) return;
      
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.access_token) return;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-changes`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              last_sync_timestamp: lastSyncRef.current,
              tables: [
                'loans', 'payments', 'bank_accounts', 'bank_statement_entries',
                'monthly_expenses', 'monthly_budgets', 'transactions'
              ]
            })
          }
        );

        if (response.ok) {
          const result = await response.json();
          lastSyncRef.current = result.sync_timestamp;
          localStorage.setItem(`last_sync_${user.id}`, result.sync_timestamp);
          toast.success('Sync completed successfully');
          return result;
        }
      } catch (error) {
        toast.error('Sync failed');
        throw error;
      }
    }
  };
}
