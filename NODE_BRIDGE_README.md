# Node.js Express Bridge

This is an Express.js server that serves your Angular application and provides API endpoints.

## Setup

### 1. Install Dependencies
```bash
npm install
```

This will install:
- **express**: Web framework for Node.js
- **cors**: Cross-Origin Resource Sharing middleware
- **compression**: Gzip compression middleware

### 2. Build Angular App (for production)
```bash
npm run build:prod
```

### 3. Run the Server

**Development Mode** (with Angular dev server):
```bash
npm run start:dev
```

**Production Mode** (with built Angular app):
```bash
npm run server:prod
```

This builds the Angular app and starts the Node.js server.

**Direct Server Start** (requires prior build):
```bash
npm run server
```

The server will run on `http://localhost:3000` by default.

## Features

- ✅ Serves the Angular production build
- ✅ Includes CORS middleware for cross-origin requests
- ✅ Gzip compression for better performance
- ✅ Health check endpoint: `GET /api/health`
- ✅ Files endpoint: `GET /api/files` (serves files.json from assets)
- ✅ Fallback routing for Angular SPA (all routes go to index.html)
- ✅ Error handling middleware

## API Endpoints

### Health Check
```
GET /api/health
Response: { status: "Server is running", timestamp: "..." }
```

### Get Files
```
GET /api/files
Response: [array of files from files.json]
```

### Angular Routing
All other routes automatically fall back to `index.html`, allowing Angular Router to handle routing.

## Environment Variables

- `PORT`: Server port (default: 3000)

Example:
```bash
PORT=8080 npm run server
```

## File Structure
```
├── server.js              # Express server configuration
├── package.json          # Dependencies and scripts
├── dist/                 # Angular production build (after build)
├── src/                  # Angular source code
└── scripts/              # Node utility scripts
```

## Customization

Edit `server.js` to:
- Add more API endpoints
- Add authentication/authorization
- Connect to databases
- Add WebSocket support
- Add request logging

Example: Adding a custom endpoint
```javascript
app.get('/api/custom-route', (req, res) => {
  res.json({ message: 'Custom response' });
});
```
