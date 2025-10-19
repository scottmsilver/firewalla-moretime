# Directory Reorganization Plan

## Phase 1: Combine API Server + Bridge (No Reorganization)
## Phase 2: Reorganize Directory Structure

## Current Structure Issues

1. ❌ Unnecessary separation: `firewalla_bridge.js` and `web_server.js` as separate processes
2. ❌ Server files in root directory
3. ❌ Utility scripts (`setup_auth.js`, `debug_policy.js`) in root
4. ❌ Python CLI (`firewalla_cli.py`) in root
5. ❌ Tests scattered in multiple locations
6. ❌ Config files (`.env`, `setup.json`, etc.) in root
7. ❌ Generated files (`time_extensions.log`, `*.pem`) in root

## PHASE 1: Combine Bridge + API (FIRST!)

### Why Combine?
1. **Unnecessary separation** - Bridge only exists to be called by API server
2. **Simpler architecture** - One backend process instead of two
3. **Easier deployment** - Single process, single port
4. **Better code organization** - Bridge becomes a module, not a separate server

### Phase 1 Changes:
1. Merge `firewalla_bridge.js` logic into `web_server.js`
2. Extract Firewalla communication into a class/module
3. Remove bridge server startup, keep only API server
4. Update package.json to remove bridge-specific scripts
5. **NO directory reorganization yet** - keep files in root

### Phase 1 Result:
```
firewalla-moretime/ (root - no changes to structure yet)
├── web_server.js              # Combined API server (includes bridge logic)
├── setup_auth.js
├── debug_policy.js
├── firewalla_cli.py
├── client/
├── test/
└── ...
```

---

## PHASE 2: Reorganize After Combining

Once the server is combined and working, THEN reorganize:

```
firewalla-moretime/
├── server/                    # Backend API (Combined Express + Firewalla)
│   ├── index.js              # Main API server (from web_server.js)
│   ├── lib/                  # Shared server utilities
│   │   ├── firewalla-client.js  # Firewalla communication (extracted)
│   │   ├── qr-parser.js      # QR parsing (extracted from setup_auth.js)
│   │   └── email.js          # Email utilities
│   └── tests/                # Server-specific tests
│       ├── qr-parser.test.js
│       ├── qr-validation.test.js
│       └── qr-connection.test.js
│
├── cli/                       # Python CLI tool
│   ├── firewalla_cli.py      # Main CLI script
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # CLI-specific documentation
│
├── client/                    # React web UI (already exists)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── scripts/                   # Utility/setup scripts
│   ├── setup-auth.js         # Initial QR code authentication setup
│   └── debug-policy.js       # Policy debugging tool
│
├── config/                    # Configuration templates
│   ├── .env.example          # Environment variables template
│   └── setup.json.example    # Setup state template
│
├── data/                      # Runtime/generated data (gitignored)
│   ├── .env                  # Actual environment variables
│   ├── setup.json            # Setup state
│   ├── etp.private.pem       # Generated private key
│   ├── etp.public.pem        # Generated public key
│   └── time_extensions.log   # Activity log
│
├── docs/                      # Documentation
│   ├── GMAIL_SETUP.md        # Gmail OAuth setup guide
│   └── QR_CODE_STATUS.md     # QR code implementation notes
│
├── package.json              # Root package.json
├── README.md                 # Main project documentation
├── SETUP.md                  # Setup guide
└── .gitignore                # Git ignore rules
```

## Architecture Clarification

### Current (2 separate processes):
```
React Dev Server (port 3005) → Serves UI
         ↓
Express API Server (port 3003) → REST API, Auth, Sessions
         ↓
Bridge Server (port 3002) → Talks to Firewalla
         ↓
Firewalla Device
```

### After Phase 1 (1 process):
```
React Dev Server (port 3005) → Serves UI
         ↓
Combined API Server (port 3003) → REST API, Auth, Firewalla Client
         ↓
Firewalla Device
```

### Terminology:
- **`web_server.js`**: It's an **API server**, not a web server
  - The actual "web server" is the React dev server in `client/`
  - After Phase 1: Contains everything (API + Firewalla client)
  - After Phase 2: Renamed to `server/index.js`

- **`firewalla_bridge.js`**: Currently a separate server
  - After Phase 1: Becomes a module (`FirewallaClient` class)
  - After Phase 2: Lives in `server/lib/firewalla-client.js`

## Key Changes

### PHASE 1: Combine Servers (Do This First!)

1. **Extract Firewalla logic to a class:**
   ```javascript
   // In web_server.js, create FirewallaClient class
   class FirewallaClient {
     constructor(ip, email, publicKey, privateKey) { ... }
     async connect() { ... }
     async getPolicies() { ... }
     async pausePolicy(pid, minutes) { ... }
   }
   ```

2. **Merge bridge endpoints into web_server.js:**
   - Remove separate Express app from `firewalla_bridge.js`
   - Keep bridge logic as `FirewallaClient` class
   - Add bridge functionality directly to `web_server.js`

