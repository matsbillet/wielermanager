const express = require('express');
const router = express.Router();
const scraper = require('../scraper/scraper');
const { supabase } = require('../db/supabase');
const requireAdmin = require('../middleware/requireAdmin');
const { verwerkRaceLifecycle } = require('../services/raceLifecycleService');

router.use(requireAdmin);

// --- 1. OVERZICHTS ROUTES (GET) ---

router.get('/wedstrijden', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wedstrijden')
            .select('*')
            .order('jaar', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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

// haal alle drafts op
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
            console.error('JOIN ERROR:', error.message);

            const { data: simpleData, error: simpleError } = await supabase
                .from('draft')
                .select('*, renners(naam)');

            if (simpleError) throw simpleError;

            return res.json(simpleData);
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 2. SCRAPER ACTIONS (POST) ---

// Startlijst importeren
router.post('/import-volledige-wedstrijd', async (req, res) => {
    const { url } = req.body;

    try {
        const structuur = await scraper.scrapeWedstrijdStructuur(url);
        const jaar = structuur.jaar || new Date().getFullYear();

        // Voorbereiden van globale datums voor stap 2 en stap 4
        const wedstrijdStart = formatDate(structuur.startDate, jaar);
        const wedstrijdEind = formatDate(structuur.endDate, jaar);

        // 2. Maak de wedstrijd aan
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .insert([{
                naam: structuur.naam,
                jaar: structuur.jaar,
                pcs_url: url,
                is_eendagskoers: structuur.is_eendagskoers,
                aantal_ritten: structuur.ritten.length,
                slug: createSlug(`${structuur.naam}-${structuur.jaar}`),
                start_datum: structuur.startDate, // Direct "2025-03-10"
                eind_datum: structuur.endDate     // Direct "2025-03-16"
            }])
            .select().single();

        if (wErr) throw wErr;

        // 3. Detailpagina voor STARTTIJD
        let detailUrl = structuur.is_eendagskoers
            ? (url.endsWith('/') ? `${url}result` : `${url}/result`)
            : (url.endsWith('/') ? `${url}stage-1` : `${url}/stage-1`);

        const startResult = await scraper.importStartlist(detailUrl, wedstrijd.id);
        const gevondenTijd = startResult.gevondenTijd || "11:00";

        // 4. Voeg ritten toe (met harde datum-check)
        const rittenToInsert = structuur.ritten.map(r => {
            // Gebruik de rit-specifieke datum (10/03) als die er is, 
            // anders vallen we terug op de startDate van de wedstrijd.
            let ritDatum = structuur.startDate;

            if (r.datum && r.datum.includes('/')) {
                const [dag, maand] = r.datum.split('/');
                ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
            }

            return {
                wedstrijd_id: wedstrijd.id,
                rit_nummer: r.rit_nummer,
                naam: r.naam,
                // Dit bouwt nu gegarandeerd: "2025-03-10 12:40:00"
                starttijd: `${ritDatum} ${gevondenTijd}:00`,
                gescrapet: false
            };
        });

        const { error: rErr } = await supabase.from('ritten').insert(rittenToInsert);
        if (rErr) throw rErr;

        res.json({
            success: true,
            message: `🏁 ${structuur.naam} succesvol! Wedstrijd van ${wedstrijdStart} tot ${wedstrijdEind}.`
        });

    } catch (err) {
        console.error("Super Import Fout:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- 3. BEHEER (ADD/DELETE) ---

router.post('/ritten/add', async (req, res) => {
    try {
        const { rit_nummer, datum, naam } = req.body;

        const { error } = await supabase
            .from('ritten')
            .insert([{ rit_nummer, datum, naam }]);

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/ritten/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('ritten')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/renners/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('renners')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true });
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
            .not('id', 'is', null);

        if (error) throw error;

        res.json({ success: true, message: 'Alle renners zijn succesvol verwijderd.' });
    } catch (err) {
        console.error('Fout bij renners-all:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Verwijder ALLE drafts
router.delete('/drafts-all', async (req, res) => {
    try {
        console.log("🚀 Poging om de gehele draft-tabel leeg te maken...");

        const { error } = await supabase
            .from('draft')
            .delete()
            .not('id', 'is', null);

        if (error) throw error;

        console.log("✅ Tabel 'draft' is nu leeg.");
        res.json({ success: true, message: 'Alle drafts zijn succesvol gewist.' });
    } catch (err) {
        console.error('❌ Fout bij drafts-all:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Verwijder 1 specifieke draft
router.delete('/drafts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('draft')
            .update({ renner_id: null })
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Draftslot leeggemaakt.',
        });
    } catch (err) {
        console.error('Fout bij verwijderen:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post("/race-lifecycle/run", async (req, res) => {
    try {
        const resultaat = await verwerkRaceLifecycle();
        res.json(resultaat);
    } catch (error) {
        console.error("Race lifecycle fout:", error);
        res.status(500).json({
            error: "Race lifecycle mislukt",
            details: error.message,
        });
    }
});
// wedstrijden verwijderen

router.delete('/wedstrijd/:id', async (req, res) => {
    const { id } = req.params;

    try {
        console.log(`🗑️ Grondige verwijdering voor wedstrijd ID: ${id}`);

        // STAP 1: Haal eerst alle rit_id's op die bij deze wedstrijd horen
        const { data: ritten, error: fetchError } = await supabase
            .from('ritten')
            .select('id')
            .eq('wedstrijd_id', id);

        if (fetchError) throw fetchError;

        if (ritten && ritten.length > 0) {
            const ritIds = ritten.map(r => r.id);

            // STAP 2: Verwijder de resultaten van al die ritten
            const { error: resError } = await supabase
                .from('ritresultaten')
                .delete()
                .in('rit_id', ritIds); // 'in' verwijdert alles in de lijst met ID's

            if (resError) throw resError;
        }

        // STAP 3: Nu kunnen de ritten veilig weg
        const { error: rittenDeleteError } = await supabase
            .from('ritten')
            .delete()
            .eq('wedstrijd_id', id);

        if (rittenDeleteError) throw rittenDeleteError;

        // STAP 4: Verwijder eventuele startlijst koppelingen (indien nodig)
        // Bijv: .from('wedstrijd_deelnemers').delete().eq('wedstrijd_id', id)

        // STAP 5: Als laatste de wedstrijd zelf
        const { error: wedstrijdError } = await supabase
            .from('wedstrijden')
            .delete()
            .eq('id', id);

        if (wedstrijdError) throw wedstrijdError;

        res.json({ success: true, message: "Alles is schoon verwijderd!" });
    } catch (err) {
        console.error("Fout bij cascade delete:", err);
        res.status(500).json({ error: err.message });
    }
});

//Wedstrijden importeren admin tab

const createSlug = (text) => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Vervang alles wat geen letter/getal is door -
        .replace(/(^-|-$)+/g, '');    // Verwijder streepjes aan begin of eind
};

router.post('/import-volledige-wedstrijd', async (req, res) => {
    const { url } = req.body;

    try {
        const structuur = await scraper.scrapeWedstrijdStructuur(url);

        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .insert([{
                naam: structuur.naam,
                pcs_url: url,
                start_datum: structuur.startDate, // Direct uit de Info-sectie
                eind_datum: structuur.endDate,   // Direct uit de Info-sectie
                slug: createSlug(`${structuur.naam}-${structuur.jaar}`)
            }])
            .select().single();

        if (wErr) throw wErr;

        // --- STAP C: Startlijst en Tijd ophalen ---
        let startlistUrl = structuur.is_eendagskoers
            ? (url.endsWith('/') ? `${url}result` : `${url}/result`)
            : (url.endsWith('/') ? `${url}startlist` : `${url}/startlist`);

        const startResult = await scraper.importStartlist(startlistUrl, wedstrijd.id);
        const tijd = startResult.gevondenTijd || "11:00";

        // STAP D: Ritten toevoegen
        const rittenToInsert = structuur.ritten.map(r => {
            // Gebruik de rit-datum uit de tabel (bijv "10/03") of fallback naar startDate
            let ritDatum = structuur.startDate;

            if (r.datum && r.datum.includes('/')) {
                const [dag, maand] = r.datum.split('/');
                ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
            }

            return {
                wedstrijd_id: wedstrijd.id,
                rit_nummer: r.rit_nummer,
                naam: r.naam,
                starttijd: `${ritDatum} ${gevondenTijd}:00`, // Combineert datum met gescrapete tijd
                gescrapet: false
            };
        });

        const { error: rErr } = await supabase.from('ritten').insert(rittenToInsert);
        if (rErr) throw rErr;

        res.json({ success: true, message: `Geïmporteerd! Starttijd: ${tijd}` });

    } catch (err) {
        console.error("Super Import Fout:", err);
        res.status(500).json({ error: err.message });
    }
});

function formatDate(datumStr) {
    if (!datumStr) return null;
    // Pak alleen het YYYY-MM-DD deel mochten er spaties omheen zitten
    const match = datumStr.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

module.exports = router;