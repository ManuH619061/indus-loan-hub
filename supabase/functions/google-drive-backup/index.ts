import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BackupRequest {
  action: "create_backup" | "list_backups" | "restore_backup" | "delete_backup";
  backup_id?: string;
  backup_data?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from token
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Google OAuth provider token
    const { data: session } = await supabase.auth.getSession();
    const providerToken = session?.session?.provider_token;
    const providerRefreshToken = session?.session?.provider_refresh_token;

    const { action, backup_id, backup_data }: BackupRequest = await req.json();

    // Check if user has Google Drive access
    const hasGoogleDriveAccess = !!providerToken;

    switch (action) {
      case "create_backup": {
        if (!hasGoogleDriveAccess) {
          // Fall back to storing backup metadata in database
          // The actual backup data will be stored in Supabase storage
          const backupFileName = `backup_${user.id}_${Date.now()}.json`;
          
          // Store in Supabase storage bucket
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("loan-documents")
            .upload(`backups/${user.id}/${backupFileName}`, JSON.stringify(backup_data), {
              contentType: "application/json",
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          return new Response(JSON.stringify({ 
            success: true, 
            message: "Backup created in cloud storage",
            backup_id: backupFileName,
            location: "cloud_storage",
            note: "To enable Google Drive backups, please sign out and sign in again with Google to grant Drive permissions."
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create backup in Google Drive
        const folderName = "LoanTracker Backups";
        
        // Search for existing folder
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          {
            headers: {
              Authorization: `Bearer ${providerToken}`,
            },
          }
        );

        const searchResult = await searchResponse.json();
        let folderId: string;

        if (searchResult.files && searchResult.files.length > 0) {
          folderId = searchResult.files[0].id;
        } else {
          // Create folder
          const createFolderResponse = await fetch(
            "https://www.googleapis.com/drive/v3/files",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${providerToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: folderName,
                mimeType: "application/vnd.google-apps.folder",
              }),
            }
          );
          const folderResult = await createFolderResponse.json();
          folderId = folderResult.id;
        }

        // Create backup file
        const backupFileName = `backup_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        const boundary = "-------314159265358979323846";
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadata = {
          name: backupFileName,
          parents: [folderId],
          mimeType: "application/json",
        };

        const multipartBody = 
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          "Content-Type: application/json\r\n\r\n" +
          JSON.stringify(backup_data) +
          closeDelimiter;

        const uploadResponse = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${providerToken}`,
              "Content-Type": `multipart/related; boundary="${boundary}"`,
            },
            body: multipartBody,
          }
        );

        const uploadResult = await uploadResponse.json();

        if (uploadResult.error) {
          throw new Error(uploadResult.error.message);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Backup created in Google Drive",
          backup_id: uploadResult.id,
          backup_name: backupFileName,
          location: "google_drive",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_backups": {
        const backups: any[] = [];

        // List from Supabase storage
        const { data: storageFiles, error: storageError } = await supabase.storage
          .from("loan-documents")
          .list(`backups/${user.id}`);

        if (!storageError && storageFiles) {
          for (const file of storageFiles) {
            backups.push({
              id: file.name,
              name: file.name,
              created_at: file.created_at,
              size: file.metadata?.size || 0,
              location: "cloud_storage",
            });
          }
        }

        // List from Google Drive if available
        if (hasGoogleDriveAccess) {
          try {
            const searchResponse = await fetch(
              `https://www.googleapis.com/drive/v3/files?q=name contains 'backup_' and mimeType='application/json' and trashed=false&fields=files(id,name,createdTime,size)`,
              {
                headers: {
                  Authorization: `Bearer ${providerToken}`,
                },
              }
            );

            const searchResult = await searchResponse.json();
            if (searchResult.files) {
              for (const file of searchResult.files) {
                backups.push({
                  id: file.id,
                  name: file.name,
                  created_at: file.createdTime,
                  size: parseInt(file.size || "0"),
                  location: "google_drive",
                });
              }
            }
          } catch (e) {
            console.error("Error listing Google Drive backups:", e);
          }
        }

        // Sort by date, newest first
        backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return new Response(JSON.stringify({ 
          success: true, 
          backups,
          has_google_drive: hasGoogleDriveAccess,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "restore_backup": {
        if (!backup_id) {
          throw new Error("backup_id is required");
        }

        let backupContent: any = null;

        // Try to get from cloud storage first
        if (backup_id.startsWith("backup_")) {
          const { data, error } = await supabase.storage
            .from("loan-documents")
            .download(`backups/${user.id}/${backup_id}`);

          if (!error && data) {
            const text = await data.text();
            backupContent = JSON.parse(text);
          }
        }

        // Try Google Drive if not found in storage
        if (!backupContent && hasGoogleDriveAccess) {
          const fileResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${backup_id}?alt=media`,
            {
              headers: {
                Authorization: `Bearer ${providerToken}`,
              },
            }
          );

          if (fileResponse.ok) {
            backupContent = await fileResponse.json();
          }
        }

        if (!backupContent) {
          throw new Error("Backup file not found");
        }

        return new Response(JSON.stringify({ 
          success: true, 
          backup_data: backupContent,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_backup": {
        if (!backup_id) {
          throw new Error("backup_id is required");
        }

        // Try to delete from cloud storage
        if (backup_id.startsWith("backup_")) {
          const { error } = await supabase.storage
            .from("loan-documents")
            .remove([`backups/${user.id}/${backup_id}`]);

          if (!error) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: "Backup deleted from cloud storage",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Try Google Drive
        if (hasGoogleDriveAccess) {
          const deleteResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${backup_id}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${providerToken}`,
              },
            }
          );

          if (deleteResponse.ok || deleteResponse.status === 204) {
            return new Response(JSON.stringify({ 
              success: true, 
              message: "Backup deleted from Google Drive",
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        throw new Error("Failed to delete backup");
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error: any) {
    console.error("Google Drive backup error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
