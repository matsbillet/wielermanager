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
        console.log("🚀 Poging om de gehele draft-tabel leeg te maken...");

        // We gebruiken .gt('id', 0) voor integers OF we filteren op een kolom die altijd bestaat
        // De veiligste manier voor Supabase om ALLES te verwijderen:
        const { error } = await supabase
            .from('draft')
            .delete()
            .not('id', 'is', null); // "Verwijder alles waar ID niet leeg is" (dus alles)

        if (error) throw error;

        console.log("✅ Tabel 'draft' is nu leeg.");
        res.json({ success: true, message: "Alle drafts zijn succesvol gewist." });
    } catch (err) {
        console.error("❌ Fout bij drafts-all:", err.message);
        res.status(500).json({ error: err.message });
    }
});

//haal alle drafts op
router.get('/drafts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('draft')
            .select(`
                id,
                speler_id,
                renner_id,
                renners (
                    naam
                )
            `);

        if (error) {
            // Als dit logt, staat de relatie in Supabase NIET goed
            console.error("JOIN ERROR:", error.message);
            const { data: simpleData } = await supabase.from('draft').select('*, renners(naam)');
            return res.json(simpleData);
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Verwijder 1 specifieke draft
router.delete('/drafts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Poging tot verwijderen van draft item ID: ${id}`);

        const { error } = await supabase
            .from('draft') // Zorg dat dit 'draft' is
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true, message: "Draft item verwijderd" });
    } catch (err) {
        console.error("Fout bij verwijderen:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// backend/src/routes/admin.js

router.post('/scrape-rit', async (req, res) => {
    const { ritId, ritNummer } = req.body;

    try {
        // 1. Haal rit info en de bijbehorende race URL op
        const { data: rit, error: ritErr } = await supabase
            .from('ritten')
            .select('*, races(pcs_url)')
            .eq('id', ritId)
            .single();

        if (ritErr || !rit.races?.pcs_url) throw new Error("Race URL niet gevonden voor deze rit.");

        // 2. Start de scraper
        const uitslagData = await scraper.scrapeRitUitslag(rit.races.pcs_url, ritNummer);

        // 3. Verwerk de resultaten
        for (const item of uitslagData) {
            // Zoek de interne renner ID op basis van de slug
            const { data: renner } = await supabase
                .from('renners')
                .select('id')
                .eq('slug', item.slug)
                .single();

            if (renner) {
                // Bereken punten (bijv: 1e = 50, 2e = 40, etc. - kun je zelf aanpassen)
                const puntenVerdeling = [50, 44, 40, 36, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2];
                const punten = puntenVerdeling[item.positie - 1] || 0;

                await supabase.from('ritresultaten').upsert({
                    rit_id: ritId,
                    renner_id: renner.id,
                    positie: item.positie,
                    punten: punten
                });
            }
        }

        // 4. Update de status van de rit
        await supabase.from('ritten').update({ gescrapet: true }).eq('id', ritId);

        res.json({ success: true, message: `Rit ${ritNummer} gescrapet! ${uitslagData.length} renners verwerkt.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;