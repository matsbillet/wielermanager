const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { scrapeFullRaceInfo } = require('../scraper/scraper'); // Zorg dat dit pad klopt

// --- NIEUW: INITIALISEER EEN NIEUWE WEDSTRIJD ---
// Deze route zorgt dat je via 1 URL een hele tour inlaadt
router.post('/initialize', async (req, res) => {
    const { pcsUrl, slug, jaar } = req.body;

    if (!pcsUrl) return res.status(400).json({ error: "PCS URL is verplicht" });

    try {
        console.log("🚀 Initialisatie gestart voor:", pcsUrl);

        // 1. Roep de scraper aan voor alle data
        const info = await scrapeFullRaceInfo(pcsUrl);

        if (!info) throw new Error("Scraper kon geen data ophalen.");

        // 2. Wedstrijd opslaan of updaten
        // We gebruiken de slug uit de body of genereren er een op basis van de naam
        const wedstrijdSlug = slug || info.naam.toLowerCase().replace(/ /g, '-');

        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .upsert({
                naam: info.naam,
                pcs_url: pcsUrl,
                aantal_ritten: info.aantal_ritten,
                jaar: jaar || new Date().getFullYear(),
                slug: wedstrijdSlug,
                start_datum: info.dateText // Slaat de ruwe datumtekst op
            }, { onConflict: 'pcs_url' })
            .select().single();

        if (wErr) throw wErr;

        // 3. Ritten automatisch aanmaken
        console.log(`⏱️ Bezig met aanmaken van ${info.ritten.length} ritten...`);
        const rittenRows = info.ritten.map(r => ({
            wedstrijd_id: wedstrijd.id,
            rit_nummer: r.rit_nummer,
            naam: r.naam
        }));

        const { error: rittenErr } = await supabase
            .from('ritten')
            .upsert(rittenRows, { onConflict: ['wedstrijd_id', 'rit_nummer'] });

        if (rittenErr) throw rittenErr;

        // 4. Renners opslaan en koppelen aan de startlijst (wedstrijd_deelnemers)
        console.log(`🚴 Bezig met koppelen van ${info.deelnemers.length} renners...`);

        // Stap A: Renners in de hoofd-tabel zetten
        const { data: savedRenners, error: rennersErr } = await supabase
            .from('renners')
            .upsert(info.deelnemers.map(d => ({ naam: d.naam, slug: d.slug })), { onConflict: 'slug' })
            .select('id, slug');

        if (rennersErr) throw rennersErr;

        // Stap B: Koppel deze renners aan de tabel 'wedstrijd_deelnemers'
        const deelnemersRows = info.deelnemers.map(d => {
            const rennerId = savedRenners.find(sr => sr.slug === d.slug)?.id;
            return {
                wedstrijd_id: wedstrijd.id,
                renner_id: rennerId
            };
        }).filter(d => d.renner_id);

        const { error: dErr } = await supabase
            .from('wedstrijd_deelnemers')
            .upsert(deelnemersRows, { onConflict: ['wedstrijd_id', 'renner_id'] });

        if (dErr) throw dErr;

        res.json({
            success: true,
            message: `Wedstrijd '${info.naam}' succesvol geïnitialiseerd!`,
            ritten: info.aantal_ritten,
            deelnemers: info.deelnemers.length
        });

    } catch (err) {
        console.error("❌ Fout bij initialisatie:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- BESTAANDE GET ROUTES ---

// Alle wedstrijden
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wedstrijden')
            .select('id, naam, jaar, aantal_ritten, slug, start_datum')
            .order('jaar', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Kon wedstrijden niet ophalen' });
    }
});

// Eén wedstrijd op slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data, error } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Kon wedstrijd niet ophalen' });
    }
});

// Ritten van één wedstrijd
router.get('/:slug/ritten', async (req, res) => {
    try {
        const { slug } = req.params;
        const { data: wedstrijd, error: wedstrijdError } = await supabase
            .from('wedstrijden')
            .select('id, naam, jaar, aantal_ritten, slug')
            .eq('slug', slug)
            .single();

        if (wedstrijdError) throw wedstrijdError;

        const { data: ritten, error: rittenError } = await supabase
            .from('ritten')
            .select('id, rit_nummer, naam, gescrapet')
            .eq('wedstrijd_id', wedstrijd.id)
            .order('rit_nummer', { ascending: true });

        if (rittenError) throw rittenError;

        res.json({ wedstrijd, ritten });
    } catch (error) {
        res.status(500).json({ error: 'Kon ritten niet ophalen' });
    }
});

module.exports = router;