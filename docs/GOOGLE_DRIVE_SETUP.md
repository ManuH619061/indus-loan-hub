# Google Drive Integration Setup Guide

This guide will help you set up Google Drive integration for automatic cloud backups.

## Prerequisites

- A Google Account
- Access to Google Cloud Console

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name your project (e.g., "LoanTracker Backups")
4. Click "Create"

## Step 2: Enable Google Drive API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

## Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in application name: "LoanTracker"
   - Add your email as developer contact
   - Add scopes: `https://www.googleapis.com/auth/drive.file`
4. Choose application type: "Web application"
5. Add authorized JavaScript origins:
   - `http://localhost:5173` (for development)
   - Your production URL (e.g., `https://yourapp.com`)
6. Add authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - Your production callback URL
7. Click "Create"
8. Copy your Client ID and Client Secret

## Step 4: Configure Application

Add your Google OAuth credentials to your application:

```typescript
// In your app's environment configuration
VITE_GOOGLE_CLIENT_ID=your_client_id_here
VITE_GOOGLE_CLIENT_SECRET=your_client_secret_here
```

## Step 5: Test the Integration

1. Go to Settings → Backup & Restore
2. Click "Backup to Drive"
3. You should be prompted to authorize the app
4. After authorization, backups will be stored in:
   `/Google Drive/App_Backups/LoanTracker/{UserID}/`

## Backup File Structure

Backups are stored as:
```
/Google Drive/App_Backups/LoanTracker/
  └── {UserID}/
      ├── backup_2025-01-15_120000.json
      ├── backup_2025-01-16_120000.json
      └── ...
```

## Security Notes

- Backups are encrypted before upload if encryption is enabled
- Your Google OAuth tokens are stored securely
- The app only has access to files it creates (not your entire Drive)
- You can revoke access anytime from [Google Account Settings](https://myaccount.google.com/permissions)

## Troubleshooting

### "Access Denied" Error
- Check that Google Drive API is enabled in your project
- Verify OAuth credentials are correctly configured
- Make sure redirect URIs match exactly

### "Quota Exceeded" Error
- Google Drive API has usage limits
- Consider implementing rate limiting
- Check your quotas in Google Cloud Console

### Backup Files Not Appearing
- Check the correct folder path: `/App_Backups/LoanTracker/{UserID}/`
- Verify the app has write permissions to Drive
- Check browser console for error messages

## Advanced Features

### Custom Backup Location
You can modify the backup folder location in the app settings.

### Automatic Cleanup
Configure retention policy to automatically delete old backups:
- Keep last 7 daily backups
- Keep last 4 weekly backups
- Keep last 12 monthly backups

### Backup Versioning
Each backup includes a version number and timestamp for easy tracking.

## Support

For issues or questions, please contact support or file an issue in the project repository.
