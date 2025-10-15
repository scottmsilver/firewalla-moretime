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

        // Set disabled and expire fields
        policy.disabled = "1";
        policy.expire = (minutes * 60).toString(); // Convert minutes to seconds
        policy.activatedTime = Math.floor(Date.now() / 1000).toString(); // Current time

        const msg = new FWCmdMessage("policy:update", policy);
        const response = await FWGroupApi.sendMessageToBox(fwGroup, msg);

        res.json({
            success: true,
            message: `Policy ${pid} paused for ${minutes} minutes`,
            expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
            response,
            policy
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

// Start server
(async () => {
    const initialized = await initialize();

    if (!initialized) {
        console.error('Failed to initialize. Exiting...');
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`\nFirewalla Bridge API running on http://localhost:${PORT}`);
        console.log(`\nAvailable endpoints:`);
        console.log(`  GET  /health           - Check connection status`);
        console.log(`  GET  /api/init         - Get all initial data`);
        console.log(`  GET  /api/screentime   - Get screen time rules`);
        console.log(`  POST /api/send         - Send raw API message`);
    });
})();
