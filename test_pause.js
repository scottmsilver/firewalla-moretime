#!/usr/bin/env node

// Test script to pause policy 24 and monitor its status

const BRIDGE_URL = 'http://localhost:3002';
const WEB_URL = 'http://localhost:3003';

async function getPolicy(pid) {
    const response = await fetch(`${BRIDGE_URL}/api/init`);
    const data = await response.json();
    const policy = data.policyRules.find(p => p.pid === pid);
    return policy;
}

async function pausePolicy(pid, minutes, reason) {
    const response = await fetch(`${BRIDGE_URL}/api/policy/${pid}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
    });
    return response.json();
}

function formatTimestamp(ts) {
    if (!ts) return 'null';
    const date = new Date(ts * 1000);
    return date.toISOString().substr(11, 8) + ` (${ts})`;
}

async function monitorPolicy(pid, durationSeconds = 90) {
    console.log(`\n=== Starting Policy Monitor Test ===`);
    console.log(`Policy ID: ${pid}`);
    console.log(`Monitoring for: ${durationSeconds} seconds`);
    console.log(`Current time: ${new Date().toISOString()}\n`);

    // Get initial state
    console.log('INITIAL STATE:');
    const initialPolicy = await getPolicy(pid);
    console.log(`  disabled: ${initialPolicy.disabled}`);
    console.log(`  idleTs: ${formatTimestamp(initialPolicy.idleTs)}`);
    console.log(`  activatedTime: ${formatTimestamp(initialPolicy.activatedTime)}`);
    console.log(`  expire: ${initialPolicy.expire}`);

    // Pause the policy
    console.log(`\n--- PAUSING policy ${pid} for 1 minute ---`);
    const pauseResult = await pausePolicy(pid, 1, 'Test monitoring');
    console.log(`Pause response:`, JSON.stringify(pauseResult, null, 2));

    const startTime = Date.now();
    let iteration = 0;

    // Monitor every 5 seconds
    const intervalId = setInterval(async () => {
        iteration++;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        if (elapsed >= durationSeconds) {
            clearInterval(intervalId);
            console.log(`\n=== Monitoring Complete ===`);
            return;
        }

        try {
            const policy = await getPolicy(pid);
            const now = Math.floor(Date.now() / 1000);
            const idleTsNum = policy.idleTs ? parseInt(policy.idleTs) : null;
            const timeUntilUnpause = idleTsNum ? idleTsNum - now : null;

            console.log(`\n[${elapsed}s] Iteration ${iteration}:`);
            console.log(`  Current time: ${formatTimestamp(now)}`);
            console.log(`  disabled: ${policy.disabled === "1" ? "true" : "false"} (raw: "${policy.disabled}")`);
            console.log(`  idleTs: ${formatTimestamp(idleTsNum)}`);
            console.log(`  activatedTime: ${formatTimestamp(policy.activatedTime)}`);
            console.log(`  expire: ${policy.expire}`);

            if (timeUntilUnpause !== null) {
                if (timeUntilUnpause > 0) {
                    console.log(`  ⏱️  Time until unpause: ${timeUntilUnpause} seconds`);
                } else {
                    console.log(`  ⚠️  idleTs EXPIRED ${Math.abs(timeUntilUnpause)} seconds ago but still disabled!`);
                }
            } else if (policy.disabled === "1") {
                console.log(`  ⚠️  Policy disabled but NO idleTs set!`);
            } else {
                console.log(`  ✅ Policy is ENABLED (blocking active)`);
            }
        } catch (error) {
            console.error(`  ❌ Error fetching policy:`, error.message);
        }
    }, 5000);

    // Keep the script running
    setTimeout(() => {}, durationSeconds * 1000);
}

// Run the test
monitorPolicy('24', 90).catch(console.error);
