const express = require('express');
const router = express.Router();
const scraper = require('../scraper/scraper');
const { supabase } = require('../db/supabase');
const requireAdmin = require('../middleware/requireAdmin');

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
router.post('/import-startlist', async (req, res) => {
    try {
        const { url, wedstrijdId } = req.body;

        if (!url || !wedstrijdId) {
            return res.status(400).json({
                error: 'url en wedstrijdId zijn verplicht.',
            });
        }

        const resultaat = await scraper.importStartlist(url, wedstrijdId);

        if (resultaat.success) {
            res.json({
                message: `Succes! ${resultaat.count} renners toegevoegd en gekoppeld aan wedstrijd ${resultaat.wedstrijdId}.`,
                count: resultaat.count,
                wedstrijdId: resultaat.wedstrijdId,
            });
        } else {
            res.status(500).json({ error: resultaat.error });
        }
    } catch (err) {
        console.error('Fout bij import-startlist:', err);
        res.status(500).json({ error: err.message });
    }
});

// Rit uitslag scrapen en verwerken
router.post('/scrape-rit', async (req, res) => {
    const { ritId, ritNummer } = req.body;

    try {
        const { data: rit, error: ritErr } = await supabase
            .from('ritten')
            .select('*, wedstrijden(pcs_url)')
            .eq('id', ritId)
            .single();

        if (ritErr) throw ritErr;
        if (!rit?.wedstrijden?.pcs_url) {
            throw new Error('Race URL niet gevonden voor deze rit.');
        }

        const uitslagData = await scraper.scrapeRitUitslag(rit.wedstrijden.pcs_url, ritNummer);

        for (const item of uitslagData) {
            // probeer eerst op slug
            let { data: renner } = await supabase
                .from('renners')
                .select('id, naam')
                .eq('slug', item.slug)
                .maybeSingle();

            // fallback: probeer op naam (BELANGRIJK)
            if (!renner && item.naam) {
                const { data: fallback } = await supabase
                    .from('renners')
                    .select('id, naam')
                    .ilike('naam', `%${item.naam}%`)
                    .limit(1)
                    .maybeSingle();

                renner = fallback;
            }

            if (!renner) {
                console.warn(`❌ Geen match voor slug: ${item.slug}`);
                continue;
            }

            const puntenVerdeling = [50, 44, 40, 36, 32, 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2];
            const punten = puntenVerdeling[item.positie - 1] || 0;

            const { error: upsertError } = await supabase
                .from('ritresultaten')
                .upsert({
                    rit_id: ritId,
                    renner_id: renner.id,
                    positie: item.positie,
                    punten: punten,
                    rit_punten: punten
                });

            if (upsertError) throw upsertError;
        }

        const { error: updateError } = await supabase
            .from('ritten')
            .update({ gescrapet: true })
            .eq('id', ritId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: `Rit ${ritNummer} gescrapet! ${uitslagData.length} renners verwerkt.`
        });
    } catch (err) {
        console.error('Fout bij /scrape-rit:', err);
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

module.exports = router;