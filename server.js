require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const registerHandler = require('./api/register');
const loginHandler    = require('./api/login');
const historyHandler  = require('./api/history');
const sendOtpHandler  = require('./api/send-otp');

const app = express();
app.use(cors());
app.use(express.json());

// Serve all frontend HTML/assets from /public
app.use(express.static(path.join(__dirname, 'public')));

// Wrap Vercel-style (req, res) handlers so they work in plain Express too
app.post('/api/send-otp',  (req, res) => sendOtpHandler(req, res));
app.post('/api/register', (req, res) => registerHandler(req, res));
app.post('/api/login',    (req, res) => loginHandler(req, res));
app.get('/api/history',   (req, res) => historyHandler(req, res));
app.post('/api/history',  (req, res) => historyHandler(req, res));
app.delete('/api/history',(req, res) => historyHandler(req, res));

// Fallback: root → effect page
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'effect.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NEXUS auth server running at http://localhost:${PORT}`);
});
