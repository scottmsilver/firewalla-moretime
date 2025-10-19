# Firewalla Time Manager

A tool to manage internet access time for your kids on Firewalla devices. Provides both a web interface and command-line tool to temporarily grant additional internet time when kids are blocked by time-based policies.

## Features

- ✅ **Web UI** for easy policy management with one-click pause buttons
- ✅ **Email notifications** when policies are paused (via Gmail OAuth2)
- ✅ List all time-based blocking policies with user information
- ✅ Pause policies with automatic re-enabling (set and forget!)
- ✅ Manual grant/revoke internet access
- ✅ View policies grouped by user
- ✅ Full logging of all time grants
- ✅ Works with Firewalla Purple (and other models)

## Architecture

```
┌─────────────────┐
│  React Web UI   │  Browser interface with pause buttons
│  (port 3005)    │  Shows policies, history
│                 │  Setup wizard, Google OAuth, Settings
└────────┬────────┘
         │ HTTP
         │
┌────────▼────────┐
│  API Server     │  Combined Express backend (port 3003)
│ server/index.js │  • API endpoints & authentication
│                 │  • Firewalla client (encrypted ETP)
│                 │  • Email notifications
│                 │  Auto-configures via web UI
└────────┬────────┘
         │ Encrypted API (port 8833)
         │ using ETP keys
         │
┌────────▼────────┐
│   Firewalla     │  Your Firewalla device
│  (your network) │
└─────────────────┘
```

## Quick Start

The easiest way to set up Firewalla Time Manager is through the web interface:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

3. **Generate a session secret:**
   ```bash
   openssl rand -base64 32
   ```
   Add it to `.env` as `SESSION_SECRET=<your-generated-secret>`

4. **Start the servers:**
   ```bash
   npm run dev
   ```

5. **Open your browser to http://localhost:3003**

6. **Follow the setup wizard:**
   - Upload QR code screenshot from Firewalla app
   - Configure Google OAuth for admin login
   - Set up email notifications (optional)
   - Connect to your Firewalla device

That's it! The wizard will guide you through the rest.

## Detailed Setup

### 1. Prerequisites

- Node.js (v14 or higher)
- A Firewalla device on your network
- Google account (for admin authentication)

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### 3. Initial Configuration

```bash
# Copy the environment template
cp .env.example .env

# Generate a secure session secret
openssl rand -base64 32
```

Edit `.env` and set:
```env
SESSION_SECRET=<paste-your-generated-secret-here>
```

### 4. Start the Application

```bash
# Start the server
npm run dev
```

This will start:
- API server on port 3003 (includes Firewalla client)
- React development server on port 3005

### 5. Complete Setup via Web UI

1. **Open http://localhost:3003** in your browser

2. **Get QR Code from Firewalla App:**
   - Open Firewalla mobile app
   - Go to **Settings** → **Additional Pairing**
   - Take a screenshot of the QR code

3. **Upload QR Code:**
   - Click "Upload QR Code" in the setup wizard
   - Select your screenshot
   - The system will automatically extract credentials and IP address

4. **Configure Google OAuth:**
   - Create a Google Cloud project
   - Enable Gmail API
   - Create OAuth 2.0 credentials
   - Paste Client ID and Client Secret in the wizard
   - The wizard will save these to your `.env` file

5. **Login with Google:**
   - Click "Login with Google"
   - Grant necessary permissions
   - This enables email notifications (optional)

6. **Connect to Firewalla:**
   - Click "Connect to Firewalla"
   - The server will reload with your credentials
   - Connection status will show "Connected" when successful

## Usage

1. **Open http://localhost:3003** in your browser

2. **Login with Google** (admin authentication)

3. **View Policies:**
   - See cards for each time-based policy showing:
     - User name (e.g., "Jules")
     - Current status (BLOCKING or PAUSED)
     - Schedule information
     - Pause buttons (15 min, 30 min, 1 hour)
   - Quarantine policies are automatically labeled and filtered

4. **Pause a Policy:**
   - Click a pause button (15 min, 30 min, or 1 hour)
   - Policy immediately grants internet access
   - Automatic re-enabling after time expires
   - Email notification sent (if configured)

5. **View History:**
   - Switch to "History" tab
   - See all pauses with timestamps and durations
   - Track who got extra time and when

6. **Configure Settings:**
   - Click "Settings" to update:
     - Google OAuth credentials
     - Email notification recipient
     - Firewalla connection details


## File Structure

