/**
 * HOOFDSERVER - Wielermanager 2026
 * Verantwoordelijk voor het verbinden van de Frontend, Backend en Supabase.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importeer de routes
const draftRoutes = require('./routes/draft');
// const rennerRoutes = require('./src/routes/rennerRoutes'); // Toekomstige toevoeging

const app = express();

// --- MIDDLEWARE ---

// Zorgt dat je React frontend (meestal poort 5173) mag praten met deze server
app.use(cors());

// Zorgt dat de server binnenkomende JSON-pakketjes (van de frontend) begrijpt
app.use(express.json());

// --- ROUTES ---

/**
 * Alle routes die te maken hebben met het draften (kiezen van renners).
 * Endpoint: http://localhost:3001/api/draft/...
 */
app.use('/api/draft', draftRoutes);

/**
 * Basis test-route om te checken of de server live is.
 */
app.get('/', (req, res) => {
    res.json({ bericht: "Wielermanager API is online!" });
});

// --- SERVER START ---

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('--------------------------------------------------');
    console.log(`Server succesvol gestart op poort: ${PORT}`);
    console.log(`API adres: http://localhost:${PORT}`);
    console.log(`Draft endpoint: http://localhost:${PORT}/api/draft/kies`);
    console.log('--------------------------------------------------');
});