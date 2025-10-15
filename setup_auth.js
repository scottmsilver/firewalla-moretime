#!/usr/bin/env node
/**
 * Firewalla Authentication Setup
 *
 * This script generates ETP (Endpoint Token Pair) keys from a QR code
 * provided by the Firewalla app's "Additional Pairing" feature.
 *
 * Usage:
 *   1. In Firewalla app: Settings → Additional Pairing → Take screenshot
 *   2. Copy screenshot to this directory (e.g., qr_code.png)
 *   3. Run: node setup_auth.js <path-to-qr-image>
 *
 * This will generate:
 *   - etp.private.pem
 *   - etp.public.pem
 */

import { SecureUtil } from 'node-firewalla';
import { readFileSync, existsSync } from 'fs';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

// Check command line arguments
if (process.argv.length < 3) {
    console.error('Usage: node setup_auth.js <qr-code-image.png>');
    console.error('\nSteps to get QR code:');
    console.error('  1. Open Firewalla mobile app');
    console.error('  2. Go to Settings → Additional Pairing');
    console.error('  3. Take a screenshot of the QR code');
    console.error('  4. Copy the screenshot to this directory');
    console.error('  5. Run this script with the image path');
    process.exit(1);
}

const qrImagePath = process.argv[2];

// Check if file exists
if (!existsSync(qrImagePath)) {
    console.error(`Error: File not found: ${qrImagePath}`);
    process.exit(1);
}

// Check if keys already exist
if (existsSync('etp.private.pem') || existsSync('etp.public.pem')) {
    console.warn('⚠️  Warning: ETP keys already exist!');
    console.warn('   - etp.private.pem');
    console.warn('   - etp.public.pem');
    console.warn('\nIf you continue, these files will be OVERWRITTEN.');
    console.warn('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
}

console.log('Reading QR code image...');

try {
    // Read the PNG file
    const imageBuffer = readFileSync(qrImagePath);
    const png = PNG.sync.read(imageBuffer);

    console.log(`Image size: ${png.width}x${png.height}`);

    // Decode QR code
    const qrCode = jsQR(png.data, png.width, png.height);

    if (!qrCode) {
        console.error('Error: Could not decode QR code from image');
        console.error('Make sure the image contains a clear QR code');
        process.exit(1);
    }

    console.log('✓ QR code decoded successfully');

    // Parse JSON from QR code
    let qrData;
    try {
        qrData = JSON.parse(qrCode.data);
    } catch (e) {
        console.error('Error: QR code does not contain valid JSON');
        console.error('QR data:', qrCode.data);
        process.exit(1);
    }

    console.log('\nQR Code Data:');
    console.log(`  Group ID: ${qrData.gid}`);
    console.log(`  Device Model: ${qrData.model}`);
    console.log(`  IP Address: ${qrData.ipaddress}`);
    console.log(`  Device Name: ${qrData.deviceName}`);

    // Generate ETP keys
    console.log('\nGenerating ETP keypair...');

    SecureUtil.generateKeyPairFromSeed({
        eid: qrData.gid,
        seed: qrData.seed,
        ek: qrData.ek
    });

    // Export keys to PEM files
    SecureUtil.exportKeyPair('etp.public.pem', 'etp.private.pem');

    console.log('✓ ETP keys generated successfully!');
    console.log('  - etp.private.pem');
    console.log('  - etp.public.pem');

    console.log('\n✅ Authentication setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Update firewalla_bridge.js with the correct IP address if needed');
    console.log(`     Current IP in QR code: ${qrData.ipaddress}`);
    console.log('  2. Start the bridge server: node firewalla_bridge.js');
    console.log('  3. Test connection: ./venv/bin/python firewalla_cli.py list');

} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
}
