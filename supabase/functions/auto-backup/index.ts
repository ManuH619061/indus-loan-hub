import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupData {
  version: string;
  user_id: string;
  backup_date: string;
  data: Record<string, any[]>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, data: inputData } = await req.json();

    if (action === 'create_backup') {
      // Create full backup for user
      const backupData: BackupData = {
        version: '1.0',
        user_id: user.id,
        backup_date: new Date().toISOString(),
        data: {}
      };

      // Tables to backup
      const tables = [
        'loans', 'lenders', 'payments', 'bank_accounts',
        'bank_statement_entries', 'monthly_expenses', 'monthly_budgets',
        'transactions', 'profiles', 'tags', 'documents', 'goals',
        'income_sources', 'savings_goals', 'expense_groups', 'expense_subgroups',
        'amortization_rows', 'charges', 'rate_changes', 'penalty_rules'
      ];

      for (const table of tables) {
        const { data, error } = await supabaseClient
          .from(table)
          .select('*')
          .eq('user_id', user.id);

        if (!error && data) {
          backupData.data[table] = data;
        }
      }

      return new Response(
        JSON.stringify({ success: true, backup: backupData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'restore_backup') {
      const { backup, conflict_resolution } = inputData;

      if (!backup || !backup.data) {
        throw new Error('Invalid backup data');
      }

      // Validate backup belongs to user
      if (backup.user_id !== user.id) {
        throw new Error('Backup does not belong to this user');
      }

      // Restore data based on conflict resolution strategy
      for (const [table, records] of Object.entries(backup.data)) {
        if (!Array.isArray(records) || records.length === 0) continue;

        if (conflict_resolution === 'overwrite') {
          // Delete existing and insert backup
          await supabaseClient.from(table).delete().eq('user_id', user.id);
          await supabaseClient.from(table).insert(records);
        } else if (conflict_resolution === 'merge') {
          // Insert only if not exists or update if newer
          for (const record of records) {
            const { data: existing } = await supabaseClient
              .from(table)
              .select('updated_at')
              .eq('id', record.id)
              .single();

            if (!existing) {
              await supabaseClient.from(table).insert(record);
            } else if (
              record.updated_at &&
              existing.updated_at &&
              new Date(record.updated_at) > new Date(existing.updated_at)
            ) {
              await supabaseClient
                .from(table)
                .update(record)
                .eq('id', record.id);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Backup restored successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check_backup_status') {
      // Check if backups exist and return status
      // In production, you'd query a backup_history table
      return new Response(
        JSON.stringify({
          success: true,
          has_backup: false,
          last_backup_date: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: unknown) {
    console.error('Backup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