3. **Update package.json scripts:**
   ```json
   {
     "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
     "dev:server": "nodemon web_server.js",
     "dev:client": "cd client && PORT=3005 npm start"
   }
   ```

4. **Test that everything still works** before Phase 2

### PHASE 2: Reorganize (After Phase 1 Works!)

1. **Server Organization (`server/`):**
   - Move `web_server.js` → `server/index.js`
   - Extract `FirewallaClient` → `server/lib/firewalla-client.js`
   - Extract QR parsing → `server/lib/qr-parser.js`
   - Extract email utilities → `server/lib/email.js`
   - Move server tests → `server/tests/`

### 2. CLI Organization (`cli/`)
- Move `firewalla_cli.py` → `cli/firewalla_cli.py`
- Move `requirements.txt` → `cli/requirements.txt`
- Create `cli/README.md` with CLI-specific usage

### 3. Scripts Organization (`scripts/`)
- Move `setup_auth.js` → `scripts/setup-auth.js`
- Move `debug_policy.js` → `scripts/debug-policy.js`
- These are one-time/admin tools, not part of the server

### 4. Config Organization (`config/`)
- Move `.env.example` → `config/.env.example`
- Move `setup.json.example` → `config/setup.json.example`
- Templates only, actual config stays in `data/`

### 5. Data Organization (`data/` - gitignored)
- Move all generated/runtime files here
- `.env`, `setup.json`, `*.pem`, `*.log`
- Keeps root directory clean
- Add `data/` to `.gitignore`

### 6. Docs Organization (`docs/`)
- Move `GMAIL_SETUP.md` → `docs/GMAIL_SETUP.md`
- Move `QR_CODE_STATUS.md` → `docs/QR_CODE_STATUS.md`
- Keep only README.md and SETUP.md in root

## Files to Update

### 1. `package.json` scripts:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:bridge\" \"npm run dev:api\" \"npm run dev:client\"",
    "dev:bridge": "nodemon server/bridge.js",
    "dev:api": "nodemon server/api.js",
    "dev:client": "cd client && PORT=3005 npm start",
    "start:bridge": "node server/bridge.js",
    "start:api": "node server/api.js",
    "test": "node server/tests/qr-validation.test.js",
    "test:qr": "node server/tests/qr-parser.test.js",
    "test:connection": "node server/tests/qr-connection.test.js",
    "setup": "node scripts/setup-auth.js"
  }
}
```

### 2. `server/api.js` imports:
- Update paths to load from `data/.env` instead of `.env`
- Update any references to `setup.json` → `data/setup.json`

### 3. `server/bridge.js` imports:
- Update paths to load from `data/` directory

### 4. `.gitignore`:
```
# Data directory (runtime/generated files)
data/
!data/.gitkeep

# Keep config templates
!config/
```

### 5. Update README.md:
- Update file structure section
- Update setup instructions to reference new paths
- Update script commands

### 6. Update SETUP.md:
- Update all paths to reference new structure
- Update commands to use new npm scripts

## Migration Steps

### PHASE 1 Steps (Combine Servers):
1. ✅ Read and understand `firewalla_bridge.js` logic
2. ✅ Extract Firewalla communication into `FirewallaClient` class
3. ✅ Merge class into `web_server.js`
4. ✅ Replace bridge API calls with direct class method calls
5. ✅ Remove bridge server initialization code
6. ✅ Update package.json scripts (remove bridge scripts)
7. ✅ Test that everything still works
8. ✅ Delete `firewalla_bridge.js`
9. ✅ Commit Phase 1 changes

### PHASE 2 Steps (Reorganize):
1. ✅ Create new directory structure
2. ✅ Move files using `git mv` to preserve history
3. ✅ Extract modules from combined server
4. ✅ Update import paths in moved files
5. ✅ Update package.json scripts
6. ✅ Update .gitignore
7. ✅ Update documentation (README.md, SETUP.md)
8. ✅ Test that everything still works
9. ✅ Commit Phase 2 changes

## Benefits

✅ **Clear separation of concerns** (server/cli/client/scripts)
✅ **Clean root directory** (only essential files)
✅ **Easy to navigate** (obvious where to find things)
✅ **Better for CI/CD** (clear build targets)
✅ **Professional structure** (follows Node.js best practices)
✅ **Tests organized by component** (server/tests/, client/tests/)
✅ **Runtime data separated** (data/ directory gitignored)
✅ **Config templates separated** (config/ directory for examples)

## Questions/Decisions

### Phase 1:
- [x] Should we combine bridge + API? **YES** - Do this first!

### Phase 2:
- [ ] Should we keep `venv/` in root or move to `cli/venv/`?
- [ ] Should `nodemon.json` move to `server/` or stay in root?
- [ ] Do we want a top-level `tests/` for integration tests?

## Summary

**Phase 1** (CRITICAL): Merge the two servers into one
- Simpler, cleaner, easier to maintain
- Do this BEFORE any directory reorganization
- Keep everything in root for now

**Phase 2** (NICE TO HAVE): Clean up directory structure
- Only do this AFTER Phase 1 is working
- Move files to organized directories
- Extract modules for better code organization
