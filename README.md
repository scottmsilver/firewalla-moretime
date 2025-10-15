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
│    Web UI       │  Browser interface with pause buttons
│  (port 3003)    │  Shows policies, history, sends emails
└────────┬────────┘
         │
         │ HTTP
         │
┌────────┴────────┐
│  Python CLI     │  User-friendly command-line interface
│ firewalla_cli.py│
└────────┬────────┘
         │ HTTP (port 3002)
         │
┌────────▼────────┐
│  Node.js Bridge │  Handles encrypted communication
│firewalla_bridge │
│      .js        │
└────────┬────────┘
         │ Encrypted API (port 8833)
         │ using ETP keys
         │
┌────────▼────────┐
│   Firewalla     │  Your Firewalla device
│  192.168.1.129  │
└─────────────────┘
```

## Setup

### 1. Prerequisites

- Node.js (v14 or higher)
- Python 3.8+
- A Firewalla device on your network

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Authentication Setup

You need to generate ETP (Endpoint Token Pair) keys from your Firewalla device:

**Step 1: Get QR Code from Firewalla App**
1. Open Firewalla mobile app
2. Go to **Settings** → **Additional Pairing**
3. Take a screenshot of the QR code
4. Copy the screenshot to this directory

**Step 2: Generate ETP Keys**
```bash
node setup_auth.js qr_code_screenshot.png
```

This will create:
- `etp.private.pem` - Private key (keep secure!)
- `etp.public.pem` - Public key

**Step 3: Update Firewalla IP (if needed)**
Edit `firewalla_bridge.js` and update the IP address:
```javascript
const FIREWALLA_IP = '192.168.1.129';  // Change to your Firewalla's IP
```

### 4. Start the Bridge Server

```bash
node firewalla_bridge.js
```

You should see:
```
Loading ETP keys...
Logging in to Firewalla...
Testing connection...
✓ Connected to Firewalla successfully!

Firewalla Bridge API running on http://localhost:3002
```

**Optional: Run in Background**
```bash
nohup node firewalla_bridge.js > bridge.log 2>&1 &
```

### 5. Web UI Setup (Optional)

The web UI provides an easy-to-use interface for managing policies with one-click pause buttons and email notifications.

**Start the Web Server**
```bash
node web_server.js
```

You should see:
```
🌐 Firewalla Time Manager Web UI
   Running on http://localhost:3003

📡 Bridge API: http://localhost:3002
✉️  Email notifications: Disabled
```

**Access the Web Interface**

Open your browser to http://localhost:3003

Features:
- View all time-based policies with user names
- One-click pause buttons (15 min, 30 min, 1 hour)
- View pause history
- Auto-refresh every minute with last update timestamp
- Shows exact auto-unpause time for paused policies
- Email notifications (optional, see below)

**Enable Email Notifications (Optional)**

To receive email notifications when policies are paused:

1. Follow the [Gmail OAuth2 Setup Guide](GMAIL_SETUP.md)
2. Add credentials to your `.env` file:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_CLIENT_ID=123456789.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=GOCSPX-abc123...
   GMAIL_REFRESH_TOKEN=1//abc123...
   NOTIFY_EMAIL=parent@example.com
   ```
3. Restart the web server

**Run Web Server in Background**
```bash
nohup node web_server.js > web_server.log 2>&1 &
```

## Usage

### Web UI Usage

1. Open http://localhost:3003 in your browser
2. You'll see cards for each time-based policy showing:
   - User name (e.g., "Jules")
   - Current status (BLOCKING or PAUSED)
   - Schedule information
   - Pause buttons (15 min, 30 min, 1 hour)
3. Click a pause button to grant internet access
4. The policy will automatically re-enable after the time expires
5. Switch to the "History" tab to view all pauses

### Command Line Usage

### List All Policies (with user info)

```bash
./venv/bin/python firewalla_cli.py list
```

Output:
```
✓ Connected to Firewalla at 192.168.1.129

Found 3 time-based internet blocking policies:

Policy ID: 5 [ACTIVE]
  Users: Jules
  Tags: tag:2
  Type: mac
  Action: block
  Schedule: Blocks at 23:20 for 8h 10m
  Times triggered: 63212528
```

