const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');

const TRUI_PUNTEN = 10;
const PUNTEN_SCHEMA = [100, 80, 65, 55, 45, 35, 30, 25, 20, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

// Lock-mechanisme om dubbele scrapes te voorkomen
let activeScrapes = new Set();

router.get('/wedstrijd/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden').select('*').eq('slug', slug).single();

        if (wErr || !wedstrijd) return res.status(404).json({ error: "Wedstrijd niet gevonden" });

        let { data: ritten } = await supabase
            .from('ritten').select('*').eq('wedstrijd_id', wedstrijd.id).order('rit_nummer', { ascending: true });

        if (!ritten || ritten.length === 0) {
            console.log(`🚀 Lijst leeg voor ${wedstrijd.naam}. Scraper lijst starten...`);
            await scraper.scrapeStagesForRace(wedstrijd.pcs_url, wedstrijd.id);
            const { data: verseRitten } = await supabase
                .from('ritten').select('*').eq('wedstrijd_id', wedstrijd.id).order('rit_nummer', { ascending: true });
            ritten = verseRitten;
        }

        res.json({ wedstrijd, ritten });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/auto-scrape', async (req, res) => {
    const { id } = req.params;

    // Voorkom dubbele actieve scrapes voor dezelfde rit
    if (activeScrapes.has(id)) {
        return res.status(429).json({ message: "Scraper is al bezig voor deze rit..." });
    }

    try {
        activeScrapes.add(id);

        const { data: rit, error: rErr } = await supabase
            .from('ritten').select('*, wedstrijden(pcs_url, slug)').eq('id', id).single();

        if (rErr || !rit) return res.status(404).json({ error: "Rit niet gevonden" });

        const resultaat = await scraper.scrapeRitDetails(rit.wedstrijden.pcs_url, rit.rit_nummer);

        if (!resultaat || !resultaat.uitslag || resultaat.uitslag.length === 0) {
            console.log("📭 Geen resultaten gevonden op PCS.");
            return res.status(400).json({ message: "Geen uitslag gevonden op PCS." });
        }

        console.log(`💾 Bezig met opslaan van ${resultaat.uitslag.length} resultaten...`);


        // C. Verwerk Top 25 Uitslag & Punten
        console.log(`🧪 Start verwerking van ${resultaat.uitslag.length} renners...`);

        for (let i = 0; i < resultaat.uitslag.length; i++) {
            const rennerInfo = resultaat.uitslag[i];

            // Gebruik .maybeSingle() in plaats van .single() om crashes te voorkomen
            const { data: renner, error: rennerErr } = await supabase
                .from('renners')
                .select('id')
                .eq('slug', rennerInfo.slug)
                .maybeSingle();

            if (rennerErr) {
                console.error(`❌ Fout bij zoeken naar renner ${rennerInfo.slug}:`, rennerErr.message);
                continue;
            }

            // E. Update de rit als 'gescrapet' en sla de namen van de leiders op
            const { error: updateError } = await supabase
                .from('ritten')
                .update({
                    leider_algemeen: resultaat.truien.algemeen || null,
                    leider_punten: resultaat.truien.punten || null,
                    leider_berg: resultaat.truien.berg || null,
                    leider_jongeren: resultaat.truien.jongeren || null,
                    gescrapet: true
                })
                .eq('id', id);

            if (updateError) console.error("Fout bij updaten ritten-tabel:", updateError.message);

            if (renner) {
                console.log(`🔗 Renner gevonden: ${rennerInfo.slug} (ID: ${renner.id}). Opslaan resultaat...`);
                const { error: upsertErr } = await supabase.from('ritresultaten').upsert({
                    rit_id: id,
                    renner_id: renner.id,
                    positie: i + 1,
                    punten: PUNTEN_SCHEMA[i] || 0,
                    trui_punten: 0
                }, { onConflict: ['rit_id', 'renner_id'] });

                if (upsertErr) {
                    console.error(`❌ Upsert mislukt voor renner ${renner.id}:`, upsertErr.message);
                }
            } else {
                // DIT IS HET CRUCIALE PUNT: Wat als de slug niet wordt gevonden?
                console.warn(`⚠️ Renner NIET gevonden in DB: ${rennerInfo.slug}. Controleer of deze renner bestaat in de 'renners' tabel!`);
            }
        }

        // D. Verwerk Trui Bonus
        const truiSlugs = [
            { slug: resultaat.truien.algemeen },
            { slug: resultaat.truien.punten },
            { slug: resultaat.truien.berg },
            { slug: resultaat.truien.jongeren }
        ];

        for (const trui of truiSlugs) {
            if (!trui.slug) continue;

            const { data: renner } = await supabase.from('renners').select('id').eq('slug', trui.slug).single();
            if (renner) {
                const { data: bestaand } = await supabase.from('ritresultaten')
                    .select('id, trui_punten').eq('rit_id', id).eq('renner_id', renner.id).single();

                if (bestaand) {
                    await supabase.from('ritresultaten')
                        .update({ trui_punten: (bestaand.trui_punten || 0) + TRUI_PUNTEN })
                        .eq('id', bestaand.id);
                } else {
                    await supabase.from('ritresultaten').insert({
                        rit_id: id, renner_id: renner.id, positie: null, punten: 0, trui_punten: TRUI_PUNTEN
                    });
                }
            }
        }

        await supabase.from('ritten').update({
            leider_algemeen: resultaat.truien.algemeen,
            leider_punten: resultaat.truien.punten,
            leider_berg: resultaat.truien.berg,
            leider_jongeren: resultaat.truien.jongeren,
            gescrapet: true
        }).eq('id', id);

        res.json({ success: true, message: "Uitslag verwerkt!" });

    } catch (err) {
        console.error("❌ Fout bij scrapen:", err);
        res.status(500).json({ error: err.message });
    } finally {
        activeScrapes.delete(id);
    }
});

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

        // Sorteer de uitslag op positie (1, 2, 3...)
        if (data && data.ritresultaten) {
            data.ritresultaten.sort((a, b) => (a.positie || 99) - (b.positie || 99));
        }

        res.json(data);
    } catch (err) {
        console.error("Fout bij ophalen ritdetails:", err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;