// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { runScraper } = require('../scraper/scraper');

router.post('/scrape-rit', async (req, res) => {
    const { ritId, url } = req.body; // De frontend stuurt deze twee mee

    if (!ritId || !url) {
        return res.status(400).json({ error: "ritId en url zijn verplicht voor de scraper." });
    }

    const resultaat = await runScraper(ritId, url);

    if (resultaat.success) {
        res.json({ message: `Succes! ${resultaat.aantal} resultaten verwerkt.` });
    } else {
        res.status(500).json({ error: resultaat.error });
    }
});

// --- RITTEN BEHEER ---

// Rit toevoegen
router.post('/ritten/add', async (req, res) => {
    const { rit_nummer, datum, naam } = req.body;
    const { data, error } = await supabase.from('ritten').insert([{ rit_nummer, datum, naam }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// Rit verwijderen
router.delete('/ritten/:id', async (req, res) => {
    const { error } = await supabase.from('ritten').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// --- RENNERS BEHEER ---

// Alle renners ophalen
router.get('/renners', async (req, res) => {
    const { data, error } = await supabase.from('renners').select('*').order('naam', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Renner toevoegen
router.post('/renners/add', async (req, res) => {
    const { naam, ploeg, prijs } = req.body;
    // Gebruik de createSlug functie die we eerder in de scraper hadden
    const slug = naam.toLowerCase().replace(/ /g, '-');
    const { data, error } = await supabase.from('renners').insert([{ naam, ploeg, prijs, slug }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, data });
});

// Renner verwijderen
router.delete('/renners/:id', async (req, res) => {
    const { error } = await supabase.from('renners').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

module.exports = router;