### List Policies by User

```bash
./venv/bin/python firewalla_cli.py list --by-user
```

Output:
```
👤 Jules
   User ID: 14
   Tag: tag:2

   Policy ID: 5 [ACTIVE]
     Type: mac
     Action: block
     Schedule: Blocks at 23:20 for 8h 10m
     Times triggered: 63212528
```

### Pause a Policy (Recommended - Auto Re-enables)

Grant internet access for a specific duration. The policy automatically re-enables after the time expires:

```bash
# Pause Jules' internet blocking for 30 minutes
./venv/bin/python firewalla_cli.py pause 5 30
```

Output:
```
Pausing policy 5 (tag:2) for 30 minutes...

✓ Successfully paused policy 5
⏰ Policy will automatically re-enable at 2025-10-15T19:00:38.294Z
🌐 Internet access granted for 30 minutes

Pause logged to time_extensions.log
```

### Grant Access Manually

If you want to grant access and manually re-enable later:

```bash
# Grant access for 30 minutes (requires manual re-enable)
./venv/bin/python firewalla_cli.py grant 5 30
```

### Re-enable a Policy

```bash
./venv/bin/python firewalla_cli.py enable 5
```

### View Activity Log

```bash
./venv/bin/python firewalla_cli.py log
```

Output:
```
Time Extension Log:

2025-10-15T18:45:38 - Paused policy 5 (tag:2) for 15 minutes (expires: 2025-10-15T19:00:38.294Z)
```

## Common Use Cases

### Scenario 1: Kid Asks for More Time

Your kid texts: "Can I have 30 more minutes?"

```bash
# List policies to find their policy ID
./venv/bin/python firewalla_cli.py list --by-user

# Pause their policy for 30 minutes (auto re-enables)
./venv/bin/python firewalla_cli.py pause 5 30
```

The policy will automatically re-enable after 30 minutes - no manual intervention needed!

### Scenario 2: Emergency Internet Access

Need to give someone immediate access:

```bash
# Quick pause for 1 hour
./venv/bin/python firewalla_cli.py pause 5 60
```

### Scenario 3: Check Who's Blocked Right Now

```bash
# See all policies and their status
./venv/bin/python firewalla_cli.py list
```

Look for `[ACTIVE]` vs `[DISABLED]` status.

## Command Reference

```bash
# List commands
./venv/bin/python firewalla_cli.py list              # Show all policies with users
./venv/bin/python firewalla_cli.py list --by-user    # Group by user

# Control commands
./venv/bin/python firewalla_cli.py pause <pid> <min>  # Pause policy (auto re-enable)
./venv/bin/python firewalla_cli.py grant <pid> <min>  # Grant access (manual re-enable)
./venv/bin/python firewalla_cli.py enable <pid>       # Re-enable a policy

# Logging
./venv/bin/python firewalla_cli.py log               # View all grants/pauses
```

## File Structure

```
/home/ssilver/development/fw/
├── firewalla_bridge.js       # Bridge server (Node.js)
├── web_server.js             # Web UI server (Node.js)
├── firewalla_cli.py          # CLI tool (Python)
├── setup_auth.js             # QR code authentication setup
├── public/
│   └── index.html            # Web UI interface
├── etp.private.pem           # Private key (generated)
├── etp.public.pem            # Public key (generated)
├── .env                      # Configuration (create from .env.example)
├── .env.example              # Configuration template
├── package.json              # Node.js dependencies
├── requirements.txt          # Python dependencies
├── time_extensions.log       # Activity log (generated)
├── README.md                 # This file
├── SETUP.md                  # Quick setup guide
└── GMAIL_SETUP.md            # Gmail OAuth2 setup guide
```

## Troubleshooting

### Bridge Server Won't Connect

1. Check Firewalla IP address is correct in `firewalla_bridge.js`
2. Verify ETP keys exist: `ls -la etp.*.pem`
3. Regenerate keys if needed: `node setup_auth.js qr_code.png`

### Python CLI Can't Connect to Bridge

