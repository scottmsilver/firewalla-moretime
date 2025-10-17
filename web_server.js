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

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.WEB_URL || 'http://localhost:3003'}/auth/google/callback`,
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
}

// Serve React build in production, or proxy to dev server in development
app.use(express.static(join(__dirname, 'client', 'build')));

const WEB_PORT = process.env.WEB_PORT || 3003;
const WEB_URL = process.env.WEB_URL || `http://localhost:${WEB_PORT}`;
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3002';
const LOG_FILE = process.env.LOG_FILE || 'time_extensions.log';
const SETUP_FILE = join(__dirname, 'setup.json');

// Gmail transporter
let mailTransporter = null;

function createMailTransporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_CLIENT_ID) {
        console.warn('⚠️  Gmail not configured. Email notifications will be disabled.');
        console.warn('   Set GMAIL_USER, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in .env');
        return null;
    }

    try {
        return nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.GMAIL_USER,
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN
            }
        });
    } catch (error) {
        console.error('Failed to create mail transporter:', error.message);
        return null;
    }
}

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
    const response = await fetch(`${BRIDGE_URL}${path}`, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Bridge request failed');
    }
    return response.json();
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
    const setup = await loadSetupConfig();
    res.json({
        authenticated: req.isAuthenticated(),
        user: req.user || null,
        setup: setup
    });
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

// API Routes

// Get all policies with users
app.get('/api/policies', async (req, res) => {
    try {
        const data = await bridgeFetch('/api/init');

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

        // Filter time-based policies
        const timePolicies = policyRules
            .filter(p => ['mac', 'intranet'].includes(p.type) && p.duration && p.cronTime && p.tag)
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
            await fs.appendFile(LOG_FILE, JSON.stringify(logEntry) + '\n');
        } catch (logError) {
            console.error('Failed to write to log file:', logError.message);
        }

        // Send email notification
        if (mailTransporter && process.env.NOTIFY_EMAIL) {
            try {
                await mailTransporter.sendMail({
                    from: process.env.GMAIL_USER,
                    to: process.env.NOTIFY_EMAIL,
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
                console.log(`✉️  Email sent to ${process.env.NOTIFY_EMAIL}`);
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

// Get pause history
app.get('/api/history', async (req, res) => {
    try {
        const content = await fs.readFile(LOG_FILE, 'utf-8');
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
            from: process.env.GMAIL_USER,
            to: process.env.NOTIFY_EMAIL || process.env.GMAIL_USER,
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

        // Parse QR data (expected format: JSON with ETP keys)
        let qrJson;
        try {
            qrJson = JSON.parse(qrData);
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid QR code format. Expected JSON data.' });
        }

        // Extract ETP keys from QR data
        if (!qrJson.publicKey || !qrJson.privateKey) {
            return res.status(400).json({ error: 'QR code missing required keys (publicKey, privateKey)' });
        }

        // Save ETP keys to files
        const publicKeyPath = join(__dirname, 'etp.public.pem');
        const privateKeyPath = join(__dirname, 'etp.private.pem');

        await fs.writeFile(publicKeyPath, qrJson.publicKey);
        await fs.writeFile(privateKeyPath, qrJson.privateKey);

        // Update .env file with Firewalla IP
        const envPath = join(__dirname, '.env');
        let envContent = await fs.readFile(envPath, 'utf-8').catch(() => '');

        // Update or add FIREWALLA_IP
        if (envContent.includes('FIREWALLA_IP=')) {
            envContent = envContent.replace(/FIREWALLA_IP=.*/g, `FIREWALLA_IP=${firewallIP}`);
        } else {
            envContent += `\nFIREWALLA_IP=${firewallIP}\n`;
        }

        await fs.writeFile(envPath, envContent);

        // Update setup configuration
        const setup = await loadSetupConfig();
        setup.firewallConfigured = true;
        await saveSetupConfig(setup);

        // Notify user to restart the bridge
        res.json({
            success: true,
            message: 'Firewalla connection configured. Please restart the bridge server to connect.',
            requiresRestart: true
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

// Serve main page - serves React app from build directory
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'client', 'build', 'index.html'));
});

// Start server
app.listen(WEB_PORT, () => {
    console.log(`\n🌐 Firewalla Time Manager Web UI`);
    console.log(`   Running on http://localhost:${WEB_PORT}`);
    console.log(`\n📡 Bridge API: ${BRIDGE_URL}`);

    if (mailTransporter) {
        console.log(`✉️  Email notifications: Enabled (${process.env.GMAIL_USER})`);
        console.log(`   Sending to: ${process.env.NOTIFY_EMAIL || 'Not configured'}`);
    } else {
        console.log(`✉️  Email notifications: Disabled`);
    }

    console.log(`\n✨ Open http://localhost:${WEB_PORT} in your browser\n`);
});
