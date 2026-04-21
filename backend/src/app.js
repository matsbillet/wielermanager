/**
 * HOOFDSERVER - Wielermanager 2026
 * Verantwoordelijk voor het verbinden van de Frontend, Backend en Supabase.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Importeer de routes
const draftRoutes = require('./routes/draft');
const adminRoutes = require('./routes/adminRoutes');
const standRoutes = require('./routes/standRoutes'); // Zorg dat dit bestand bestaat!

const app = express();

// --- 1. MIDDLEWARE (Altijd bovenaan!) ---

// Zorgt dat je React frontend (poort 5173) mag praten met deze server
app.use(cors());

// Zorgt dat de server JSON data uit de frontend kan lezen (cruciaal voor POST)
app.use(express.json());

// --- 2. ROUTES ---

// Draft routes (Renners kiezen)
app.use('/api/draft', draftRoutes);

// Admin routes (Scraper triggeren)
app.use('/api/admin', adminRoutes);

// Stand routes (Scorebord ophalen)
app.use('/api/stand', standRoutes);

/**
 * Basis test-route om te checken of de server live is.
 */
app.get('/', (req, res) => {
    res.json({
        bericht: "Wielermanager API is online!",
        status: "🚀 Running"
    });
});

// --- 3. SERVER START ---

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`🚀 Server succesvol gestart op poort: ${PORT}`);
    console.log(`📍 API Base: http://localhost:${PORT}/api`);
    console.log(`📍 Scorebord: http://localhost:${PORT}/api/stand/totaal`);
    console.log(`📍 Admin Scraper: http://localhost:${PORT}/api/admin/scrape-rit`);
    console.log(`📍 Draft endpoint: http://localhost:${PORT}/api/draft/kies`);
    console.log('--------------------------------------------------');
});