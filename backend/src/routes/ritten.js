const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');
const rittenController = require('../controllers/rittenController');

// Constanten voor de puntentelling (kunnen later eventueel ook naar een config of controller)
const TRUI_PUNTEN = 10;
const PUNTEN_SCHEMA = [100, 80, 65, 55, 45, 35, 30, 25, 20, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// Lock-mechanisme om dubbele scrapes te voorkomen
let activeScrapes = new Set();

/**
 * ROUTES VIA CONTROLLER
 */

// Nieuwe route voor de countdown naar de volgende rit
router.get('/volgende', rittenController.getVolgendeRit);

// Route voor het ophalen van ritten per wedstrijd (slug)
router.get('/wedstrijd/:slug', rittenController.getRittenPerWedstrijd);


/**
 * OVERIGE ROUTES
 * Tip: Deze logica kun je in een volgende stap ook naar rittenController.js verplaatsen.
 */

// Route voor het handmatig scrapen van een rituitslag
router.post('/scrape/:id', async (req, res) => {
    const { id } = req.params;

    if (activeScrapes.has(id)) {
        return res.status(429).json({ error: "Scrape is al bezig voor deze rit." });
    }

    activeScrapes.add(id);

    try {
        const { data: rit, error: ritErr } = await supabase
            .from('ritten').select('*').eq('id', id).single();

        if (ritErr || !rit) throw new Error("Rit niet gevonden");

        console.log(`[Backend] Scrape starten voor: ${rit.naam} (${rit.pcs_url})`);
        const resultaat = await scraper.scrapeStageData(rit.pcs_url);

        // Update de rit-status en truidragers in de database
        await supabase.from('ritten').update({
            leider_algemeen: resultaat.truien.geel,
            leider_punten: resultaat.truien.groen,
            leider_berg: resultaat.truien.bollen,
            leider_jongeren: resultaat.truien.wit,
            gescrapet: true
        }).eq('id', id);

        res.json({ success: true, message: "Uitslag succesvol verwerkt!" });

    } catch (err) {
        console.error("❌ Fout bij scrapen:", err);
        res.status(500).json({ error: err.message });
    } finally {
        activeScrapes.delete(id);
    }
});

// Route voor details van één specifieke rit inclusief resultaten
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('ritten')
            .select(`
                *,
                ritresultaten (
                    positie,
                    punten,
                    trui_punten,
                    renners (
                        naam,
                        ploeg
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        // Sorteer de uitslag op positie
        if (data && data.ritresultaten) {
            data.ritresultaten.sort((a, b) => (a.positie || 99) - (b.positie || 99));
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;