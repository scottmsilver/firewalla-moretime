#!/usr/bin/env node

// Debug tool to dump detailed information about a specific policy

import fs from 'fs';

const BRIDGE_URL = 'http://localhost:3002';
const WEB_URL = 'http://localhost:3003';

function formatTimestamp(ts) {
    if (!ts || ts === 'null' || ts === null) return 'null';
    const num = typeof ts === 'string' ? parseInt(ts) : ts;
    if (isNaN(num)) return 'invalid';
    const date = new Date(num * 1000);
    return `${date.toLocaleTimeString()} (${num})`;
}

function formatBoolean(val) {
    if (val === '1' || val === 1 || val === true) return 'true';
    if (val === '0' || val === 0 || val === false) return 'false';
    return `${val} (type: ${typeof val})`;
}

async function debugPolicy(pid) {
    console.log('\n' + '='.repeat(80));
    console.log(`POLICY DEBUG TOOL - Policy ID: ${pid}`);
    console.log('='.repeat(80));
    console.log(`Current time: ${new Date().toLocaleString()}`);
    console.log(`Unix timestamp: ${Math.floor(Date.now() / 1000)}`);
    console.log('='.repeat(80));

    try {
        // Fetch from Bridge API
        console.log('\n[1] BRIDGE API (http://localhost:3002/api/init)');
        console.log('-'.repeat(80));
        const bridgeResponse = await fetch(`${BRIDGE_URL}/api/init`);
        if (!bridgeResponse.ok) {
            console.log(`❌ ERROR: ${bridgeResponse.status} ${bridgeResponse.statusText}`);
        } else {
            const bridgeData = await bridgeResponse.json();
            const bridgePolicy = bridgeData.policyRules.find(p => p.pid === pid);

            if (!bridgePolicy) {
                console.log(`❌ Policy ${pid} NOT FOUND in bridge API`);
            } else {
                console.log('✓ Policy found');
                console.log('\nCore Fields:');
                console.log(`  pid:           ${bridgePolicy.pid}`);
                console.log(`  disabled:      ${formatBoolean(bridgePolicy.disabled)}`);
                console.log(`  action:        ${bridgePolicy.action}`);
                console.log(`  type:          ${bridgePolicy.type}`);

                console.log('\nTiming Fields:');
                console.log(`  idleTs:        ${formatTimestamp(bridgePolicy.idleTs)}`);
                console.log(`  activatedTime: ${formatTimestamp(bridgePolicy.activatedTime)}`);
                console.log(`  expire:        ${bridgePolicy.expire || 'null'}`);
                console.log(`  cronTime:      ${bridgePolicy.cronTime}`);
                console.log(`  duration:      ${bridgePolicy.duration} seconds`);

                console.log('\nSchedule Info:');
                if (bridgePolicy.cronTime) {
                    const parts = bridgePolicy.cronTime.split(' ');
                    const minute = parts[0];
                    const hour = parts[1];
                    console.log(`  Blocks at:     ${hour}:${minute.padStart(2, '0')}`);
                    console.log(`  For:           ${Math.floor(bridgePolicy.duration / 3600)}h ${Math.floor((bridgePolicy.duration % 3600) / 60)}m`);
                }

                console.log('\nOther Fields:');
                console.log(`  tag:           ${JSON.stringify(bridgePolicy.tag || [])}`);
                console.log(`  target:        ${bridgePolicy.target}`);
                console.log(`  hitCount:      ${bridgePolicy.hitCount || 0}`);

                // Calculate countdown if paused
                if (bridgePolicy.disabled && bridgePolicy.idleTs) {
                    const idleTsNum = typeof bridgePolicy.idleTs === 'string' ? parseInt(bridgePolicy.idleTs) : bridgePolicy.idleTs;
                    const now = Math.floor(Date.now() / 1000);
                    const secondsLeft = idleTsNum - now;
                    const minutesLeft = Math.ceil(secondsLeft / 60);

                    console.log('\n⏱️  COUNTDOWN CALCULATION:');
                    console.log(`  Time until unpause: ${minutesLeft} minutes (${secondsLeft} seconds)`);
                    if (secondsLeft <= 0) {
                        console.log(`  ⚠️  WARNING: idleTs expired ${Math.abs(secondsLeft)} seconds ago!`);
                    }
                }

                console.log('\nRaw JSON:');
                console.log(JSON.stringify(bridgePolicy, null, 2));
            }
        }

        // Fetch from Web Server API
        console.log('\n[2] WEB SERVER API (http://localhost:3003/api/policies)');
        console.log('-'.repeat(80));
        const webResponse = await fetch(`${WEB_URL}/api/policies`);
        if (!webResponse.ok) {
            console.log(`❌ ERROR: ${webResponse.status} ${webResponse.statusText}`);
        } else {
            const webData = await webResponse.json();
            const webPolicy = webData.policies.find(p => p.pid === pid);

            if (!webPolicy) {
                console.log(`❌ Policy ${pid} NOT FOUND in web server API`);
            } else {
                console.log('✓ Policy found');
                console.log('\nCore Fields:');
                console.log(`  pid:           ${webPolicy.pid} (type: ${typeof webPolicy.pid})`);
                console.log(`  disabled:      ${formatBoolean(webPolicy.disabled)}`);
                console.log(`  action:        ${webPolicy.action}`);
                console.log(`  type:          ${webPolicy.type}`);

                console.log('\nTiming Fields:');
                console.log(`  idleTs:        ${formatTimestamp(webPolicy.idleTs)}`);
                console.log(`  activatedTime: ${formatTimestamp(webPolicy.activatedTime)}`);
                console.log(`  expire:        ${webPolicy.expire || 'null'}`);
                console.log(`  cronTime:      ${webPolicy.cronTime}`);
                console.log(`  duration:      ${webPolicy.duration} seconds`);

                console.log('\nUsers:');
                if (webPolicy.users && webPolicy.users.length > 0) {
                    webPolicy.users.forEach((user, i) => {
                        console.log(`  [${i}] ${user.name} (${user.mac})`);
                    });
                }

                // Calculate countdown if paused
                if (webPolicy.disabled && webPolicy.idleTs) {
                    const now = Math.floor(Date.now() / 1000);
                    const secondsLeft = webPolicy.idleTs - now;
                    const minutesLeft = Math.ceil(secondsLeft / 60);
                    const expiresAt = new Date(webPolicy.idleTs * 1000);

                    console.log('\n⏱️  COUNTDOWN CALCULATION:');
                    console.log(`  Current time:       ${new Date().toLocaleTimeString()}`);
                    console.log(`  Expires at:         ${expiresAt.toLocaleTimeString()}`);
                    console.log(`  Time until unpause: ${minutesLeft} min (${secondsLeft} sec)`);
                    console.log(`  Should show countdown: ${minutesLeft > 0 ? 'YES ✓' : 'NO (expired)'}`);

                    if (secondsLeft <= 0) {
                        console.log(`  ⚠️  WARNING: idleTs expired ${Math.abs(secondsLeft)} seconds ago!`);
                    }
                }

                console.log('\nRaw JSON:');
                console.log(JSON.stringify(webPolicy, null, 2));
            }
        }

        // Check history log
        console.log('\n[3] HISTORY LOG (time_extensions.log)');
        console.log('-'.repeat(80));
        try {
            const logContent = fs.readFileSync('/home/ssilver/development/fw/time_extensions.log', 'utf-8');
            const lines = logContent.trim().split('\n').filter(line => line.trim());
            const policyLogs = lines
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(log => log && log.policy_id === pid);

            if (policyLogs.length === 0) {
                console.log(`No history entries found for policy ${pid}`);
            } else {
                console.log(`Found ${policyLogs.length} history entries:`);
                policyLogs.slice(-5).forEach((log, i) => {
                    console.log(`\n  [${policyLogs.length - 5 + i + 1}] ${log.timestamp}`);
                    console.log(`      Action:   ${log.action}`);
                    console.log(`      Duration: ${log.duration_minutes} minutes`);
                    console.log(`      Expires:  ${new Date(log.expires_at).toLocaleString()}`);
                    if (log.reason) {
                        console.log(`      Reason:   ${log.reason}`);
                    }
                });

                if (policyLogs.length > 5) {
                    console.log(`\n  ... and ${policyLogs.length - 5} more entries`);
                }

                // Show most recent
                const latest = policyLogs[policyLogs.length - 1];
                console.log('\n  Most recent entry:');
                console.log(`    Time:     ${latest.timestamp}`);
                console.log(`    Expires:  ${latest.expires_at}`);
                const expiresDate = new Date(latest.expires_at);
                const now = new Date();
                const hasExpired = now > expiresDate;
                console.log(`    Status:   ${hasExpired ? 'EXPIRED ⏰' : 'ACTIVE ⏱️ '}`);
            }
        } catch (err) {
            console.log(`Error reading history log: ${err.message}`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('DEBUG COMPLETE');
        console.log('='.repeat(80) + '\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error(error.stack);
    }
}

// Get policy ID from command line args
const pid = process.argv[2];
if (!pid) {
    console.error('Usage: node debug_policy.js <policy_id>');
    console.error('Example: node debug_policy.js 24');
    process.exit(1);
}

debugPolicy(pid).catch(console.error);
