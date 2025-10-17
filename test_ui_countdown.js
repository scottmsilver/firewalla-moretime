#!/usr/bin/env node

// Test script to check if the UI is showing countdown properly

const BRIDGE_URL = 'http://localhost:3002';
const WEB_URL = 'http://localhost:3003';

async function checkUIData() {
    console.log('\n=== Checking UI Countdown Data ===\n');

    // Check bridge API
    console.log('1. Bridge API (http://localhost:3002/api/init):');
    const bridgeResponse = await fetch(`${BRIDGE_URL}/api/init`);
    const bridgeData = await bridgeResponse.json();
    const bridgePolicy = bridgeData.policyRules.find(p => p.pid === '24');
    console.log('   Policy 24 from bridge:');
    console.log(`     disabled: ${bridgePolicy.disabled}`);
    console.log(`     idleTs: ${bridgePolicy.idleTs}`);

    // Check web server API
    console.log('\n2. Web Server API (http://localhost:3003/api/policies):');
    const webResponse = await fetch(`${WEB_URL}/api/policies`);
    const webData = await webResponse.json();
    const webPolicy = webData.policies.find(p => p.pid === '24');
    console.log('   Policy 24 from web server:');
    console.log(`     disabled: ${webPolicy.disabled} (type: ${typeof webPolicy.disabled})`);
    console.log(`     idleTs: ${webPolicy.idleTs} (type: ${typeof webPolicy.idleTs})`);

    // Calculate what the UI should show
    if (webPolicy.disabled && webPolicy.idleTs) {
        const expiresAt = new Date(webPolicy.idleTs * 1000);
        const now = Date.now();
        const minutesLeft = Math.ceil((expiresAt.getTime() - now) / 60000);

        console.log('\n3. Countdown Calculation:');
        console.log(`     Current time: ${new Date().toLocaleTimeString()}`);
        console.log(`     Expires at: ${expiresAt.toLocaleTimeString()}`);
        console.log(`     Minutes left: ${minutesLeft}`);
        console.log(`     Should show countdown: ${minutesLeft > 0 ? 'YES' : 'NO'}`);
    } else {
        console.log('\n3. Countdown Calculation:');
        console.log(`     Should show countdown: NO (disabled=${webPolicy.disabled}, idleTs=${webPolicy.idleTs})`);
    }

    console.log('\n=== Summary ===');
    console.log('The UI should be receiving the correct data to display the countdown.');
    console.log('If the countdown is not showing in the browser, possible causes:');
    console.log('  1. React hot reload not picking up component changes - try hard refresh (Ctrl+Shift+R)');
    console.log('  2. Component state not updating - check browser console for errors');
    console.log('  3. CSS hiding the countdown box - inspect element in browser DevTools');
}

checkUIData().catch(console.error);
