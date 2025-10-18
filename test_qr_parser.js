#!/usr/bin/env node
/**
 * Test QR Code Parser
 *
 * Tests the jsQR library with uploaded images to verify QR code parsing works
 */

import jsQR from 'jsqr';
import { Jimp } from 'jimp';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testQRCode(imagePath) {
    try {
        console.log(`\n📷 Testing: ${imagePath}`);
        console.log('━'.repeat(60));

        // Check if file exists
        try {
            await fs.access(imagePath);
        } catch {
            console.error(`❌ File not found: ${imagePath}`);
            return { success: false, error: 'File not found' };
        }

        // Read file info
        const stats = await fs.stat(imagePath);
        console.log(`📊 File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);

        // Read image with Jimp
        const startTime = Date.now();
        const image = await Jimp.read(imagePath);
        const loadTime = Date.now() - startTime;
        console.log(`📐 Dimensions: ${image.bitmap.width} x ${image.bitmap.height}`);
        console.log(`⏱️  Load time: ${loadTime}ms`);

        // Convert to format jsQR expects
        const { width, height } = image.bitmap;
        const imageData = new Uint8ClampedArray(width * height * 4);

        for (let i = 0; i < image.bitmap.data.length; i++) {
            imageData[i] = image.bitmap.data[i];
        }

        // Try decoding
        console.log('🔍 Attempting to decode QR code...');
        const decodeStart = Date.now();
        const qrResult = jsQR(imageData, width, height);
        const decodeTime = Date.now() - decodeStart;
        console.log(`⏱️  Decode time: ${decodeTime}ms`);

        if (!qrResult) {
            console.error('❌ No QR code detected');
            return { success: false, error: 'No QR code detected' };
        }

        console.log('✅ QR code decoded successfully!');
        console.log(`📦 Data length: ${qrResult.data.length} characters`);

        // Try to parse as JSON
        try {
            const parsed = JSON.parse(qrResult.data);
            console.log('📋 Parsed JSON:');
            console.log(`   - Keys: ${Object.keys(parsed).join(', ')}`);

            // Check for Firewalla-specific fields
            if (parsed.gid) console.log(`   - GID: ${parsed.gid.substring(0, 12)}...`);
            if (parsed.seed) console.log(`   - Seed: ${parsed.seed.substring(0, 12)}...`);
            if (parsed.ek) console.log(`   - EK: ${parsed.ek.substring(0, 12)}...`);
            if (parsed.model) console.log(`   - Model: ${parsed.model}`);
            if (parsed.deviceName) console.log(`   - Device: ${parsed.deviceName}`);

            return { success: true, data: parsed };
        } catch (parseError) {
            console.log('📄 Raw data (not JSON):');
            console.log(`   ${qrResult.data.substring(0, 100)}${qrResult.data.length > 100 ? '...' : ''}`);
            return { success: true, data: qrResult.data };
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('\n🧪 QR Code Parser Test Suite');
    console.log('═'.repeat(60));

    const testImages = [
        join(__dirname, 'test/fixtures/qr-test-1.jpeg'),  // 815 x 844 (previously failed)
        join(__dirname, 'test/fixtures/qr-test-2.png'),   // 1080 x 2410 (previously failed)
    ];

    // Also check for any other test images in common locations
    const additionalTests = [
        join(__dirname, 'test-qr.png'),
        join(__dirname, 'qr-test.jpg'),
    ];

    const results = [];

    // Test the uploaded images
    for (const imagePath of testImages) {
        const result = await testQRCode(imagePath);
        results.push({ path: imagePath, ...result });
    }

    // Test additional images if they exist
    for (const imagePath of additionalTests) {
        try {
            await fs.access(imagePath);
            const result = await testQRCode(imagePath);
            results.push({ path: imagePath, ...result });
        } catch {
            // Skip if file doesn't exist
        }
    }

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 Test Summary');
    console.log('═'.repeat(60));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        const basename = result.path.split('/').pop();
        console.log(`${status} ${basename}: ${result.success ? 'SUCCESS' : result.error}`);
    });

    console.log(`\n📈 Total: ${results.length} tests, ${successful} passed, ${failed} failed`);

    if (successful > 0) {
        console.log('\n✨ QR code parsing is working!');
    } else {
        console.log('\n⚠️  No QR codes could be parsed. Images may not contain valid QR codes.');
    }

    return results;
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Check for command line arguments
    if (process.argv.length > 2) {
        // Test specific file(s)
        for (let i = 2; i < process.argv.length; i++) {
            await testQRCode(process.argv[i]);
        }
    } else {
        // Run full test suite
        await runTests();
    }
}

export { testQRCode };
