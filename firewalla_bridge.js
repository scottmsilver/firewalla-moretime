import express from 'express';
import { SecureUtil, FWGroupApi, FWGroup, InitService, NetworkService, FWSetMessage, FWCmdMessage } from 'node-firewalla';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const FIREWALLA_IP = process.env.FIREWALLA_IP || '192.168.1.129';
const EMAIL = process.env.EMAIL || 'api@firewalla.local';
const ETP_PUBLIC_KEY = process.env.ETP_PUBLIC_KEY || 'etp.public.pem';
const ETP_PRIVATE_KEY = process.env.ETP_PRIVATE_KEY || 'etp.private.pem';

// Initialize keys and login
let fwGroup = null;

async function initialize() {
    try {
        console.log('Loading ETP keys...');
        SecureUtil.importKeyPair(ETP_PUBLIC_KEY, ETP_PRIVATE_KEY);

        console.log('Logging in to Firewalla...');
        let { groups } = await FWGroupApi.login(EMAIL);
        fwGroup = FWGroup.fromJson(groups[0], FIREWALLA_IP);

        console.log('Testing connection...');
        let networkService = new NetworkService(fwGroup);
        await networkService.ping();

        console.log('✓ Connected to Firewalla successfully!');
        return true;
    } catch (err) {
        console.error('Failed to initialize:', err);
        return false;
    }
}

// Middleware to ensure initialized
function ensureInitialized(req, res, next) {
    if (!fwGroup) {
        return res.status(503).json({ error: 'Not connected to Firewalla' });
    }
    next();
}

