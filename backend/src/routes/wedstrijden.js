const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const { scrapeFullRaceInfo } = require('../scraper/scraper'); // Zorg dat dit pad klopt
const scraper = require('../scraper/scraper');
// Let op: controleer of dit het juiste pad is naar je scraper bestand vanuit routes/wedstrijden.js!

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
// In je routes/wedstrijden.js of ritten.js
router.post('/:id/sync-startlijst', async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Haal de wedstrijd-URL op uit de DB
        const { data: wedstrijd, error } = await supabase
            .from('wedstrijden')
            .select('pcs_url, id')
            .eq('id', id)
            .single();

        if (error || !wedstrijd) return res.status(404).json({ error: "Wedstrijd niet gevonden" });

        console.log(`🔄 Sync startlijst gestart voor: ${wedstrijd.pcs_url}`);

        // 2. Gebruik de bestaande scraper om de info + deelnemers op te halen
        const raceData = await scraper.scrapeFullRaceInfo(wedstrijd.pcs_url);

        if (!raceData.deelnemers || raceData.deelnemers.length === 0) {
            return res.status(400).json({ error: "Geen deelnemers gevonden op PCS. Is de startlijst al bekend?" });
        }

        // 3. Renners opslaan in de 'renners' tabel (indien nieuw)
        for (const renner of raceData.deelnemers) {
            await supabase.from('renners').upsert({
                naam: renner.naam,
                slug: renner.slug,
                // ploeg: renner.ploeg // Optioneel als je dit toch wilt opslaan
            }, { onConflict: 'slug' });
        }

        // 4. (Optioneel) Koppeling maken met de competitie/sessie
        // Hier kun je logica toevoegen om deze renners direct aan de draft-pool toe te voegen

        res.json({
            success: true,
            message: `${raceData.deelnemers.length} renners gesynchroniseerd!`,
            count: raceData.deelnemers.length
        });

    } catch (err) {
        console.error("❌ Sync fout:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;