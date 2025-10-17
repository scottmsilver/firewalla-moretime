#!/usr/bin/env node
/**
 * Firewalla Time Manager - Web UI Server
 *
 * Provides a web interface for managing Firewalla policies
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import multer from 'multer';
import QrCode from 'qrcode-reader';
import { Jimp } from 'jimp';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// Constants
const SETUP_FILE = join(__dirname, 'setup.json');
const ENV_FILE = join(__dirname, '.env');

// Configuration state (reloadable)
let config = {
    WEB_PORT: process.env.WEB_PORT || 3003,
    WEB_URL: process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3003}`,
    BRIDGE_URL: process.env.BRIDGE_URL || 'http://localhost:3002',
    LOG_FILE: process.env.LOG_FILE || 'time_extensions.log',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-secret',
    GMAIL_USER: process.env.GMAIL_USER || '',
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID || '',
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET || '',
    GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN || '',
    NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || ''
};

// Gmail transporter (reloadable)
let mailTransporter = null;

// Helper: Reload environment variables from .env file
async function reloadEnv() {
    try {
        // Read .env file
        const envContent = await fs.readFile(ENV_FILE, 'utf-8');

        // Parse .env file manually
        const envVars = {};
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    envVars[key.trim()] = valueParts.join('=').trim();
                }
            }
        }

        // Update process.env
        Object.assign(process.env, envVars);

        // Update config object
        config = {
            WEB_PORT: process.env.WEB_PORT || 3003,
            WEB_URL: process.env.WEB_URL || `http://localhost:${process.env.WEB_PORT || 3003}`,
            BRIDGE_URL: process.env.BRIDGE_URL || 'http://localhost:3002',
            LOG_FILE: process.env.LOG_FILE || 'time_extensions.log',
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
            SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-secret',
            GMAIL_USER: process.env.GMAIL_USER || '',
            GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID || '',
            GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET || '',
            GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN || '',
            NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || ''
        };

        console.log('✅ Configuration reloaded from .env');
        return true;
    } catch (error) {
        console.error('Failed to reload .env:', error.message);
        return false;
    }
}

// Helper: Create Gmail transporter
function createMailTransporter() {
    if (!config.GMAIL_USER || !config.GMAIL_CLIENT_ID) {
        console.warn('⚠️  Gmail not configured. Email notifications will be disabled.');
        return null;
    }

    try {
        return nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: config.GMAIL_USER,
                clientId: config.GMAIL_CLIENT_ID,
                clientSecret: config.GMAIL_CLIENT_SECRET,
                refreshToken: config.GMAIL_REFRESH_TOKEN
            }
        });
    } catch (error) {
        console.error('Failed to create mail transporter:', error.message);
        return null;
    }
}

// Helper: Reinitialize Google OAuth strategy
function reinitializeGoogleStrategy() {
    // Remove existing strategy if present
    if (passport._strategies['google']) {
        passport.unuse('google');
    }

    // Add new strategy if credentials are available
    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
        passport.use(new GoogleStrategy({
            clientID: config.GOOGLE_CLIENT_ID,
            clientSecret: config.GOOGLE_CLIENT_SECRET,
            callbackURL: `${config.WEB_URL}/auth/google/callback`,
            scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.send']
        }, (accessToken, refreshToken, profile, done) => {
            // Store user info and tokens
            const user = {
                id: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName,
                picture: profile.photos[0]?.value,
                accessToken,
                refreshToken
            };
            return done(null, user);
        }));
        console.log('✅ Google OAuth strategy initialized');
        return true;
    }
    console.warn('⚠️  Google OAuth not configured');
    return false;
}

// Helper: Reload configuration
async function reloadConfig() {
    await reloadEnv();
    reinitializeGoogleStrategy();
    mailTransporter = createMailTransporter();
    return true;
}

// Add request/response logging middleware
app.use((req, res, next) => {
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(data) {
        console.log(`📤 Response for ${req.method} ${req.path}: status=${res.statusCode}, length=${data?.length || 0}`);
        return originalSend.call(this, data);
    };

    res.json = function(data) {
        console.log(`📤 JSON Response for ${req.method} ${req.path}: status=${res.statusCode}, data=${JSON.stringify(data).substring(0, 200)}`);
        return originalJson.call(this, data);
    };

    next();
});

// Session configuration
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add error handling middleware for session errors
app.use((err, req, res, next) => {
    console.error('❌ Middleware error:', err);
    if (err) {
        // Clear the bad session
        if (req.session) {
            req.session.destroy(() => {});
        }
        return res.status(500).json({ error: 'Session error', details: err.message });
    }
    next();
});

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Initialize Google OAuth strategy
reinitializeGoogleStrategy();

// Initialize mail transporter
mailTransporter = createMailTransporter();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Helper function to fetch from bridge
async function bridgeFetch(path, options = {}) {
    const response = await fetch(`${config.BRIDGE_URL}${path}`, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Bridge request failed');
    }
    return response.json();
}

// Helper: Update .env file
async function updateEnvFile(updates) {
    try {
        let envContent = await fs.readFile(ENV_FILE, 'utf-8').catch(() => '');

        for (const [key, value] of Object.entries(updates)) {
            const escapedValue = value.replace(/\$/g, '\\$'); // Escape $ signs
            const regex = new RegExp(`^${key}=.*$`, 'gm');

            if (envContent.match(regex)) {
                // Update existing key
                envContent = envContent.replace(regex, `${key}=${escapedValue}`);
            } else {
                // Add new key
                envContent += `\n${key}=${escapedValue}`;
            }
        }

        await fs.writeFile(ENV_FILE, envContent);
        console.log('✅ .env file updated');
        return true;
    } catch (error) {
        console.error('Failed to update .env file:', error.message);
        throw error;
    }
}

// Helper: Load setup configuration
async function loadSetupConfig() {
    try {
        const data = await fs.readFile(SETUP_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {
                setupComplete: false,
                adminEmail: '',
                firewallConfigured: false,
                emailConfigured: false
            };
        }
        throw error;
    }
}

// Helper: Save setup configuration
async function saveSetupConfig(config) {
    await fs.writeFile(SETUP_FILE, JSON.stringify(config, null, 2));
}

// Middleware: Require authentication
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}

// Authentication Routes

// Check auth status
app.get('/api/auth/status', async (req, res) => {
    try {
        console.log('📍 GET /api/auth/status - Request received');
        const setup = await loadSetupConfig();
        console.log('✅ Setup config loaded:', setup);
        res.json({
            authenticated: req.isAuthenticated(),
            user: req.user || null,
            setup: setup,
            oauthConfigured: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET)
        });
    } catch (error) {
        console.error('❌ Error in /api/auth/status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Initiate Google OAuth
app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.send'],
        accessType: 'offline',
        prompt: 'consent'
    })
);

// Google OAuth callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res) => {
        // Save admin email to setup config
        const setup = await loadSetupConfig();
        setup.adminEmail = req.user.email;
        setup.emailConfigured = !!req.user.refreshToken;
        await saveSetupConfig(setup);

        // Redirect to home
        res.redirect('/');
    }
);

// Logout
app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Configuration Management Routes

// Update OAuth credentials
app.post('/api/admin/configure-oauth', async (req, res) => {
    try {
        const { clientId, clientSecret } = req.body;

        if (!clientId || !clientSecret) {
            return res.status(400).json({ error: 'Client ID and Client Secret are required' });
        }

        // Update .env file
        await updateEnvFile({
            GOOGLE_CLIENT_ID: clientId,
            GOOGLE_CLIENT_SECRET: clientSecret
        });

        // Reload configuration
        await reloadConfig();

        res.json({ success: true, message: 'OAuth credentials configured successfully' });
    } catch (error) {
        console.error('OAuth configuration error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reload configuration
app.post('/api/admin/reload-config', async (req, res) => {
    try {
        await reloadConfig();
        res.json({ success: true, message: 'Configuration reloaded successfully' });
    } catch (error) {
        console.error('Config reload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reset admin and all setup
app.post('/api/admin/reset', requireAuth, async (req, res) => {
    try {
        // Delete setup.json
        await fs.unlink(SETUP_FILE).catch(() => {});

        // Optionally delete Firewalla connection
        const publicKeyPath = join(__dirname, 'etp.public.pem');
        const privateKeyPath = join(__dirname, 'etp.private.pem');
        await fs.unlink(publicKeyPath).catch(() => {});
        await fs.unlink(privateKeyPath).catch(() => {});

        // Clear Gmail config from .env
        await updateEnvFile({
            GMAIL_USER: '',
            GMAIL_REFRESH_TOKEN: '',
            NOTIFY_EMAIL: ''
        });

        // Reload config
        await reloadConfig();

        // Logout user
        req.logout((err) => {
            if (err) {
                console.error('Logout error during reset:', err);
            }
            res.json({
                success: true,
                message: 'Admin settings reset. Please log in again to set up.'
            });
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API Routes

// Get all policies with users
app.get('/api/policies', async (req, res) => {
    try {
        console.log('📍 GET /api/policies - Request received');
        const data = await bridgeFetch('/api/init');
        console.log('✅ Bridge fetch successful');

        const policyRules = data.policyRules || [];
        const userTags = data.userTags || {};

        // Build user map
        const tagToUsers = {};
        for (const [uid, user] of Object.entries(userTags)) {
            const affiliatedTag = user.affiliatedTag;
            const userName = user.name || 'Unknown';
            if (affiliatedTag) {
                const tagKey = `tag:${affiliatedTag}`;
                if (!tagToUsers[tagKey]) {
                    tagToUsers[tagKey] = [];
                }
                tagToUsers[tagKey].push({ uid, name: userName });
            }
        }

        // Add hardcoded quarantine tag mapping (tag:1 is the Firewalla quarantine group)
        if (!tagToUsers['tag:1']) {
            tagToUsers['tag:1'] = [{ uid: 'quarantine', name: 'Quarantine' }];
        }

        // Filter time-based policies (only 'mac' type for internet blocking, not 'intranet' for internal network blocking)
        const timePolicies = policyRules
            .filter(p => p.type === 'mac' && p.duration && p.cronTime && p.tag)
            .map(p => {
                const users = [];
                for (const tag of (p.tag || [])) {
                    if (tagToUsers[tag]) {
                        users.push(...tagToUsers[tag]);
                    }
                }

                return {
                    pid: p.pid,
                    tags: p.tag || [],
                    users,
                    type: p.type,
                    action: p.action,
                    cronTime: p.cronTime,
                    duration: parseInt(p.duration || 0),
                    disabled: p.disabled === "1",
                    hitCount: parseInt(p.hitCount || 0),
                    activatedTime: p.activatedTime ? parseInt(p.activatedTime) : null,
                    expire: p.expire ? parseInt(p.expire) : null,
                    idleTs: p.idleTs ? parseInt(p.idleTs) : null
                };
            });

        res.json({
            policies: timePolicies,
            serverTime: new Date().toISOString(),
            timezone: data.timezone || 'UTC' // Include Firewalla's timezone
        });
    } catch (error) {
        console.error('❌ Error in /api/policies:', error);
        res.status(500).json({ error: error.message });
    }
});

// Pause a policy
app.post('/api/policies/:pid/pause', async (req, res) => {
    try {
        const { pid } = req.params;
        const { minutes, reason } = req.body;

        if (!minutes || minutes <= 0) {
            return res.status(400).json({ error: 'minutes must be > 0' });
        }

        if (!reason || reason.trim() === '') {
            return res.status(400).json({ error: 'reason is required' });
        }

        // Pause via bridge
        const result = await bridgeFetch(`/api/policy/${pid}/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutes })
        });

        // Log the pause with reason
        const logEntry = {
            timestamp: new Date().toISOString(),
            policy_id: pid,
            tags: [], // Will be filled below
            action: 'paused',
            duration_minutes: minutes,
            reason: reason.trim(),
            expires_at: result.expiresAt
        };

        // Get policy details for email and logging
        const data = await bridgeFetch('/api/init');
        const policy = data.policyRules?.find(p => p.pid === pid);
        const userTags = data.userTags || {};

        let userName = 'Unknown';
        if (policy && policy.tag) {
            logEntry.tags = policy.tag; // Add tags to log entry
            for (const tag of policy.tag) {
                const tagNum = tag.replace('tag:', '');
                for (const user of Object.values(userTags)) {
                    if (user.affiliatedTag === tagNum) {
                        userName = user.name;
                        break;
                    }
                }
            }
        }

        // Write to log file
        try {
            await fs.appendFile(config.LOG_FILE, JSON.stringify(logEntry) + '\n');
        } catch (logError) {
            console.error('Failed to write to log file:', logError.message);
        }

        // Send email notification
        if (mailTransporter && config.NOTIFY_EMAIL) {
            try {
                await mailTransporter.sendMail({
                    from: config.GMAIL_USER,
                    to: config.NOTIFY_EMAIL,
                    subject: `Firewalla: Internet Access Granted for ${userName}`,
                    html: `
                        <h2>Internet Access Granted</h2>
                        <p><strong>User:</strong> ${userName}</p>
                        <p><strong>Policy ID:</strong> ${pid}</p>
                        <p><strong>Duration:</strong> ${minutes} minutes</p>
                        <p><strong>Reason:</strong> ${reason}</p>
                        <p><strong>Expires At:</strong> ${result.expiresAt}</p>
                        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                        <hr>
                        <p><em>This policy will automatically re-enable after ${minutes} minutes.</em></p>
                    `
                });
                console.log(`✉️  Email sent to ${config.NOTIFY_EMAIL}`);
            } catch (emailError) {
                console.error('Failed to send email:', emailError.message);
            }
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unpause/enable a policy
app.post('/api/policies/:pid/enable', async (req, res) => {
    try {
        const { pid } = req.params;

        // Enable via bridge
        const result = await bridgeFetch(`/api/policy/${pid}/enable`, {
            method: 'POST'
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check bridge server health
app.get('/health', async (req, res) => {
    try {
        const response = await fetch(`${config.BRIDGE_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        } else {
            res.json({ status: 'disconnected', error: 'Bridge server not responding' });
        }
    } catch (error) {
        res.json({ status: 'disconnected', error: error.message });
    }
});

// Get pause history
app.get('/api/history', async (req, res) => {
    try {
        const content = await fs.readFile(config.LOG_FILE, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line);
        const history = lines
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(entry => entry !== null)
            .reverse(); // Most recent first

        res.json({ history });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({ history: [] });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Send test email
app.post('/api/test-email', async (req, res) => {
    if (!mailTransporter) {
        return res.status(400).json({ error: 'Email not configured' });
    }

    try {
        await mailTransporter.sendMail({
            from: config.GMAIL_USER,
            to: config.NOTIFY_EMAIL || config.GMAIL_USER,
            subject: 'Firewalla Time Manager - Test Email',
            html: `
                <h2>Test Email</h2>
                <p>Your email configuration is working correctly!</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `
        });
        res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Firewalla Connection Management Routes

// Upload and parse QR code
app.post('/api/firewalla/qr-upload', requireAuth, upload.single('qrImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Read image with Jimp
        const image = await Jimp.read(req.file.buffer);

        // Decode QR code
        const qrReader = new QrCode();

        const qrData = await new Promise((resolve, reject) => {
            qrReader.callback = (err, value) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(value.result);
                }
            };
            qrReader.decode(image.bitmap);
        });

        res.json({ success: true, qrData });
    } catch (error) {
        console.error('QR code parsing error:', error);
        res.status(400).json({ error: 'Failed to parse QR code. Please ensure the image contains a valid QR code.' });
    }
});

// Connect to Firewalla
app.post('/api/firewalla/connect', requireAuth, async (req, res) => {
    try {
        const { qrData, firewallIP } = req.body;

        if (!qrData || !firewallIP) {
            return res.status(400).json({ error: 'QR data and Firewalla IP are required' });
        }

        // Parse QR data (expected format: JSON with gid, seed, ek)
        let qrJson;
        try {
            qrJson = JSON.parse(qrData);
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid QR code format. Expected JSON data.' });
        }

        // Validate QR data has required fields for key generation
        if (!qrJson.gid || !qrJson.seed || !qrJson.ek) {
            return res.status(400).json({
                error: 'QR code missing required fields (gid, seed, ek). Please ensure you are using the QR code from Firewalla app Settings → Additional Pairing.'
            });
        }

        // Import node-firewalla for key generation
        const { SecureUtil } = await import('node-firewalla');

        // Generate ETP keys from seed data
        console.log('Generating ETP keys from QR code data...');
        SecureUtil.generateKeyPairFromSeed({
            eid: qrJson.gid,
            seed: qrJson.seed,
            ek: qrJson.ek
        });

        // Export keys to PEM files
        const publicKeyPath = join(__dirname, 'etp.public.pem');
        const privateKeyPath = join(__dirname, 'etp.private.pem');
        SecureUtil.exportKeyPair(publicKeyPath, privateKeyPath);
        console.log('✅ ETP keys generated and saved');

        // Update .env file with Firewalla IP and EMAIL
        await updateEnvFile({
            FIREWALLA_IP: firewallIP,
            EMAIL: 'api@firewalla.local'
        });

        // Update setup configuration with device info
        const setup = await loadSetupConfig();
        setup.firewallConfigured = true;
        setup.firewallInfo = {
            gid: qrJson.gid,
            model: qrJson.model,
            deviceName: qrJson.deviceName,
            ipAddress: firewallIP
        };
        await saveSetupConfig(setup);

        console.log('✅ Firewalla configuration saved');

        // Notify user to restart the bridge
        res.json({
            success: true,
            message: 'Firewalla connection configured successfully! Please restart the bridge server to connect.',
            requiresRestart: true,
            firewallInfo: {
                gid: qrJson.gid,
                model: qrJson.model,
                deviceName: qrJson.deviceName,
                ipAddress: firewallIP
            }
        });
    } catch (error) {
        console.error('Firewalla connection error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect from Firewalla
app.post('/api/firewalla/disconnect', requireAuth, async (req, res) => {
    try {
        // Remove ETP key files
        const publicKeyPath = join(__dirname, 'etp.public.pem');
        const privateKeyPath = join(__dirname, 'etp.private.pem');

        await fs.unlink(publicKeyPath).catch(() => {});
        await fs.unlink(privateKeyPath).catch(() => {});

        // Update setup configuration
        const setup = await loadSetupConfig();
        setup.firewallConfigured = false;
        await saveSetupConfig(setup);

        res.json({
            success: true,
            message: 'Disconnected from Firewalla',
            requiresRestart: true
        });
    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve React build static files (CSS, JS, images, etc.)
// This must come AFTER all API routes to avoid conflicts
app.use(express.static(join(__dirname, 'client', 'build')));

// Serve main page - serves React app from build directory
// All these routes serve the same React app, which handles client-side routing
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'client', 'build', 'index.html'));
});

app.get('/schedules', (req, res) => {
    res.sendFile(join(__dirname, 'client', 'build', 'index.html'));
});

app.get('/history', (req, res) => {
    res.sendFile(join(__dirname, 'client', 'build', 'index.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(join(__dirname, 'client', 'build', 'index.html'));
});

// Start server
app.listen(config.WEB_PORT, () => {
    console.log(`\n🌐 Firewalla Time Manager Web UI`);
    console.log(`   Running on http://localhost:${config.WEB_PORT}`);
    console.log(`\n📡 Bridge API: ${config.BRIDGE_URL}`);

    if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) {
        console.log(`✅ Google OAuth: Configured`);
    } else {
        console.log(`⚠️  Google OAuth: Not configured (setup required)`);
    }

    if (mailTransporter) {
        console.log(`✉️  Email notifications: Enabled (${config.GMAIL_USER})`);
        console.log(`   Sending to: ${config.NOTIFY_EMAIL || 'Not configured'}`);
    } else {
        console.log(`✉️  Email notifications: Disabled`);
    }

    console.log(`\n✨ Open http://localhost:${config.WEB_PORT} in your browser\n`);
});
