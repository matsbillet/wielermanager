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

router.get('/deadlines/:wedstrijd_id', rittenController.getDeadlines);
// Nieuwe route voor de countdown naar de volgende rit
router.get('/volgende', rittenController.getVolgendeRit);

// Route voor het ophalen van ritten per wedstrijd (slug)
router.get('/wedstrijd/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
        console.log(`📡 API verzoek voor wedstrijd slug: ${slug}`);

        // 1. Haal de wedstrijd op
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('slug', slug)
            .maybeSingle(); // maybeSingle voorkomt crash als slug niet bestaat

        if (wErr) throw wErr;

        if (!wedstrijd) {
            console.error(`❌ Wedstrijd niet gevonden voor slug: ${slug}`);
            return res.status(404).json({ error: "Wedstrijd niet gevonden" });
        }

        // 2. Haal de ritten op
        const { data: ritten, error: rErr } = await supabase
            .from('ritten')
            .select('*')
            .eq('wedstrijd_id', wedstrijd.id)
            .order('rit_nummer', { ascending: true });

        if (rErr) throw rErr;

        // 3. Stuur exact de structuur die RaceDetailPage verwacht
        console.log(`✅ Data verzonden voor ${wedstrijd.naam} (${ritten.length} ritten)`);
        res.json({
            wedstrijd: wedstrijd,
            ritten: ritten || []
        });

    } catch (err) {
        console.error("❌ Server Error in /wedstrijd/:slug:", err.message);
        res.status(500).json({ error: err.message });
    }
});


/**
 * OVERIGE ROUTES
 * Tip: Deze logica kun je in een volgende stap ook naar rittenController.js verplaatsen.
 */

// Route voor het handmatig scrapen van een rituitslag
router.post('/:id/auto-scrape', async (req, res) => {
    const { id } = req.params;

    if (activeScrapes.has(id)) {
        return res.status(429).json({ error: "Scrape is al bezig voor deze rit." });
    }

    try {
        activeScrapes.add(id);


        const { data: rit, error: rErr } = await supabase
            .from('ritten')
            .select('*, wedstrijden(id, naam, pcs_url, slug, aantal_ritten, jaar)') // Voeg 'id' en 'jaar' expliciet toe
            .eq('id', id)
            .single();

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

        // E. Update de rit als 'gescrapet'
        await supabase.from('ritten').update({
            leider_algemeen: resultaat.truien.geel,
            leider_punten: resultaat.truien.groen,
            leider_berg: resultaat.truien.bollen,
            leider_jongeren: resultaat.truien.wit,
            gescrapet: true
        }).eq('id', id);

        // --- GEUPDATE: AUTOMATISCH VOLGEND JAAR AANMAKEN EN RITTEN SCRAPEN ---
        if (rit && rit.rit_nummer === rit.wedstrijden.aantal_ritten) {
            console.log(`🏁 Laatste rit van ${rit.wedstrijden.naam} voltooid. Check voor volgend jaar...`);

            const huidigJaar = rit.wedstrijden.jaar;
            const volgendJaar = huidigJaar + 1;
            const volgendJaarStr = volgendJaar.toString();

            // SLIMME VERVANGING: Zoek naar ELK 4-cijferig getal en vervang het door het nieuwe jaar.
            // Dit voorkomt dubbele jaartallen zoals /2024/2026.
            const replaceYear = (str) => {
                if (/\d{4}/.test(str)) {
                    return str.replace(/\d{4}/g, volgendJaarStr);
                }
                return null;
            };

            const nieuweSlug = replaceYear(rit.wedstrijden.slug) || `${rit.wedstrijden.slug}-${volgendJaarStr}`;
            const nieuweUrl = replaceYear(rit.wedstrijden.pcs_url) ||
                (rit.wedstrijden.pcs_url.endsWith('/') ? `${rit.wedstrijden.pcs_url}${volgendJaarStr}` : `${rit.wedstrijden.pcs_url}/${volgendJaarStr}`);
            const nieuweNaam = replaceYear(rit.wedstrijden.naam) || `${rit.wedstrijden.naam} ${volgendJaarStr}`;

            // 1. Check of de wedstrijd voor volgend jaar al bestaat
            const { data: bestaandeWedstrijd } = await supabase
                .from('wedstrijden')
                .select('id')
                .eq('slug', nieuweSlug)
                .maybeSingle();

            let doelWedstrijdId;

            if (!bestaandeWedstrijd) {
                console.log(`🆕 Nieuwe wedstrijd aanmaken: ${nieuweNaam} (${nieuweSlug})`);

                // 2. Insert de nieuwe wedstrijd
                const { data: nieuweW, error: insErr } = await supabase
                    .from('wedstrijden')
                    .insert({
                        naam: nieuweNaam,
                        slug: nieuweSlug,
                        jaar: volgendJaar,
                        pcs_url: nieuweUrl,
                        aantal_ritten: rit.wedstrijden.aantal_ritten
                    })
                    .select()
                    .single();

                if (insErr) {
                    console.error("❌ Fout bij aanmaken volgend jaar:", insErr.message);
                } else if (nieuweW) {
                    console.log(`✨ ${nieuweW.naam} succesvol aangemaakt (ID: ${nieuweW.id}).`);
                    doelWedstrijdId = nieuweW.id;
                }
            } else {
                console.log(`ℹ️ Wedstrijd voor ${volgendJaar} bestaat al (ID: ${bestaandeWedstrijd.id}).`);
                doelWedstrijdId = bestaandeWedstrijd.id;
            }

            // 3. Ritten check & sync
            if (doelWedstrijdId) {
                const { count: rittenCount } = await supabase
                    .from('ritten')
                    .select('*', { count: 'exact', head: true })
                    .eq('wedstrijd_id', doelWedstrijdId);

                if (rittenCount === 0) {
                    console.log(`🔎 Geen ritten gevonden voor ID ${doelWedstrijdId}. Scraper starten voor: ${nieuweUrl}`);
                    try {
                        const rittenResult = await scraper.scrapeStagesForRace(nieuweUrl, doelWedstrijdId);
                        console.log(`✅ Automatisch ${rittenResult.count} ritten toegevoegd voor ${volgendJaar}.`);
                    } catch (scrapeErr) {
                        console.error("⚠️ Scrapen van ritten mislukt:", scrapeErr.message);
                    }
                } else {
                    console.log(`✅ Er staan al ${rittenCount} ritten in de database voor wedstrijd ID ${doelWedstrijdId}.`);
                }
            }
        }
        // Verstuur de response nadat alle checks (inclusief eventuele nieuwe race) klaar zijn
        return res.json({ success: true, message: "Uitslag verwerkt en eventuele nieuwe race gecheckt!" });

    } catch (err) {
        console.error("❌ Fout bij scrapen:", err);
        res.status(500).json({ error: err.message });
    } finally {
        activeScrapes.delete(id);
    }
});

