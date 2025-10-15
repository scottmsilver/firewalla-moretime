# Quick Setup Checklist

Follow these steps to get your Firewalla Time Manager running:

## ☐ Step 1: Install Dependencies

```bash
# Install Node.js packages
npm install

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

**Expected Result:** All packages install without errors.

---

## ☐ Step 2: Get QR Code from Firewalla App

1. Open Firewalla mobile app on your phone
2. Tap **Settings** (gear icon)
3. Scroll down to **Additional Pairing**
4. Take a screenshot of the QR code that appears
5. Transfer the screenshot to this computer (email, airdrop, etc.)
6. Save it in this directory as `qr_code.png`

**Expected Result:** You have `qr_code.png` in `/home/ssilver/development/fw/`

---

## ☐ Step 3: Generate Authentication Keys

```bash
node setup_auth.js qr_code.png
```

**Expected Output:**
```
Reading QR code image...
Image size: 1080x2340
✓ QR code decoded successfully

QR Code Data:
  Group ID: 56ceb800-af1b-4cf5-8873-90ea11cbfe2a
  Device Model: purple
  IP Address: 192.168.1.129
  Device Name: 316 Costello

Generating ETP keypair...
✓ ETP keys generated successfully!
  - etp.private.pem
  - etp.public.pem

✅ Authentication setup complete!
```

**Expected Result:** Two new files created:
- `etp.private.pem` ✓
- `etp.public.pem` ✓

---

## ☐ Step 4: Verify Firewalla IP Address

The setup script will show your Firewalla's IP address. If it's different from what's in `firewalla_bridge.js`, update it:

```bash
# Check what IP was in the QR code
cat qr_code_data.txt  # (if saved)

# Edit the bridge file if needed
nano firewalla_bridge.js
# Change: const FIREWALLA_IP = '192.168.1.129';
```

**Expected Result:** IP address in `firewalla_bridge.js` matches your Firewalla device.

---

## ☐ Step 5: Start the Bridge Server

```bash
node firewalla_bridge.js
```

**Expected Output:**
```
Loading ETP keys...
Logging in to Firewalla...
Testing connection...
✓ Connected to Firewalla successfully!

Firewalla Bridge API running on http://localhost:3002

Available endpoints:
  GET  /health           - Check connection status
  GET  /api/init         - Get all initial data
  GET  /api/screentime   - Get screen time rules
  POST /api/send         - Send raw API message
```

**Expected Result:** Server starts without errors and shows "Connected successfully!"

**Tip:** Leave this terminal window open, or run in background:
```bash
nohup node firewalla_bridge.js > bridge.log 2>&1 &
```

---

## ☐ Step 6: Test the CLI Tool

In a new terminal window:

```bash
cd /home/ssilver/development/fw
source venv/bin/activate
./venv/bin/python firewalla_cli.py list
```

**Expected Output:**
```
✓ Connected to Firewalla at 192.168.1.129

Found X time-based internet blocking policies:

Policy ID: 5 [ACTIVE]
  Users: Jules
  Tags: tag:2
  Type: mac
  Action: block
  Schedule: Blocks at 23:20 for 8h 10m
  Times triggered: 63212528
...
```

**Expected Result:** You see your policies listed with user names!

---

## ☐ Step 7: Test Pausing a Policy

```bash
# Pause policy 5 for 1 minute (test)
./venv/bin/python firewalla_cli.py pause 5 1

# Check it's disabled
./venv/bin/python firewalla_cli.py list

# Wait 60 seconds and check again - should be re-enabled automatically
sleep 60
./venv/bin/python firewalla_cli.py list
```

**Expected Result:**
1. Policy shows `[DISABLED]` immediately after pause
2. After 60 seconds, policy shows `[ACTIVE]` again (auto re-enabled!)

---

## ✅ Setup Complete!

You're now ready to use the Firewalla Time Manager!

### Quick Reference

```bash
# Start bridge (if not running)
node firewalla_bridge.js &

# List policies
./venv/bin/python firewalla_cli.py list

# Pause Jules' internet for 30 minutes
./venv/bin/python firewalla_cli.py pause 5 30

# View log
./venv/bin/python firewalla_cli.py log
```

---

## Troubleshooting

### "Cannot find module 'jsqr'"

**Fix:** Install the missing npm packages:
```bash
npm install
```

### "Could not decode QR code from image"

**Fix:** Make sure your screenshot clearly shows the QR code. Try:
1. Crop the image to just the QR code
2. Increase brightness/contrast
3. Save as PNG (not JPG if possible)

### "Failed to connect to bridge server"

**Fix:** Make sure the bridge server is running:
```bash
# Check if running
curl http://localhost:3002/health

# If not, start it
node firewalla_bridge.js &
```

### "Bridge not connected to Firewalla"

**Possible causes:**
1. Wrong IP address in `firewalla_bridge.js`
2. Firewalla device is offline
3. ETP keys are invalid (regenerate them)

**Fix:**
```bash
# Check Firewalla is reachable
ping 192.168.1.129

# Regenerate keys
node setup_auth.js qr_code.png

# Restart bridge
pkill -f firewalla_bridge
node firewalla_bridge.js
```

---

## Next Steps

- Read the [full README](README.md) for all features
- Set up shell aliases for quick access
- Configure auto-start on boot
- Review security notes

**Questions?** Check the README.md or Firewalla community forums.
