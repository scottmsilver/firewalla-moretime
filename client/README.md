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

The Vite dev server proxies API requests (`/api`, `/auth`, `/health`) to the backend API server at `http://localhost:3003`.

This is configured in `vite.config.ts`. The proxy solves same-origin policy issues during development.

### Start Development Server

From the project root, start both the backend and frontend:

```bash
# Start both servers (recommended)
npm run dev
```

This runs:
- API server on port 3003 (backend with Firewalla integration)
- React dev server on port 3005 (frontend with hot reload)

Or start them separately:

```bash
# Terminal 1: API server only
npm run dev:server

# Terminal 2: React dev server only
npm run dev:client
```

The React app will open at `http://localhost:3005`

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
