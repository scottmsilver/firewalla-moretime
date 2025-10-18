#!/usr/bin/env node
/**
 * QR Code Validation Tests
 *
 * Tests that validate QR code structure and data for Firewalla connection
 */

import { testQRCode } from '../test_qr_parser.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Validate that QR code contains required Firewalla fields
 */
function validateFirewallaQRData(data) {
    const errors = [];
    const warnings = [];

    // Required fields for ETP connection
    const requiredFields = ['gid', 'seed', 'ek'];
    for (const field of requiredFields) {
        if (!data[field]) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    // Optional but useful fields
    const optionalFields = ['model', 'deviceName', 'ipaddress'];
    for (const field of optionalFields) {
        if (!data[field]) {
            warnings.push(`Missing optional field: ${field}`);
        }
    }

    // Validate data types and formats
    if (data.gid && typeof data.gid !== 'string') {
        errors.push('gid must be a string');
    }

    if (data.seed && typeof data.seed !== 'string') {
        errors.push('seed must be a string');
    }

    if (data.ek && typeof data.ek !== 'string') {
        errors.push('ek must be a string');
    }

    // Check if data looks like it might be expired
    if (data.exp) {
        const expTimestamp = parseInt(data.exp);
        if (!isNaN(expTimestamp)) {
            const expDate = new Date(expTimestamp * 1000);
            const now = new Date();

            if (expDate < now) {
                warnings.push(`QR code appears to be expired (exp: ${expDate.toISOString()})`);
            }
        }
    }

    return { valid: errors.length === 0, errors, warnings };
}

async function runValidationTests() {
    console.log('\n🧪 QR Code Validation Test Suite');
    console.log('═'.repeat(60));

    const testImages = [
        join(__dirname, 'fixtures/qr-test-1.jpeg'),
        join(__dirname, 'fixtures/qr-test-2.png'),
    ];

    let allPassed = true;

    for (const imagePath of testImages) {
        const basename = imagePath.split('/').pop();
        console.log(`\n📋 Validating: ${basename}`);
        console.log('─'.repeat(60));

        // Parse the QR code
        const result = await testQRCode(imagePath);

        if (!result.success) {
            console.log(`❌ Failed to parse QR code: ${result.error}`);
            allPassed = false;
            continue;
        }

        // Validate the data
        const validation = validateFirewallaQRData(result.data);

        if (validation.valid) {
            console.log('✅ QR code contains all required fields');
        } else {
            console.log('❌ QR code validation failed:');
            validation.errors.forEach(err => console.log(`   • ${err}`));
            allPassed = false;
        }

        if (validation.warnings.length > 0) {
            console.log('⚠️  Warnings:');
            validation.warnings.forEach(warn => console.log(`   • ${warn}`));
        }

        // Display field summary
        console.log('\n📊 Field Summary:');
        console.log(`   • GID: ${result.data.gid ? '✅' : '❌'} ${result.data.gid?.substring(0, 20)}...`);
        console.log(`   • Seed: ${result.data.seed ? '✅' : '❌'} ${result.data.seed?.substring(0, 20)}...`);
        console.log(`   • EK: ${result.data.ek ? '✅' : '❌'} ${result.data.ek?.substring(0, 20)}...`);
        console.log(`   • Model: ${result.data.model || '(not set)'}`);
        console.log(`   • Device Name: ${result.data.deviceName || '(not set)'}`);
        console.log(`   • IP Address: ${result.data.ipaddress || '(not set)'}`);

        if (result.data.exp) {
            const expDate = new Date(parseInt(result.data.exp) * 1000);
            console.log(`   • Expires: ${expDate.toISOString()}`);
        }
    }

    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
        console.log('✅ All QR codes are valid for Firewalla connection');
        console.log('\n📝 Note: Even if QR codes are valid, they may be expired.');
        console.log('   To test actual connection, you need a fresh QR code from');
        console.log('   Firewalla app Settings → Additional Pairing');
        return 0;
    } else {
        console.log('❌ Some QR codes failed validation');
        return 1;
    }
}

// Run tests
runValidationTests().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
