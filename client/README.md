# Firewalla Time Manager - React Client

Modern React + Material-UI frontend for the Firewalla Time Manager.

## Features

- Clean, modern Material-UI interface
- TypeScript for type safety
- Responsive design
- Real-time policy updates
- Modal dialogs for pause reasons
- Snackbar notifications
- Auto-refresh every 60 seconds

## Setup

### Install Dependencies

```bash
npm install
```

### Configure API URL

The app is configured to proxy requests to the backend API server at `http://localhost:3003`.

If you need to change this, edit the `proxy` field in `package.json` or set `REACT_APP_API_URL` in `.env`.

### Start Development Server

Make sure the backend servers are running:

```bash
# Terminal 1: Bridge server (port 3002)
cd /home/ssilver/development/fw
node firewalla_bridge.js

# Terminal 2: API server (port 3003)
cd /home/ssilver/development/fw
node web_server.js

# Terminal 3: React dev server (port 3000)
cd /home/ssilver/development/fw/client
npm start
```

The React app will open at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

The build folder will contain the production-ready static files that can be served by any static file server or integrated into the Node.js backend.

## Project Structure

```
client/
├── public/              # Static files
├── src/
│   ├── components/      # React components
│   │   ├── PolicyCard.tsx
│   │   ├── PoliciesTab.tsx
│   │   └── HistoryTab.tsx
│   ├── services/        # API client
│   │   └── api.ts
│   ├── utils/           # Helper functions
│   │   └── formatters.ts
│   ├── types.ts         # TypeScript types
│   └── App.tsx          # Main app component
└── package.json
```

## Technologies

- **React** - UI library
- **TypeScript** - Type safety
- **Material-UI (MUI)** - Component library
- **Emotion** - CSS-in-JS styling
