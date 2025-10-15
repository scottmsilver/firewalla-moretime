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

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const WEB_PORT = process.env.WEB_PORT || 3003;
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3002';
const LOG_FILE = process.env.LOG_FILE || 'time_extensions.log';

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

// Helper function to fetch from bridge
async function bridgeFetch(path, options = {}) {
    const response = await fetch(`${BRIDGE_URL}${path}`, options);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || 'Bridge request failed');
    }
    return response.json();
}

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
                    expire: p.expire ? parseInt(p.expire) : null
                };
            });

        res.json({
            policies: timePolicies,
            serverTime: new Date().toISOString()
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

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
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
