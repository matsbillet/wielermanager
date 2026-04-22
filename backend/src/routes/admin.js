// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const scraper = require('../scraper/scraper');

// 1. De automatische rit-scraper
router.post('/scrape-rit', async (req, res) => {
    const { ritId, ritNummer } = req.body;

    // De scraper bouwt zelf de URL op basis van ritNummer
    const resultaat = await scraper.runScraper(ritId, ritNummer);

    if (resultaat.success) {
        res.json({ message: `Succesvol ${resultaat.count} renners verwerkt voor rit ${ritNummer}`, count: resultaat.count });
    } else {
        // Hier sturen we de "nog niet gereden" melding terug naar de frontend
        res.status(400).json({ message: resultaat.message || "Fout bij scrapen" });
    }
});

// 2. De eenmalige Startlijst Import
router.post('/import-startlist', async (req, res) => {
    const { url } = req.body;
    const resultaat = await scraper.importStartlist(url);

    if (resultaat.success) {
        res.json({ message: `Startlijst geïmporteerd! ${resultaat.count} renners toegevoegd.` });
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