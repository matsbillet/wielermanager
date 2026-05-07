const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');
const rittenController = require('../controllers/rittenController');

const TRUI_PUNTEN = 10;
const PUNTEN_SCHEMA = [100, 80, 65, 55, 45, 35, 30, 25, 20, 17, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

let activeScrapes = new Set();

async function zoekRennerIdOpSlug(slug) {
    if (!slug) return null;

    const { data: renner, error } = await supabase
        .from('renners')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

    if (error) {
        console.error(`❌ Fout bij zoeken renner ${slug}:`, error.message);
        return null;
    }

    return renner?.id || null;
}

async function verwerkRitResultaat(ritId, resultaat) {
    if (!resultaat?.uitslag?.length) {
        throw new Error("Geen uitslag gevonden om op te slaan.");
    }

    console.log(`💾 Opslaan van ${resultaat.uitslag.length} rituitslagen voor rit ${ritId}`);

    await supabase
        .from('ritresultaten')
        .delete()
        .eq('rit_id', ritId);

    for (let i = 0; i < resultaat.uitslag.length; i++) {
        const rennerInfo = resultaat.uitslag[i];
        const rennerId = await zoekRennerIdOpSlug(rennerInfo.slug);

        if (!rennerId) {
            console.warn(`⚠️ Renner niet gevonden in DB: ${rennerInfo.slug}`);
            continue;
        }

        const { error: insertError } = await supabase
            .from('ritresultaten')
            .insert({
                rit_id: ritId,
                renner_id: rennerId,
                positie: rennerInfo.positie || i + 1,
                punten: PUNTEN_SCHEMA[i] || 0,
                rit_punten: PUNTEN_SCHEMA[i] || 0,
                trui_punten: 0,
                truien_punten: 0,
            });

        if (insertError) {
            console.error(`❌ Insert ritresultaat mislukt voor renner ${rennerId}:`, insertError.message);
        }
    }

    const truiSlugs = [
        resultaat.truien?.algemeen,
        resultaat.truien?.punten,
        resultaat.truien?.berg,
        resultaat.truien?.jongeren,
    ].filter(Boolean);

    for (const slug of truiSlugs) {
        const rennerId = await zoekRennerIdOpSlug(slug);

        if (!rennerId) {
            console.warn(`⚠️ Truidrager niet gevonden in DB: ${slug}`);
            continue;
        }

        const { data: bestaand, error: bestaandError } = await supabase
            .from('ritresultaten')
            .select('id, trui_punten, truien_punten')
            .eq('rit_id', ritId)
            .eq('renner_id', rennerId)
            .maybeSingle();

        if (bestaandError) {
            console.error(`❌ Fout bij zoeken bestaand truiresultaat:`, bestaandError.message);
            continue;
        }

        if (bestaand) {
            const nieuweTruiPunten = Number(bestaand.trui_punten || 0) + TRUI_PUNTEN;
            const nieuweTruienPunten = Number(bestaand.truien_punten || 0) + TRUI_PUNTEN;

            await supabase
                .from('ritresultaten')
                .update({
                    trui_punten: nieuweTruiPunten,
                    truien_punten: nieuweTruienPunten,
                })
                .eq('id', bestaand.id);
        } else {
            await supabase
                .from('ritresultaten')
                .insert({
                    rit_id: ritId,
                    renner_id: rennerId,
                    positie: null,
                    punten: 0,
                    rit_punten: 0,
                    trui_punten: TRUI_PUNTEN,
                    truien_punten: TRUI_PUNTEN,
                });
        }
    }

    const { error: updateError } = await supabase
        .from('ritten')
        .update({
            leider_algemeen: resultaat.truien?.algemeen || null,
            leider_punten: resultaat.truien?.punten || null,
            leider_berg: resultaat.truien?.berg || null,
            leider_jongeren: resultaat.truien?.jongeren || null,
            gescrapet: true,
        })
        .eq('id', ritId);

    if (updateError) throw updateError;
}

router.get('/deadlines/:wedstrijd_id', rittenController.getDeadlines);
router.get('/volgende', rittenController.getVolgendeRit);

router.get('/wedstrijd/:slug', async (req, res) => {
    const { slug } = req.params;

    try {
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();

        if (wErr) throw wErr;

        if (!wedstrijd) {
            return res.status(404).json({ error: "Wedstrijd niet gevonden" });
        }

        const { data: ritten, error: rErr } = await supabase
            .from('ritten')
            .select('*')
            .eq('wedstrijd_id', wedstrijd.id)
            .order('rit_nummer', { ascending: true });

        if (rErr) throw rErr;

        res.json({
            wedstrijd,
            ritten: ritten || [],
        });
    } catch (err) {
        console.error("❌ Server Error in /wedstrijd/:slug:", err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/wedstrijd/:wedstrijdId/scrape-past', async (req, res) => {
    const { wedstrijdId } = req.params;

    try {
        const nu = new Date();
        const nuIso = nu.toISOString();

        console.log(`\n--- 🔍 DEBUG BULK SCRAPE ---`);
        console.log(`Huidige tijd (UTC): ${nuIso}`);
        console.log(`Zoeken naar ritten voor wedstrijd ID: ${wedstrijdId}`);

        // 1. Haal EERST alle ongescrapete ritten op zonder de tijdfilter 
        // om te kijken wat er in de database staat.
        const { data: alleRitten, error: checkErr } = await supabase
            .from('ritten')
            .select('id, rit_nummer, starttijd, gescrapet')
            .eq('wedstrijd_id', wedstrijdId)
            .eq('gescrapet', false);

        if (checkErr) throw checkErr;

        // Filter nu handmatig in JS om exact te zien wat er gebeurt
        const rittenToScrape = alleRitten.filter(rit => {
            if (!rit.starttijd) return false;
            const ritTijd = new Date(rit.starttijd);
            return ritTijd <= nu;
        }).sort((a, b) => a.rit_nummer - b.rit_nummer);

        console.log(`Gevonden ongescrapete ritten in totaal: ${alleRitten.length}`);
        console.log(`Ritten die volgens de logica al gereden zijn: ${rittenToScrape.length}`);

        if (alleRitten.length > 0 && rittenToScrape.length === 0) {
            console.log("⚠️ WAARSCHUWING: Er zijn ritten, maar de starttijd ligt in de toekomst.");
            console.log(`Voorbeeld starttijd uit DB: ${alleRitten[0].starttijd}`);
        }

        if (rittenToScrape.length === 0) {
            return res.json({
                success: true,
                message: "Geen ongescrapete ritten gevonden die al gereden zijn (volgens de starttijd).",
                count: 0
            });
        }

        // 2. Haal de benodigde extra data (URL) op voor de te scrapen ritten
        const { data: rittenMetUrl, error: urlErr } = await supabase
            .from('ritten')
            .select('*, wedstrijden(pcs_url, is_eendagskoers)')
            .in('id', rittenToScrape.map(r => r.id))
            .order('rit_nummer', { ascending: true });

        if (urlErr) throw urlErr;

        let successCount = 0;
        for (const rit of rittenMetUrl) {
            console.log(`🚴 Scrapen van rit ${rit.rit_nummer}...`);
            try {
                const resultaat = await scraper.scrapeRitDetails(
                    rit.wedstrijden.pcs_url,
                    rit.rit_nummer,
                    rit.wedstrijden.is_eendagskoers
                );
                await verwerkRitResultaat(rit.id, resultaat);
                successCount++;
                await new Promise(res => setTimeout(res, 1000));
            } catch (err) {
                console.error(`❌ Fout bij rit ${rit.rit_nummer}:`, err.message);
            }
        }

        res.json({
            success: true,
            message: `✅ ${successCount} ritten succesvol ingehaald!`,
            count: successCount
        });

    } catch (err) {
        console.error("Fout bij bulk scrape:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/:id/auto-scrape', async (req, res) => {
    const { id } = req.params;

    if (activeScrapes.has(id)) {
        return res.status(429).json({ error: "Scrape is al bezig voor deze rit." });
    }

    try {
        activeScrapes.add(id);

        const { data: rit, error: rErr } = await supabase
            .from('ritten')
            .select('*, wedstrijden(id, naam, pcs_url, slug, aantal_ritten, jaar, is_eendagskoers)')
            .eq('id', id)
            .single();

        if (rErr || !rit) {
            return res.status(404).json({ error: "Rit niet gevonden" });
        }

        if (!rit.wedstrijden) {
            throw new Error("Wedstrijdgegevens konden niet worden opgehaald.");
        }

        const resultaat = await scraper.scrapeRitDetails(
            rit.wedstrijden.pcs_url,
            rit.rit_nummer,
            rit.wedstrijden.is_eendagskoers
        );

        await verwerkRitResultaat(id, resultaat);

        if (rit.rit_nummer === rit.wedstrijden.aantal_ritten) {
            console.log(`🏁 Laatste rit van ${rit.wedstrijden.naam} voltooid. Check voor volgend jaar...`);

            const huidigJaar = rit.wedstrijden.jaar;
            const volgendJaar = huidigJaar + 1;
            const volgendJaarStr = volgendJaar.toString();

            const replaceYear = (str) => {
                if (/\d{4}/.test(str)) {
                    return str.replace(/\d{4}/g, volgendJaarStr);
                }

                return null;
            };

            const nieuweSlug = replaceYear(rit.wedstrijden.slug) || `${rit.wedstrijden.slug}-${volgendJaarStr}`;
            const nieuweUrl = replaceYear(rit.wedstrijden.pcs_url) ||
                (rit.wedstrijden.pcs_url.endsWith('/')
                    ? `${rit.wedstrijden.pcs_url}${volgendJaarStr}`
                    : `${rit.wedstrijden.pcs_url}/${volgendJaarStr}`);

            const nieuweNaam = replaceYear(rit.wedstrijden.naam) || `${rit.wedstrijden.naam} ${volgendJaarStr}`;

            const { data: bestaandeWedstrijd } = await supabase
                .from('wedstrijden')
                .select('id')
                .eq('slug', nieuweSlug)
                .maybeSingle();

            let doelWedstrijdId;

            if (!bestaandeWedstrijd) {
                const { data: nieuweW, error: insErr } = await supabase
                    .from('wedstrijden')
                    .insert({
                        naam: nieuweNaam,
                        slug: nieuweSlug,
                        jaar: volgendJaar,
                        pcs_url: nieuweUrl,
                        aantal_ritten: rit.wedstrijden.aantal_ritten,
                    })
                    .select()
                    .single();

                if (insErr) {
                    console.error("❌ Fout bij aanmaken volgend jaar:", insErr.message);
                } else if (nieuweW) {
                    doelWedstrijdId = nieuweW.id;
                }
            } else {
                doelWedstrijdId = bestaandeWedstrijd.id;
            }

            if (doelWedstrijdId) {
                const { count: rittenCount } = await supabase
                    .from('ritten')
                    .select('*', { count: 'exact', head: true })
                    .eq('wedstrijd_id', doelWedstrijdId);

                if (rittenCount === 0) {
                    try {
                        const rittenResult = await scraper.scrapeStagesForRace(nieuweUrl, doelWedstrijdId);
                        console.log(`✅ ${rittenResult.count} ritten toegevoegd voor ${volgendJaar}.`);
                    } catch (scrapeErr) {
                        console.error("⚠️ Scrapen van ritten mislukt:", scrapeErr.message);
                    }
                }
            }
        }

        return res.json({
            success: true,
            message: "Uitslag verwerkt.",
        });
    } catch (err) {
        console.error("❌ Fout bij scrapen:", err);
        res.status(500).json({ error: err.message });
    } finally {
        activeScrapes.delete(id);
    }
});

router.post('/:id/sync-startlijst', async (req, res) => {
    const { id } = req.params;

    try {
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('id', id)
            .single();

        if (wErr || !wedstrijd) {
            return res.status(404).json({ error: "Wedstrijd niet gevonden" });
        }

        if (!scraper.scrapeFullRaceInfo) {
            return res.status(500).json({ error: "Server configuratiefout: scraper functie ontbreekt." });
        }

        const raceData = await scraper.scrapeFullRaceInfo(wedstrijd.pcs_url);

        if (!raceData || !raceData.deelnemers) {
            return res.status(400).json({ error: "PCS gaf geen renners terug. Controleer de URL." });
        }

        const rennersData = raceData.deelnemers.map((renner) => ({
            naam: renner.naam,
            slug: renner.slug,
        }));

        const { error: upErr } = await supabase
            .from('renners')
            .upsert(rennersData, { onConflict: 'slug' });

        if (upErr) throw upErr;

        res.json({
            success: true,
            message: `${raceData.deelnemers.length} renners succesvol gesynchroniseerd!`,
        });
    } catch (err) {
        console.error("🔥 Sync fout:", err);
        res.status(500).json({ error: "Interne serverfout: " + err.message });
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
                    rit_punten,
                    trui_punten,
                    truien_punten,
                    renners (
                        naam,
                        ploeg
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        if (data && data.ritresultaten) {
            data.ritresultaten.sort((a, b) => (a.positie || 99) - (b.positie || 99));
        }

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
module.exports.verwerkRitResultaat = verwerkRitResultaat;