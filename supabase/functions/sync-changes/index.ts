import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  last_sync_timestamp: string;
  tables: string[];
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

    const { last_sync_timestamp, tables }: SyncRequest = await req.json();

    const changedData: Record<string, any[]> = {};

    // Fetch changed records since last sync
    for (const table of tables) {
      const { data, error } = await supabaseClient
        .from(table)
        .select('*')
        .eq('user_id', user.id)
        .gt('updated_at', last_sync_timestamp)
        .order('updated_at', { ascending: true });

      if (!error && data && data.length > 0) {
        changedData[table] = data;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync_timestamp: new Date().toISOString(),
        changed_data: changedData,
        has_changes: Object.keys(changedData).length > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Sync error:', error);
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
