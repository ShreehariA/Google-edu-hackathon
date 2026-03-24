/**
 * DeltaEd — Node.js Frontend + Proxy Server
 * Serves static files and proxies API calls to two backends:
 *   - Main Backend: APIs (auth, leaderboard, dashboard)
 *   - Agent Backend: RAG Teacher Agent
 * 
 * Environment Variables:
 *   PORT: Server port (default: 8080)
 *   BACKEND_URL: Main backend service URL (default: http://localhost:8000)
 *   AGENT_URL: Agent backend service URL (default: http://localhost:8001)
 *   NODE_ENV: Environment (development/production)
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 8080;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8001';

console.log(`🚀 Frontend Server Configuration:`);
console.log(`   PORT: ${PORT}`);
console.log(`   BACKEND_URL: ${BACKEND_URL}`);
console.log(`   AGENT_URL: ${AGENT_URL}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);

app.use(cors());
// NOTE: Do NOT use express.json() here — it consumes the request body stream,
// which prevents http-proxy-middleware from forwarding POST bodies to backends.

// ── Health Check Endpoint (for Cloud Run startup probe) ─────
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'DeltaEd Frontend is running', 
    backend: BACKEND_URL,
    agent: AGENT_URL
  });
});

// ── Serve all HTML/CSS/JS frontend files ────────────────────
app.use(express.static(path.join(__dirname, 'static')));

// ── Proxy API calls to Main FastAPI backend ─────────────────
// All requests to /register, /login, /leaderboard, /student/* etc.
// are proxied to the backend service

app.use(['/register', '/login', '/leaderboard', '/student'], createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  logLevel: 'info',
  onError: (err, req, res) => {
    console.error(`Backend proxy error: ${err.message}`);
    res.status(502).json({ error: 'Backend service unavailable', details: err.message });
  }
}));

// ── Proxy API calls to Agent backend ───────────────────────
// All requests to /agent/* are proxied to the agent service

app.use('/agent', createProxyMiddleware({
  target: AGENT_URL,
  changeOrigin: true,
  logLevel: 'info',
  onError: (err, req, res) => {
    console.error(`Agent proxy error: ${err.message}`);
    res.status(502).json({ error: 'Agent service unavailable', details: err.message });
  }
}));

// Fallback: serve index.html for all non-API routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

// ════════════════════════════════════════════════════════════
// Start server
// ════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`✅ DeltaEd Frontend + Proxy running on http://localhost:${PORT}`);
  console.log(`   Proxying API calls to backend: ${BACKEND_URL}`);
  console.log(`   Proxying Agent calls to: ${AGENT_URL}`);
  console.log(`   Serving static files from ./static`);
});
