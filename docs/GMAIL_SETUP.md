# Gmail OAuth2 Setup for Email Notifications

This guide will help you set up Gmail OAuth2 authentication so the Firewalla Time Manager can send email notifications when policies are paused.

## Overview

The web UI can send email notifications when someone pauses a policy (grants internet access). To do this securely, we use Gmail's OAuth2 authentication instead of storing your password.

## Prerequisites

- A Gmail account
- Access to Google Cloud Console
- About 15 minutes

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it "Firewalla Time Manager" (or anything you like)
4. Click **Create**
5. Wait for the project to be created, then select it

## Step 2: Enable Gmail API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click on **Gmail API**
4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have a Google Workspace account)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: Firewalla Time Manager
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **Save and Continue**
6. On the "Scopes" page, click **Add or Remove Scopes**
7. Add the Gmail send scope:
   - Filter for "gmail"
   - Check `https://www.googleapis.com/auth/gmail.send`
   - Click **Update**
8. Click **Save and Continue**
9. On "Test users" page, click **Add Users**
10. Add your Gmail address
11. Click **Save and Continue**
12. Review and click **Back to Dashboard**

## Step 4: Create OAuth2 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: **Web application**
4. Name it "Firewalla Time Manager"
5. Under **Authorized redirect URIs**, click **Add URI**
6. Add: `https://developers.google.com/oauthplayground`
7. Click **Create**
8. **IMPORTANT**: Copy and save:
   - **Client ID** (looks like: `123456789.apps.googleusercontent.com`)
   - **Client Secret** (looks like: `GOCSPX-abc123...`)

## Step 5: Generate Refresh Token

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the **Settings** gear icon (top right)
3. Check **Use your own OAuth credentials**
4. Enter your **Client ID** and **Client Secret** from Step 4
5. Click **Close**
6. On the left side, find **Gmail API v1**
7. Expand it and select: `https://www.googleapis.com/auth/gmail.send`
8. Click **Authorize APIs**
9. Sign in with your Gmail account
10. Click **Allow** to grant permission
11. Click **Exchange authorization code for tokens**
12. Copy the **Refresh token** (looks like: `1//abc123...`)

## Step 6: Configure Your .env File

1. Open your `.env` file (or create it from `.env.example`):
   ```bash
   cp .env.example .env
   nano .env
   ```

2. Add your Gmail OAuth2 credentials:
   ```env
   # Gmail Configuration for Email Notifications
   GMAIL_USER=your-email@gmail.com
   GMAIL_CLIENT_ID=123456789.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=GOCSPX-abc123...
   GMAIL_REFRESH_TOKEN=1//abc123...

   # Email notification recipient
   NOTIFY_EMAIL=parent@example.com
   ```

3. Save and close the file

## Step 7: Test Email Configuration

1. Restart the web server:
   ```bash
   pkill -f web_server
   node web_server.js &
   ```

2. You should see:
   ```
   ✉️  Email notifications: Enabled (your-email@gmail.com)
      Sending to: parent@example.com
   ```

3. Test sending an email:
   ```bash
   curl -X POST http://localhost:3003/api/test-email
   ```

4. Check your inbox at `parent@example.com` for the test email

## Troubleshooting

### "Gmail not configured" warning

**Issue**: The web server shows "Gmail not configured" at startup.

**Fix**: Make sure all four Gmail variables are set in `.env`:
- `GMAIL_USER`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`

### "Invalid grant" error

**Issue**: The refresh token is expired or invalid.

**Fix**: Refresh tokens can expire if:
- Your OAuth consent screen is in "Testing" mode and 7 days have passed
- You've generated more than 50 refresh tokens for the same client
- The user revoked access

**Solution**:
1. Go back to OAuth 2.0 Playground
2. Generate a new refresh token (Step 5)
3. Update your `.env` file

### "Access blocked: This app's request is invalid"

**Issue**: Redirect URI mismatch in OAuth2 Playground.

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth client
3. Make sure `https://developers.google.com/oauthplayground` is listed under Authorized redirect URIs

### Emails not being received

**Check these things**:
1. Verify `NOTIFY_EMAIL` is set correctly in `.env`
2. Check your spam folder
3. Make sure the Gmail account has permission to send (check Gmail API is enabled)
4. Look for error messages in the web server console

## Security Notes

- **Never commit your `.env` file** - It's in `.gitignore` for a reason
- Store your credentials securely
- The refresh token gives access to send emails on your behalf
- Consider creating a dedicated Gmail account for notifications
- If you suspect credentials are compromised, revoke access in your Google Account settings

## What Happens When a Policy is Paused

When someone clicks a pause button in the web UI:
1. The policy is disabled in Firewalla
2. An email is sent to `NOTIFY_EMAIL` with:
   - User name (e.g., "Jules")
   - Policy ID
   - Duration (e.g., "30 minutes")
   - Expiration time
3. The pause is logged to `time_extensions.log`
4. After the duration expires, the policy automatically re-enables

Example email:
```
Internet Access Granted

User: Jules
Policy ID: 23
Duration: 30 minutes
Expires At: 5:44:16 PM
Time: 10/15/2025, 5:14:16 PM

This policy will automatically re-enable after 30 minutes.
```

## Disabling Email Notifications

If you don't want email notifications, simply don't set the Gmail environment variables. The web UI will still work, but no emails will be sent.

The web server will show:
```
✉️  Email notifications: Disabled
```