// Get all initial data (includes policies and screen time rules)
app.get('/api/init', ensureInitialized, async (req, res) => {
    try {
        let initService = new InitService(fwGroup);
        let data = await initService.init();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get screen time rules
app.get('/api/screentime', ensureInitialized, async (req, res) => {
    try {
        let initService = new InitService(fwGroup);
        let data = await initService.init();
        res.json({
            screentimeRules: data.screentimeRules || [],
            policyRules: data.policyRules || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a policy - try multiple methods
app.post('/api/policy/:pid', ensureInitialized, async (req, res) => {
    try {
        const { pid } = req.params;
        const { updates, method } = req.body; // method: 'set', 'cmd:set', or 'cmd:setPolicy'

        // Get current policy first
        let initService = new InitService(fwGroup);
        let data = await initService.init();
        let policies = data.policyRules || [];

        let policy = policies.find(p => p.pid === pid);
        if (!policy) {
            return res.status(404).json({ error: `Policy ${pid} not found` });
        }

        // Apply updates
        if (updates) {
            Object.assign(policy, updates);
        }

        // Try different message formats based on method parameter
        let msg;
        const useMethod = method || 'set'; // default to 'set'

        if (useMethod === 'set') {
            // Try FWSetMessage
            msg = new FWSetMessage("policy", policy);
        } else if (useMethod === 'cmd:set') {
            // Try FWCmdMessage with policy:set
            msg = new FWCmdMessage("policy:set", policy);
        } else if (useMethod === 'cmd:setPolicy') {
            // Try FWCmdMessage with setPolicy
            msg = new FWCmdMessage("setPolicy", policy);
        } else {
            return res.status(400).json({ error: `Unknown method: ${useMethod}` });
        }

        const response = await FWGroupApi.sendMessageToBox(fwGroup, msg);
        res.json({ method: useMethod, response, policy });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Disable a policy (grant internet access)
app.post('/api/policy/:pid/disable', ensureInitialized, async (req, res) => {
    try {
        const { pid } = req.params;
        const msg = new FWCmdMessage("policy:disable", { policyID: pid });
        const response = await FWGroupApi.sendMessageToBox(fwGroup, msg);
        res.json({ success: true, response });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Enable a policy (remove internet access)
app.post('/api/policy/:pid/enable', ensureInitialized, async (req, res) => {
    try {
        const { pid } = req.params;
        const msg = new FWCmdMessage("policy:enable", { policyID: pid });
        const response = await FWGroupApi.sendMessageToBox(fwGroup, msg);
        res.json({ success: true, response });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Pause a policy temporarily (disable with expiration)
app.post('/api/policy/:pid/pause', ensureInitialized, async (req, res) => {
    try {
        const { pid } = req.params;
        const { minutes } = req.body; // Duration in minutes

        if (!minutes || minutes <= 0) {
            return res.status(400).json({ error: 'minutes parameter required and must be > 0' });
        }

        // Get current policy
        let initService = new InitService(fwGroup);
        let data = await initService.init();
        let policies = data.policyRules || [];
        let policy = policies.find(p => p.pid === pid);

        if (!policy) {
            return res.status(404).json({ error: `Policy ${pid} not found` });
        }

        // Set disabled and idleTs fields
        // idleTs is the timestamp when the policy should be re-enabled
        const idleTs = Math.floor(Date.now() / 1000) + (minutes * 60);

        // Create minimal update object with only required fields
        const policyUpdate = {
            pid: policy.pid,
            disabled: 1,
            idleTs: idleTs
        };

        const msg = new FWCmdMessage("policy:update", policyUpdate);
        const response = await FWGroupApi.sendMessageToBox(fwGroup, msg);

        // Wait a moment for Firewalla to process the update
        await new Promise(resolve => setTimeout(resolve, 100));

        // Fetch the updated policy
        let updatedData = await initService.init();
        let updatedPolicy = updatedData.policyRules.find(p => p.pid === pid);

        res.json({
            success: true,
            message: `Policy ${pid} paused for ${minutes} minutes`,
            expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
            response,
            policy: updatedPolicy
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Update a policy
app.post('/api/policy/:pid/update', ensureInitialized, async (req, res) => {
    try {
        const { pid } = req.params;
        const updates = req.body;

        // Get current policy first
        let initService = new InitService(fwGroup);
        let data = await initService.init();
        let policies = data.policyRules || [];
        let policy = policies.find(p => p.pid === pid);

        if (!policy) {
            return res.status(404).json({ error: `Policy ${pid} not found` });
        }

        // Apply updates
        Object.assign(policy, updates);

        const msg = new FWCmdMessage("policy:update", policy);
        const response = await FWGroupApi.sendMessageToBox(fwGroup, msg);
        res.json({ success: true, response, policy });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: fwGroup ? 'connected' : 'disconnected',
        firewalla_ip: FIREWALLA_IP
    });
});

// Reload credentials endpoint
app.post('/api/reload', async (req, res) => {
    try {
        console.log('Reloading credentials...');

        // Reload environment variables
        dotenv.config({ override: true });

        // Re-initialize with new credentials
        const initialized = await initialize();

        if (!initialized) {
            return res.status(500).json({
                error: 'Failed to reload credentials',
                message: 'Could not initialize connection with new credentials'
            });
        }

        res.json({
            success: true,
            message: 'Credentials reloaded successfully',
            status: 'connected',
            firewalla_ip: process.env.FIREWALLA_IP || FIREWALLA_IP
        });
    } catch (error) {
        console.error('Reload error:', error);
        res.status(500).json({
            error: 'Failed to reload credentials',
            details: error.message
        });
    }
});

// Start server
(async () => {
    const initialized = await initialize();

    if (!initialized) {
        console.warn('⚠️  Failed to initialize on startup (credentials may not be configured yet)');
        console.log('   Server will start anyway. Use POST /api/reload to load credentials.');
    }

    app.listen(PORT, () => {
        console.log(`\nFirewalla Bridge API running on http://localhost:${PORT}`);
        console.log(`\nAvailable endpoints:`);
        console.log(`  GET  /health           - Check connection status`);
        console.log(`  POST /api/reload       - Reload credentials`);
        console.log(`  GET  /api/init         - Get all initial data`);
        console.log(`  GET  /api/screentime   - Get screen time rules`);
        console.log(`  POST /api/send         - Send raw API message`);

        if (!initialized) {
            console.log(`\n⚠️  Not connected to Firewalla yet.`);
            console.log(`   Connect via the web UI or call POST /api/reload after configuring credentials.`);
        }
    });
})();