1. Make sure bridge server is running: `curl http://localhost:3002/health`
2. Check if port 3002 is in use: `lsof -i :3002`
3. Restart bridge server: `pkill -f firewalla_bridge && node firewalla_bridge.js &`

### Policy Not Updating

1. Check policy exists: `./venv/bin/python firewalla_cli.py list`
2. Verify you're using the correct policy ID
3. Check bridge server logs for errors

### "Command not found" Error

Make sure to activate the Python virtual environment:
```bash
source venv/bin/activate
```

Or use the full path:
```bash
./venv/bin/python firewalla_cli.py list
```

### Web UI Not Loading Policies

1. Check bridge server is running: `curl http://localhost:3002/health`
2. Check web server is running: `curl http://localhost:3003/api/policies`
3. Look for errors in the browser console (F12)
4. Restart both servers

### Email Notifications Not Working

1. Check web server shows "Email notifications: Enabled" at startup
2. Verify all Gmail OAuth2 credentials are set in `.env`
3. Test email: `curl -X POST http://localhost:3003/api/test-email`
4. Check spam folder
5. See [GMAIL_SETUP.md](GMAIL_SETUP.md) for detailed troubleshooting

## Security Notes

- **Keep `etp.private.pem` secure!** This key allows full access to your Firewalla device.
- **Keep `.env` file secure!** Contains Gmail OAuth2 credentials with send access.
- The bridge server runs on localhost only (not exposed to network)
- The web server runs on localhost only (not exposed to network)
- All communication with Firewalla is encrypted
- Activity is logged to `time_extensions.log` for audit purposes
- Gmail OAuth2 uses refresh tokens (no password stored)
- Email notifications include timestamp and policy details for audit trail

## Advanced Usage

### Auto-Start Servers on Boot

Create a systemd service or add to crontab:

```bash
# Start both servers on boot
@reboot cd /home/ssilver/development/fw && nohup node firewalla_bridge.js > bridge.log 2>&1 &
@reboot cd /home/ssilver/development/fw && sleep 5 && nohup node web_server.js > web_server.log 2>&1 &
```

### Create Shortcuts

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
alias fw-list='cd /home/ssilver/development/fw && ./venv/bin/python firewalla_cli.py list'
alias fw-pause='cd /home/ssilver/development/fw && ./venv/bin/python firewalla_cli.py pause'
alias fw-log='cd /home/ssilver/development/fw && ./venv/bin/python firewalla_cli.py log'
```

Then use:
```bash
fw-list
fw-pause 5 30
fw-log
```

## API Endpoints

### Bridge Server (Port 3002)

If you want to integrate with other tools:

- `GET /health` - Check connection status
- `GET /api/init` - Get all Firewalla data (policies, users, etc.)
- `GET /api/screentime` - Get screen time and policy rules
- `POST /api/policy/:pid/disable` - Disable a policy
- `POST /api/policy/:pid/enable` - Enable a policy
- `POST /api/policy/:pid/pause` - Pause policy with expiration (JSON: `{minutes: 30}`)
- `POST /api/policy/:pid/update` - Update policy (JSON: policy object)

Example:
```bash
curl -X POST http://localhost:3002/api/policy/5/pause \
  -H "Content-Type: application/json" \
  -d '{"minutes": 30}'
```

### Web Server (Port 3003)

- `GET /` - Web UI interface
- `GET /api/policies` - Get all time-based policies with user info
- `POST /api/policies/:pid/pause` - Pause a policy and send email (JSON: `{minutes: 30}`)
- `GET /api/history` - Get pause history
- `POST /api/test-email` - Send test email notification

Example:
```bash
curl -X POST http://localhost:3003/api/policies/5/pause \
  -H "Content-Type: application/json" \
  -d '{"minutes": 30}'
```

## Resources

- [Firewalla GitHub](https://github.com/firewalla/firewalla)
- [node-firewalla Library](https://github.com/lesleyxyz/node-firewalla)
- [Firewalla API Documentation](https://docs.firewalla.net/api-reference/)

## License

ISC

## Support

For issues or questions, check the Firewalla community forums or GitHub discussions.
