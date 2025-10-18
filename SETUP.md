# Firewalla Time Manager - Setup Guide

This guide will walk you through setting up Firewalla Time Manager using the web interface.

---

## Prerequisites

- **Node.js** v14 or higher
- **A Firewalla device** on your network
- **Google account** for admin authentication

---

## Step 1: Install Dependencies

```bash
npm install
```

**Expected Result:** All packages install without errors.

---

## Step 2: Configure Environment

```bash
# Copy the environment template
cp .env.example .env

# Generate a secure session secret
openssl rand -base64 32
```

Edit `.env` and paste the generated secret:
```env
SESSION_SECRET=<paste-your-generated-secret-here>
```

**Expected Result:** `.env` file exists with `SESSION_SECRET` set.

---

## Step 3: Start the Application

```bash
npm run dev
```

**Expected Output:**
```
> concurrently "node firewalla_bridge.js" "node web_server.js" "cd client && PORT=3005 npm start"

[bridge] Firewalla Bridge API running on http://localhost:3002
[bridge] ⚠️  Not connected to Firewalla yet.

[server] 🌐 Firewalla Time Manager Web UI
[server]    Running on http://localhost:3003

[client] Compiled successfully!
[client] Local: http://localhost:3005
```

**Expected Result:** Three servers start successfully.

---

## Step 4: Open Web Interface

Open your browser to **http://localhost:3003**

You should see the setup wizard.

---

## Step 5: Upload QR Code

### Get QR Code from Firewalla App:

1. Open Firewalla mobile app on your phone
2. Tap **Settings** (gear icon)
3. Scroll down to **Additional Pairing**
4. Take a screenshot of the QR code

### Upload in Web UI:

1. Click **"Upload QR Code"** button
2. Select your screenshot file
3. The system will automatically:
   - Extract Firewalla IP address
   - Generate ETP keypairs (`etp.private.pem`, `etp.public.pem`)
   - Save credentials to `.env`

**Expected Result:**
- Status shows "✓ QR Code processed successfully"
- `etp.private.pem` and `etp.public.pem` files created
- `.env` updated with Firewalla IP and email

---

## Step 6: Configure Google OAuth

For admin login and email notifications:

### Create Google Cloud Project:

1. Go to https://console.cloud.google.com
2. Create a new project
3. Enable **Gmail API**
4. Create **OAuth 2.0 credentials**
5. Add redirect URI: `http://localhost:3003/auth/google/callback`

### Enter Credentials in Web UI:

1. Paste **Client ID**
2. Paste **Client Secret**
3. Click **"Save OAuth Configuration"**

**Expected Result:**
- OAuth credentials saved to `.env`
- "Login with Google" button appears

---

## Step 7: Connect to Firewalla

Click **"Connect to Firewalla"** button in the web UI.

**Expected Result:**
- Connection status changes to "✓ Connected"
- You see your time-based policies listed
- Each policy shows user name, schedule, and pause buttons

---

## Step 8: (Optional) Login with Google

If you configured Google OAuth:

1. Click **"Login with Google"**
2. Grant permissions for Gmail access
3. You'll be redirected back to the app

**Expected Result:**
- You're logged in as admin
- Email notifications are enabled
- Settings page is accessible

---

## ✅ Setup Complete!

You can now:
- View all time-based policies
- Click pause buttons to grant internet access (15 min, 30 min, 1 hour)
- View pause history
- Receive email notifications when policies are paused (if configured)
- Update settings anytime via the Settings page

---

# Troubleshooting

## Cannot access http://localhost:3003

**Fix:**
```bash
# Check if web server is running
curl http://localhost:3003/health

# Check what's using port 3003
lsof -i :3003

# Restart servers
npm run dev
```

## Setup wizard not appearing

**Possible causes:**
1. Already configured (check `setup.json` exists)
2. Missing `SESSION_SECRET` in `.env`

**Fix:**
```bash
# Delete setup state to restart wizard
rm setup.json

# Or check .env has SESSION_SECRET
cat .env | grep SESSION_SECRET
```

## "Not connected to Firewalla"

**Fix:**
1. Upload QR code in web UI
2. Click "Connect to Firewalla" button
3. Check bridge server logs for errors

## QR code upload fails

**Fix:**
1. Make sure screenshot clearly shows QR code
2. Try cropping to just the QR code
3. Save as PNG format
4. Increase image brightness/contrast

## Bridge won't connect after QR upload

**Fix:**
1. Check `.env` has correct `FIREWALLA_IP` and `EMAIL`
2. Verify ETP keys exist: `ls -la etp.*.pem`
3. Restart bridge: Click "Connect to Firewalla" in web UI
4. Check bridge logs in terminal

## Not receiving emails

**Fix:**
1. Login with Google in the web UI
2. Check spam/junk folder
3. Verify `NOTIFY_EMAIL` is set in `.env`
4. Test email: Settings → "Send Test Email"

## Google OAuth not working

**Fix:**
1. Verify redirect URI: `http://localhost:3003/auth/google/callback`
2. Check Gmail API is enabled in Google Cloud Console
3. Verify Client ID and Secret are correct
4. Try logging out and logging in again

---

# Next Steps

- **Explore the Web UI:** Try pausing policies, viewing history
- **Set up Auto-start:** Configure servers to start on boot (see README.md)
- **Read Security Notes:** Understand how to keep your setup secure
- **Configure Email Alerts:** Get notified when policies are paused

**More Help:** Check the [README.md](README.md) for detailed information.
