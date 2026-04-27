const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');

// De route die je frontend aanroept
router.get('/wedstrijd/:slug', async (req, res) => {
    const { slug } = req.params;
    console.log(`📡 Verzoek ontvangen voor ritten van: ${slug}`);

    try {
        // 1. Zoek de wedstrijd op
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('slug', slug)
            .single();

        if (wErr || !wedstrijd) {
            return res.status(404).json({ error: "Wedstrijd niet gevonden in database." });
        }

        // 2. Kijk of er ritten zijn
        let { data: ritten, error: rErr } = await supabase
            .from('ritten')
            .select('*')
            .eq('wedstrijd_id', wedstrijd.id)
            .order('rit_nummer', { ascending: true });

        // 3. Als er GEEN ritten zijn -> SCRAPEN
        if (!ritten || ritten.length === 0) {
            console.log(`🚀 Database is leeg voor ${wedstrijd.naam}. Scraper starten...`);

            if (!wedstrijd.pcs_url) {
                return res.status(400).json({ error: "Geen PCS URL bekend voor deze wedstrijd." });
            }

            // Roep de scraper aan
            await scraper.scrapeStagesForRace(wedstrijd.pcs_url, wedstrijd.id);

            // Haal ze opnieuw op
            const { data: verseRitten } = await supabase
                .from('ritten')
                .select('*')
                .eq('wedstrijd_id', wedstrijd.id)
                .order('rit_nummer', { ascending: true });

            ritten = verseRitten;
        }

        res.json({ wedstrijd, ritten });
    } catch (err) {
        console.error("❌ Fout in ritten-route:", err.message);
        res.status(500).json({ error: err.message });
    }
});



module.exports = router;