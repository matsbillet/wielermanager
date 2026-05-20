const express = require('express');
const cors = require('cors');
require('dotenv').config();

// NIEUWE VERSIE: Haal de start-functie op
const { startLokaleMotor } = require('./services/automationService');

const app = express();

// --- MAGISCHE TERMINAL LOGGER ---
global.appLogs = [];
const MAX_LOGS = 200; // Bewaar maximaal 200 regels in het geheugen

// Bewaar de originele console functies
const originalLog = console.log;
const originalError = console.error;

// Onderschep console.log
console.log = (...args) => {
    originalLog(...args); // Print nog steeds in je terminal
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    global.appLogs.push({ id: Date.now(), time: new Date().toLocaleTimeString(), type: 'info', msg });
    if (global.appLogs.length > MAX_LOGS) global.appLogs.shift();
};

// Onderschep console.error
console.error = (...args) => {
    originalError(...args); // Print nog steeds in je terminal
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    global.appLogs.push({ id: Date.now(), time: new Date().toLocaleTimeString(), type: 'error', msg });
    if (global.appLogs.length > MAX_LOGS) global.appLogs.shift();
};

// ==========================================
// 1. EERST DE BEVEILIGING EN MIDDLEWARE
// ==========================================
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

// ==========================================
// 2. DAARNA PAS ALLE ROUTES
// ==========================================

// --- NIEUWE LOG ROUTES ---
// Haal alle logs op
app.get('/api/logs', (req, res) => {
    res.json(global.appLogs);
});

// Wis de terminal
app.delete('/api/logs', (req, res) => {
    global.appLogs = [];
    res.json({ success: true });
});

// Bestaande routes
app.get('/test', (req, res) => {
    res.send('De server reageert!');
});

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const draftRoutes = require('./routes/draft');
const rennersRoutes = require('./routes/renners');
const spelersRoutes = require('./routes/spelers');
const transferRoutes = require('./routes/transfer');
const wedstrijdenRoutes = require('./routes/wedstrijden');
const rittenRoutes = require('./routes/ritten');
const scoresRoutes = require('./routes/scores');
const competitieRoutes = require('./routes/competitie');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/draft', draftRoutes);
app.use('/api/renners', rennersRoutes);
app.use('/api/spelers', spelersRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/wedstrijden', wedstrijdenRoutes);
app.use('/api/ritten', rittenRoutes);
app.use('/api/scores', scoresRoutes);
app.use('/api/competitie', competitieRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => {
    res.json({ bericht: 'Wielermanager API werkt!' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server draait op http://localhost:${PORT}`);
    console.log(`⚙️ Automation Service is succesvol opgestart op de achtergrond.`);
    startLokaleMotor();
});