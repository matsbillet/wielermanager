const express = require('express');
const router = express.Router();
const scraper = require('../scraper/scraper');
const { supabase } = require('../db/supabase');

// --- 1. OVERZICHTS ROUTES (GET) ---

// Haal alle ritten op
router.get('/ritten', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ritten')
            .select('*')
            .order('rit_nummer', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Haal alle renners op
router.get('/renners', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('renners')
            .select('*')
            .order('naam', { ascending: true });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. SCRAPER ACTIONS (POST) ---

// Startlijst importeren
router.post('/import-startlist', async (req, res) => {
    const { url } = req.body;
    const resultaat = await scraper.importStartlist(url);
    if (resultaat.success) {
        res.json({ message: `Succes! ${resultaat.count} renners toegevoegd.` });
    } else {
        res.status(500).json({ error: resultaat.error });
    }
});

// Rit uitslag scrapen
router.post('/scrape-rit', async (req, res) => {
    const { ritId, ritNummer } = req.body;
    const resultaat = await scraper.runScraper(ritId, ritNummer);
    if (resultaat.success) {
        res.json({ message: `Rit ${ritNummer} verwerkt!`, count: resultaat.count });
    } else {
        res.status(400).json({ message: resultaat.message || "Fout bij scrapen" });
    }
});

// --- 3. BEHEER (ADD/DELETE) ---

router.post('/ritten/add', async (req, res) => {
    const { rit_nummer, datum, naam } = req.body;
    const { data, error } = await supabase.from('ritten').insert([{ rit_nummer, datum, naam }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/ritten/:id', async (req, res) => {
    const { error } = await supabase.from('ritten').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/renners/:id', async (req, res) => {
    const { error } = await supabase.from('renners').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

// Verwijder ALLE drafts
router.delete('/drafts-all', async (req, res) => {
    try {
        const { error } = await supabase
            .from('drafts') // Controleer of je tabel exact 'drafts' heet
            .delete()
            .neq('id', 0);

        if (error) throw error;
        res.json({ success: true, message: "Alle drafts zijn verwijderd." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verwijder ALLE renners
router.delete('/renners-all', async (req, res) => {
    try {
        const { error } = await supabase
            .from('renners')
            .delete()
            .neq('id', 0); // Hack om te zeggen: verwijder alles waar ID niet 0 is (dus alles)

        if (error) throw error;
        res.json({ success: true, message: "Alle renners zijn verwijderd." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. Haal alle drafts op (liefst met renner namen erbij)
router.get('/drafts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('drafts')
            .select(`
                id,
                user_id,
                renner_id,
                renners ( naam )
            `); // Dit werkt als je een Foreign Key relatie hebt in Supabase

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Verwijder 1 specifieke draft
router.delete('/drafts/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('drafts')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;