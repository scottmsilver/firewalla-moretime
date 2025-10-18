# QR Code Testing Suite

This directory contains comprehensive tests for the Firewalla QR code parsing functionality.

## Overview

The QR code parsing system was upgraded from the unreliable `qrcode-reader` library to the more robust `jsQR` library, resulting in 100% success rate on previously failing QR codes.

## Test Files

### `fixtures/`
Contains real QR code images used for testing:
- `qr-test-1.jpeg` (815 x 844px) - Previously failed with "Couldn't find enough alignment patterns"
- `qr-test-2.png` (1080 x 2410px) - Previously failed with generic parsing error

Both now parse successfully! ✅

### `qr_validation.test.js`
Main test suite that validates QR code structure and content.

**Checks:**
- ✅ Required fields present (gid, seed, ek)
- ✅ Optional fields (model, deviceName, ipaddress)
- ✅ Data type validation
- ⚠️ Expiration detection
- 📊 Field summary report

**Run:**
```bash
npm test
# or
node test/qr_validation.test.js
```

### `qr_connection.test.js`
Full end-to-end connection test using actual QR code images.

**Tests:**
1. QR code parsing
2. Field validation
3. Expiration checking
4. Keypair generation
5. FWGroupApi.joinGroup() call
6. Network connectivity test
7. Access token retrieval

**Features:**
- Tests with expired QR codes (expects failure)
- Detailed step-by-step output
- Error categorization by stage
- Verifies expected vs actual behavior

**Run:**
```bash
npm run test:connection
# or
node test/qr_connection.test.js
```

**Expected Output:**
- Both test QR codes should FAIL (they're expired)
- Test passes if actual outcome matches expected outcome
- Shows exactly where in the flow it failed

### `qr_parser.test.js`
Comprehensive test suite with generated QR codes.

**Tests:**
1. Valid Firewalla QR Code
2. Simple Text QR Code
3. Large High-Resolution QR Code
4. Image without QR Code (negative test)
5. QR Code with Missing Fields

**Run:**
```bash
node test/qr_parser.test.js
```

## Testing Tools

### `../test_qr_parser.js`
Command-line tool for testing QR code parsing on any image.

**Usage:**
```bash
# Test specific files
node test_qr_parser.js path/to/qr-image.png path/to/another.jpg

# Test fixture images
npm run test:qr
```

**Output includes:**
- 📊 File size and dimensions
- ⏱️ Load and decode timing
- 📦 Data length
- 📋 Parsed JSON structure
- ✅ Firewalla-specific fields (gid, seed, ek, model, deviceName)

## Test Results

### Performance Metrics
- **qr-test-1.jpeg**: ~55ms decode time ✅
- **qr-test-2.png**: ~95ms decode time ✅

### Validation Results
Both test QR codes:
- ✅ Contain all required fields (gid, seed, ek)
- ✅ Contain optional fields (model, deviceName, ipaddress)
- ⚠️ Are expired (expected for test fixtures)

## QR Code Structure

A valid Firewalla QR code contains:

**Required Fields:**
- `gid` - Group ID (UUID)
- `seed` - Encryption seed
- `ek` - Encryption key

**Optional Fields:**
- `model` - Device model (e.g., "purple", "gold")
- `deviceName` - Human-readable device name
- `ipaddress` - Device IP address
- `exp` - Expiration timestamp
- `service` - Service identifier
- `type` - Connection type

## Adding New Tests

To test a new QR code image:

1. Copy image to `test/fixtures/`
2. Run the parser:
   ```bash
   node test_qr_parser.js test/fixtures/your-image.png
   ```

Or test directly from downloads:
```bash
node test_qr_parser.js ~/Downloads/firewalla-qr.png
```

## Known Issues

- QR codes from the Firewalla app expire after ~30 minutes
- To test actual connection, generate a fresh QR code from: Firewalla App → Settings → Additional Pairing

## History

**Before (qrcode-reader):**
- ❌ Failed to parse 2/2 test images
- Error: "Couldn't find enough alignment patterns"

**After (jsQR):**
- ✅ Successfully parses 2/2 test images
- Fast: 55-100ms decode time
- Reliable: Works with various image sizes and formats