router.post('/:id/sync-startlijst', async (req, res) => {
    const { id } = req.params;
    console.log(`[Backend] Sync verzoek voor wedstrijd ID: ${id}`);

    try {
        // 1. Haal de wedstrijd op
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('id', id)
            .single();

        if (wErr || !wedstrijd) {
            console.error("❌ Wedstrijd niet gevonden in DB");
            return res.status(404).json({ error: "Wedstrijd niet gevonden" });
        }

        // 2. Controleer de scraper functie
        // BELANGRIJK: Check of deze functie echt zo heet in je scraper.js!
        if (!scraper.scrapeFullRaceInfo) {
            console.error("❌ Fout: scraper.scrapeFullRaceInfo bestaat niet!");
            return res.status(500).json({ error: "Server configuratiefout: Scraper functie ontbreekt." });
        }

        console.log(`[Backend] Scraper starten voor URL: ${wedstrijd.pcs_url}`);

        // PCS URLs voor startlijsten eindigen vaak op /startlist of /gc
        // We proberen de basis URL die in je DB staat
        const raceData = await scraper.scrapeFullRaceInfo(wedstrijd.pcs_url);

        // 3. Controleer of de scraper data heeft teruggegeven
        if (!raceData || !raceData.deelnemers) {
            console.error("❌ Scraper gaf geen deelnemers terug. Ontvangen object:", raceData);
            return res.status(400).json({ error: "PCS gaf geen renners terug. Controleer de URL." });
        }

        console.log(`[Backend] ${raceData.deelnemers.length} renners gevonden. Opslaan in DB...`);

        // 4. Upsert de renners
        // We mappen de data zodat we zeker weten dat we de juiste velden sturen
        const rennersData = raceData.deelnemers.map(r => ({
            naam: r.naam,
            slug: r.slug
        }));

        const { error: upErr } = await supabase
            .from('renners')
            .upsert(rennersData, { onConflict: 'slug' });

        if (upErr) {
            console.error("❌ Supabase Upsert Fout:", upErr.message);
            throw upErr;
        }

        console.log("✅ Sync voltooid!");
        res.json({
            success: true,
            message: `${raceData.deelnemers.length} renners succesvol gesynchroniseerd!`
        });

    } catch (err) {
        // Dit logt de ECHTE fout in je terminal!
        console.error("🔥 KRITIEKE SYNC FOUT:", err);
        res.status(500).json({ error: "Interne serverfout: " + err.message });
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