```
firewalla-moretime/
├── server/                   # Backend API server
│   ├── index.js              # Main server (Express + Firewalla client)
│   ├── lib/                  # Server utilities (future)
│   └── tests/                # Server tests
│       ├── test_qr_parser.js
│       ├── qr_validation.test.js
│       ├── qr_connection.test.js
│       └── qr_parser.test.js
├── client/                   # React frontend (web UI)
│   ├── src/
│   │   ├── App.js            # Main app component
│   │   ├── components/       # React components
│   │   └── ...
│   ├── public/
│   └── package.json
├── cli/                      # Python CLI tool (alternative interface)
│   ├── firewalla_cli.py
│   └── requirements.txt
├── scripts/                  # Utility scripts
│   ├── setup_auth.js         # QR code parser
│   └── debug_policy.js       # Policy debugging
├── docs/                     # Documentation
│   ├── GMAIL_SETUP.md
│   ├── QR_CODE_STATUS.md
│   └── REORGANIZATION_PLAN.md
├── etp.private.pem           # Private key (generated by web UI)
├── etp.public.pem            # Public key (generated by web UI)
├── setup.json                # Setup state (generated by web UI)
├── .env                      # Configuration (create from .env.example)
├── .env.example              # Configuration template
├── package.json              # Node.js dependencies
├── time_extensions.log       # Activity log (generated)
├── README.md                 # This file
└── SETUP.md                  # Setup guide
```

## Troubleshooting

### Server Won't Connect to Firewalla

1. Upload QR code via web UI setup wizard
2. Verify ETP keys exist: `ls -la etp.*.pem`
3. Check `.env` file has correct `FIREWALLA_IP` and `EMAIL`
4. Click "Connect to Firewalla" button in web UI
5. Check server console for connection errors

### Web UI Not Loading Policies

1. Check server is running: `curl http://localhost:3003/api/policies`
2. Look for errors in the browser console (F12)
3. Restart the server: `npm run dev`
4. Check Firewalla connection status in the web UI

### Email Notifications Not Working

1. Check web server shows "Email notifications: Enabled" at startup
2. Verify all Gmail OAuth2 credentials are set in `.env`
3. Test email: `curl -X POST http://localhost:3003/api/test-email`
4. Check spam folder
5. See [docs/GMAIL_SETUP.md](docs/GMAIL_SETUP.md) for detailed troubleshooting

## Security Notes

- **Keep `etp.private.pem` secure!** This key allows full access to your Firewalla device.
- **Keep `.env` file secure!** Contains:
  - Gmail OAuth2 credentials with send access
  - Google OAuth client secret for admin authentication
  - Session secret for cookie encryption
- **Admin Authentication:** Google OAuth2 required for web UI access
- The API server runs on localhost only (not exposed to network)
- All communication with Firewalla is encrypted using ETP keys
- Activity is logged to `time_extensions.log` for audit purposes
- Gmail OAuth2 uses refresh tokens (no password stored)
- Email notifications include timestamp and policy details for audit trail
- Quarantine policies are automatically filtered (shows only internet blocking, not intranet blocking)

## Advanced Usage

### Auto-Start Server on Boot

Create a systemd service or add to crontab:

```bash
# Start server on boot
@reboot cd /home/ssilver/development/fw && npm run dev > app.log 2>&1 &
```

## API Endpoints

### API Server (Port 3003)

- `GET /` - Web UI interface
- `GET /health` - Check Firewalla connection status
- `GET /api/policies` - Get all time-based policies with user info
- `POST /api/policies/:pid/pause` - Pause a policy and send email (JSON: `{minutes: 30, reason: "homework"}`)
- `POST /api/policies/:pid/enable` - Re-enable a paused policy
- `GET /api/history` - Get pause history
- `POST /api/test-email` - Send test email notification
- `GET /api/auth/status` - Check authentication and setup status

Example:
```bash
# Pause a policy for 30 minutes
curl -X POST http://localhost:3003/api/policies/5/pause \
  -H "Content-Type: application/json" \
  -d '{"minutes": 30, "reason": "homework"}'

# Check Firewalla connection
curl http://localhost:3003/health
```

## Resources

- [Firewalla GitHub](https://github.com/firewalla/firewalla)
- [node-firewalla Library](https://github.com/lesleyxyz/node-firewalla)
- [Firewalla API Documentation](https://docs.firewalla.net/api-reference/)

## License

ISC

## Support

For issues or questions, check the Firewalla community forums or GitHub discussions.
