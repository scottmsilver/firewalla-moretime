#!/usr/bin/env node
/**
 * QR Code Parser Tests
 *
 * Unit tests for the jsQR-based QR code parsing functionality
 */

import { testQRCode } from '../test_qr_parser.js';
import QRCode from 'qrcode';
import { Jimp } from 'jimp';
import fs from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test data that mimics Firewalla QR code structure
const SAMPLE_FIREWALLA_QR = {
    gid: 'abc123def456ghi789jkl012mno345pqr',
    seed: 'test_seed_value_123456789',
    ek: 'test_encryption_key_987654321',
    model: 'Gold',
    deviceName: 'Test Firewalla Device'
};

async function generateTestQRCode(data, filename) {
    try {
        const qrString = JSON.stringify(data);
        const qrBuffer = await QRCode.toBuffer(qrString, {
            errorCorrectionLevel: 'M',
            type: 'png',
            width: 400,
            margin: 4
        });

        const filepath = join(__dirname, filename);
        await fs.writeFile(filepath, qrBuffer);
        console.log(`✅ Generated test QR code: ${filepath}`);
        return filepath;
    } catch (error) {
        console.error(`❌ Failed to generate QR code: ${error.message}`);
        throw error;
    }
}

async function runTests() {
    console.log('\n🧪 QR Code Parser Test Suite');
    console.log('═'.repeat(60));

    const tests = [];
    let passed = 0;
    let failed = 0;

    // Test 1: Valid Firewalla QR Code
    console.log('\n📝 Test 1: Valid Firewalla QR Code');
    try {
        const qrPath = await generateTestQRCode(SAMPLE_FIREWALLA_QR, 'test-firewalla-qr.png');
        const result = await testQRCode(qrPath);

        if (result.success && result.data.gid === SAMPLE_FIREWALLA_QR.gid) {
            console.log('✅ PASS: Successfully parsed Firewalla QR code');
            passed++;
        } else {
            console.log('❌ FAIL: QR code parsing failed or data mismatch');
            failed++;
        }

        // Cleanup
        await fs.unlink(qrPath);
        tests.push({ name: 'Valid Firewalla QR', passed: result.success });
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
        tests.push({ name: 'Valid Firewalla QR', passed: false });
    }

    // Test 2: Simple text QR Code
    console.log('\n📝 Test 2: Simple Text QR Code');
    try {
        const simpleData = { message: 'Hello from Firewalla' };
        const qrPath = await generateTestQRCode(simpleData, 'test-simple-qr.png');
        const result = await testQRCode(qrPath);

        if (result.success && result.data.message === 'Hello from Firewalla') {
            console.log('✅ PASS: Successfully parsed simple QR code');
            passed++;
        } else {
            console.log('❌ FAIL: Simple QR code parsing failed');
            failed++;
        }

        await fs.unlink(qrPath);
        tests.push({ name: 'Simple Text QR', passed: result.success });
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
        tests.push({ name: 'Simple Text QR', passed: false });
    }

    // Test 3: Large QR Code (high resolution)
    console.log('\n📝 Test 3: Large High-Resolution QR Code');
    try {
        const qrString = JSON.stringify(SAMPLE_FIREWALLA_QR);
        const qrBuffer = await QRCode.toBuffer(qrString, {
            errorCorrectionLevel: 'H',
            type: 'png',
            width: 1000,
            margin: 4
        });

        const qrPath = join(__dirname, 'test-large-qr.png');
        await fs.writeFile(qrPath, qrBuffer);

        const result = await testQRCode(qrPath);

        if (result.success && result.data.gid === SAMPLE_FIREWALLA_QR.gid) {
            console.log('✅ PASS: Successfully parsed large QR code');
            passed++;
        } else {
            console.log('❌ FAIL: Large QR code parsing failed');
            failed++;
        }

        await fs.unlink(qrPath);
        tests.push({ name: 'Large QR Code', passed: result.success });
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
        tests.push({ name: 'Large QR Code', passed: false });
    }

    // Test 4: Invalid file (no QR code)
    console.log('\n📝 Test 4: Image without QR Code');
    try {
        // Create a blank image
        const blankImage = await new Jimp({ width: 400, height: 400, color: 0xFFFFFFFF });
        const blankPath = join(__dirname, 'test-blank.png');
        await blankImage.write(blankPath);

        const result = await testQRCode(blankPath);

        // Should fail because there's no QR code
        if (!result.success) {
            console.log('✅ PASS: Correctly rejected image without QR code');
            passed++;
        } else {
            console.log('❌ FAIL: Should have rejected blank image');
            failed++;
        }

        await fs.unlink(blankPath);
        tests.push({ name: 'Blank Image', passed: !result.success });
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
        tests.push({ name: 'Blank Image', passed: false });
    }

    // Test 5: Missing required Firewalla fields
    console.log('\n📝 Test 5: QR Code with Missing Fields');
    try {
        const incompleteData = {
            gid: 'test123',
            // Missing seed and ek
        };
        const qrPath = await generateTestQRCode(incompleteData, 'test-incomplete-qr.png');
        const result = await testQRCode(qrPath);

        // Parser should still succeed, but app validation would catch this
        if (result.success && !result.data.seed && !result.data.ek) {
            console.log('✅ PASS: Parsed incomplete QR code (validation would happen in app)');
            passed++;
        } else {
            console.log('❌ FAIL: Incomplete QR code test failed');
            failed++;
        }

        await fs.unlink(qrPath);
        tests.push({ name: 'Incomplete QR', passed: result.success });
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
        tests.push({ name: 'Incomplete QR', passed: false });
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Results Summary');
    console.log('═'.repeat(60));

    tests.forEach(test => {
        const icon = test.passed ? '✅' : '❌';
        console.log(`${icon} ${test.name}`);
    });

    console.log(`\n📈 Total: ${tests.length} tests, ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log('\n🎉 All tests passed!');
        return 0;
    } else {
        console.log(`\n⚠️  ${failed} test(s) failed`);
        return 1;
    }
}

// Run tests
runTests().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
