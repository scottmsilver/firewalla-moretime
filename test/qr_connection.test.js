#!/usr/bin/env node
/**
 * QR Code Connection Tests
 *
 * Tests the full QR code connection flow including parsing, validation, and pairing
 */

import { SecureUtil, FWGroupApi, NetworkService } from 'node-firewalla';
import { testQRCode } from '../test_qr_parser.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Test QR code connection flow
 */
async function testQRConnection(imagePath, firewallIP = '192.168.1.129') {
    const basename = imagePath.split('/').pop();
    console.log(`\n🔗 Testing Connection: ${basename}`);
    console.log('═'.repeat(60));

    try {
        // Step 1: Parse QR code
        console.log('\n📷 Step 1: Parsing QR code...');
        const parseResult = await testQRCode(imagePath);

        if (!parseResult.success) {
            console.log(`❌ FAIL: QR parsing failed - ${parseResult.error}`);
            return { success: false, stage: 'parse', error: parseResult.error };
        }

        console.log('✅ QR code parsed successfully');
        const qrData = parseResult.data;

        // Step 2: Validate required fields
        console.log('\n✓ Step 2: Validating QR code fields...');
        const requiredFields = ['gid', 'seed', 'license', 'ek', 'ipaddress'];
        const missingFields = [];

        for (const field of requiredFields) {
            if (!qrData[field]) {
                missingFields.push(field);
            }
        }

        if (missingFields.length > 0) {
            console.log(`❌ FAIL: Missing required fields: ${missingFields.join(', ')}`);
            return { success: false, stage: 'validate', error: `Missing fields: ${missingFields.join(', ')}` };
        }

        console.log('✅ All required fields present');

        // Step 3: Check expiration
        if (qrData.exp) {
            const expDate = new Date(parseInt(qrData.exp) * 1000);
            const now = new Date();

            console.log(`\n⏰ QR Code Expiration: ${expDate.toISOString()}`);
            console.log(`   Current Time:       ${now.toISOString()}`);

            if (expDate < now) {
                const expiredMinutes = Math.floor((now - expDate) / 1000 / 60);
                console.log(`⚠️  WARNING: QR code expired ${expiredMinutes} minutes ago`);
                console.log('   This connection attempt will likely fail');
            } else {
                console.log('✅ QR code is still valid');
            }
        }

        // Step 4: Generate keypair
        console.log('\n🔐 Step 3: Generating ETP keypair...');
        SecureUtil.regenerateKeyPair();
        console.log('✅ Keypair generated');

        // Step 5: Attempt to join group
        console.log(`\n📡 Step 4: Attempting to join Firewalla group...`);
        console.log(`   GID: ${qrData.gid}`);
        console.log(`   IP:  ${firewallIP}`);
        console.log(`   Email: test@example.com`);

        const fwGroup = await FWGroupApi.joinGroup(qrData, 'test@example.com', firewallIP);

        console.log('✅ Successfully joined group!');

        // Step 6: Test connection
        console.log('\n🌐 Step 5: Testing connection with ping...');
        const nwService = new NetworkService(fwGroup);
        await nwService.ping();

        console.log('✅ Connection test successful!');

        // Step 7: Get access token
        console.log('\n🎫 Step 6: Getting access token...');
        const { access_token } = await FWGroupApi.login('test@example.com');

        console.log('✅ Access token obtained');
        console.log(`   Token: ${access_token.substring(0, 20)}...`);

        // Success!
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 SUCCESS: Full connection flow completed!');
        console.log('═'.repeat(60));

        return {
            success: true,
            stage: 'complete',
            accessToken: access_token,
            gid: qrData.gid
        };

    } catch (error) {
        console.log('\n' + '═'.repeat(60));
        console.log('❌ FAIL: Connection attempt failed');
        console.log('═'.repeat(60));
        console.log(`\nError: ${error.message}`);

        // Try to identify the failure stage
        let stage = 'unknown';
        if (error.message?.includes('expired') || error.message?.includes('QR')) {
            stage = 'join_group';
        } else if (error.message?.includes('ping') || error.message?.includes('timeout')) {
            stage = 'network_test';
        } else if (error.message?.includes('token') || error.message?.includes('login')) {
            stage = 'authentication';
        }

        console.log(`   Stage: ${stage}`);
        console.log(`   Type: ${error.constructor.name}`);

        if (error.stack) {
            console.log('\nStack trace:');
            console.log(error.stack.split('\n').slice(0, 5).join('\n'));
        }

        return {
            success: false,
            stage,
            error: error.message,
            errorType: error.constructor.name
        };
    }
}

/**
 * Run connection tests on fixture images
 */
async function runConnectionTests() {
    console.log('\n🧪 QR Code Connection Test Suite');
    console.log('═'.repeat(60));

    const testImages = [
        {
            path: join(__dirname, 'fixtures/qr-test-1.jpeg'),
            description: 'QR Test 1 (815x844, JPEG)',
            expectedFailure: true,
            expectedReason: 'QR code expired'
        },
        {
            path: join(__dirname, 'fixtures/qr-test-2.png'),
            description: 'QR Test 2 (1080x2410, PNG)',
            expectedFailure: true,
            expectedReason: 'QR code expired'
        }
    ];

    const results = [];

    for (const test of testImages) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`📋 Test: ${test.description}`);
        console.log(`   Expected: ${test.expectedFailure ? 'FAIL' : 'SUCCESS'}`);
        console.log(`   Reason: ${test.expectedReason || 'N/A'}`);

        const result = await testQRConnection(test.path);
        results.push({
            ...test,
            result
        });

        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 Test Summary');
    console.log('═'.repeat(60));

    results.forEach((test, index) => {
        const testNum = index + 1;
        const basename = test.path.split('/').pop();
        const actualOutcome = test.result.success ? 'SUCCESS' : 'FAIL';
        const expectedOutcome = test.expectedFailure ? 'FAIL' : 'SUCCESS';
        const testPassed = actualOutcome === expectedOutcome;

        const icon = testPassed ? '✅' : '❌';
        console.log(`\n${icon} Test ${testNum}: ${basename}`);
        console.log(`   Expected: ${expectedOutcome} (${test.expectedReason})`);
        console.log(`   Actual:   ${actualOutcome}`);

        if (test.result.error) {
            console.log(`   Error:    ${test.result.error}`);
        }

        console.log(`   Stage:    ${test.result.stage}`);
        console.log(`   Result:   ${testPassed ? 'PASS ✓' : 'UNEXPECTED OUTCOME ✗'}`);
    });

    const allPassed = results.every(test => {
        const actualOutcome = test.result.success ? 'SUCCESS' : 'FAIL';
        const expectedOutcome = test.expectedFailure ? 'FAIL' : 'SUCCESS';
        return actualOutcome === expectedOutcome;
    });

    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
        console.log('✅ All tests behaved as expected!');
        console.log('\n📝 Note: Both QR codes are expired, so connection failures are expected.');
        console.log('   To test successful connection, use a fresh QR code from the Firewalla app.');
        return 0;
    } else {
        console.log('⚠️  Some tests had unexpected outcomes');
        return 1;
    }
}

// Run tests
runConnectionTests().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
