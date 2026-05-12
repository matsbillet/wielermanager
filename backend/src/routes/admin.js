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
                ),
                spelers (
                    gebruikers (
                        naam
                    )
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
        // 1. Haal de globale structuur op (Naam, Jaar, Start/Eind datum)
        const structuur = await scraper.scrapeWedstrijdStructuur(url);

        // 2. Wedstrijd opslaan in de database
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .insert([{
                naam: structuur.naam,
                jaar: structuur.jaar,
                pcs_url: url,
                is_eendagskoers: structuur.is_eendagskoers,
                aantal_ritten: structuur.is_eendagskoers ? 1 : structuur.ritten.length,
                slug: createSlug(`${structuur.naam}-${structuur.jaar}`),
                start_datum: structuur.startDate, // Tabel kolom: begin_datum
                eind_datum: structuur.endDate     // Tabel kolom: eind_datum
            }], { onConflict: 'slug' })
            .select().single();

        if (wErr) throw wErr;

        // 3. Starttijd bepalen (we kijken op de eerste etappe of resultatenpagina)
        let tijdUrl = structuur.is_eendagskoers
            ? (url.endsWith('/') ? `${url}result` : `${url}/result`)
            : (url.endsWith('/') ? `${url}stage-1` : `${url}/stage-1`);

        // We gebruiken je bestaande importStartlist die al een gevondenTijd teruggeeft
        const startResult = await scraper.importStartlist(tijdUrl, wedstrijd.id);
        const gevondenTijd = startResult.gevondenTijd || "11:00";

        // 4. Ritten voorbereiden en opslaan
        const rittenToInsert = structuur.ritten.map(r => {
            // Datum parseren: PCS geeft vaak "10/03" in de tabel
            let ritDatum = structuur.startDate;
            if (r.datum && r.datum.includes('/')) {
                const [dag, maand] = r.datum.split('/');
                // Gebruik het jaar van de wedstrijd
                ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
            }

            return {
                wedstrijd_id: wedstrijd.id,
                rit_nummer: r.rit_nummer,
                naam: r.naam,
                // Combineer de berekende rit-datum met de gescrapete starttijd
                starttijd: `${ritDatum} ${gevondenTijd}:00`,
                gescrapet: false
            };
        });

        // Als het een eendagskoers is en er werden geen ritten gevonden door de links:
        if (structuur.is_eendagskoers && rittenToInsert.length === 0) {
            rittenToInsert.push({
                wedstrijd_id: wedstrijd.id,
                rit_nummer: 1,
                naam: structuur.naam,
                starttijd: `${structuur.startDate} ${gevondenTijd}:00`,
                gescrapet: false
            });
        }

        const { error: rErr } = await supabase
            .from('ritten')
            .insert(rittenToInsert, { onConflict: 'wedstrijd_id,rit_nummer' });

        if (rErr) throw rErr;

        res.json({
            success: true,
            message: `✅ ${structuur.naam} succesvol geïmporteerd!`,
            details: {
                start: structuur.startDate,
                eind: structuur.endDate,
                tijd: gevondenTijd,
                ritten: rittenToInsert.length
            }
        });

    } catch (err) {
        console.error("Fout bij volledige import:", err);
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

router.get("/race-lifecycle/preview", async (req, res) => {
    try {
        const resultaat = await verwerkRaceLifecycle({ dryRun: true });
        res.json(resultaat);
    } catch (error) {
        console.error("Race lifecycle preview fout:", error);
        res.status(500).json({
            error: "Race lifecycle preview mislukt",
            details: error.message,
        });
    }
});

router.post("/race-lifecycle/run", async (req, res) => {
    try {
        if (req.body?.bevestiging !== "START") {
            return res.status(400).json({
                error: "Bevestiging ontbreekt.",
                details: "Typ START om de volgende koers te starten.",
            });
        }

        const aantalBasis = Number(req.body?.aantalBasis || 12);
        const aantalBank = Number(req.body?.aantalBank || 6);

        if (aantalBasis < 1 || aantalBank < 0) {
            return res.status(400).json({
                error: "Ongeldige draft instellingen.",
                details: "Basisrenners moet minstens 1 zijn. Bankrenners mag 0 of meer zijn.",
            });
        }

        const resultaat = await verwerkRaceLifecycle({
            dryRun: false,
            aantalBasis,
            aantalBank,
        });

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

router.delete("/wedstrijd/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const { data: ritten } = await supabase
            .from("ritten")
            .select("id")
            .eq("wedstrijd_id", id);

        const ritIds = (ritten || []).map((rit) => rit.id);

        if (ritIds.length > 0) {
            await supabase.from("ritresultaten").delete().in("rit_id", ritIds);
        }

        await supabase.from("ritten").delete().eq("wedstrijd_id", id);
        await supabase.from("transfers").delete().eq("wedstrijd_id", id);
        await supabase.from("team_status").delete().eq("wedstrijd_id", id);

        const { data: sessies } = await supabase
            .from("draft_sessies")
            .select("id")
            .eq("wedstrijd_id", id);

        const sessieIds = (sessies || []).map((sessie) => sessie.id);

        if (sessieIds.length > 0) {
            await supabase.from("draft").delete().in("sessie_id", sessieIds);
        }

        await supabase.from("draft_sessies").delete().eq("wedstrijd_id", id);
        await supabase.from("wedstrijd_deelnemers").delete().eq("wedstrijd_id", id);
        await supabase.from("eindklassement").delete().eq("wedstrijd_id", id);
        await supabase.from("Competities").delete().eq("wedstrijd_id", id);

        const { error } = await supabase
            .from("wedstrijden")
            .delete()
            .eq("id", id);

        if (error) throw error;

        res.json({ success: true, message: "Wedstrijd volledig verwijderd." });
    } catch (error) {
        console.error("Fout bij hard delete wedstrijd:", error);
        res.status(500).json({
            error: "Fout bij verwijderen",
            details: error.message,
        });
    }
});

//Wedstrijden importeren admin tab

const createSlug = (text) => {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Vervang alles wat geen letter/getal is door -
        .replace(/(^-|-$)+/g, '');    // Verwijder streepjes aan begin of eind
};

// --- HANDMATIGE UITSLAG OPSLAAN ---
router.post('/manual-results', async (req, res) => {
    const { rit_id, top25, truien } = req.body;

    if (!rit_id) {
        return res.status(400).json({ error: "Rit ID is verplicht." });
    }

    try {
        // 1. Verwijder eerst oude uitslagen voor deze rit (handig als je een foutje wil corrigeren!)
        await supabase.from('ritresultaten').delete().eq('rit_id', rit_id);

        // 2. Bouw de data array op voor Supabase
        const uitslagData = [];

        top25.forEach((renner_id, index) => {
            if (renner_id) { // Voeg alleen toe als het vakje niet leeg is gelaten
                uitslagData.push({
                    rit_id: rit_id,
                    renner_id: renner_id,
                    positie: index + 1
                    // LET OP: Pas deze kolomnamen aan als jouw database ze anders noemt (bijv. 'etappe_id')
                });
            }
        });

        // 3. Sla de Top 25 op in de database
        if (uitslagData.length > 0) {
            const { error: insertError } = await supabase.from('ritresultaten').insert(uitslagData);
            if (insertError) throw insertError;
        }

        // 4. (Optioneel) Truien opslaan. 
        // Als je een aparte tabel 'truidragers' hebt, doe je hier nog een insert met de 'truien' array.

        // 5. Markeer de rit als voltooid / gescrapet
        await supabase.from('ritten').update({ gescrapet: true }).eq('id', rit_id);

        // 6. Succes terugsturen naar de frontend
        res.status(200).json({ success: true, message: "Handmatige uitslag is veilig opgeslagen!" });

    } catch (error) {
        console.error("❌ Fout bij opslaan handmatige uitslag:", error.message);
        res.status(500).json({ error: "Er is een database fout opgetreden bij het opslaan." });
    }
});

// Sync starttijden voor één specifieke wedstrijd
router.post('/sync-wedstrijd/:id', async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`🔄 Handmatige sync gestart voor wedstrijd ID: ${id}`);

        const { data: wedstrijd, error: wedErr } = await supabase
            .from('wedstrijden')
            .select('*')
            .eq('id', id)
            .single();

        if (wedErr || !wedstrijd) throw new Error("Wedstrijd niet gevonden.");

        // Gebruik je scraper logica
        const structuur = await scraper.scrapeWedstrijdStructuur(wedstrijd.pcs_url);

        let tijdUrl = structuur.is_eendagskoers
            ? (wedstrijd.pcs_url.endsWith('/') ? `${wedstrijd.pcs_url}result` : `${wedstrijd.pcs_url}/result`)
            : (wedstrijd.pcs_url.endsWith('/') ? `${wedstrijd.pcs_url}startlist` : `${wedstrijd.pcs_url}/startlist`);

        let gevondenTijd = "11:00";
        const startResult = await scraper.importStartlist(tijdUrl, wedstrijd.id).catch(() => null);
        if (startResult && startResult.gevondenTijd) {
            gevondenTijd = startResult.gevondenTijd;
        }

        const rittenUpdates = structuur.ritten.map((r) => {
            let ritDatum = structuur.startDate;
            if (r.datum && r.datum.includes('/')) {
                const [dag, maand] = r.datum.split('/');
                ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
            }
            return {
                wedstrijd_id: wedstrijd.id,
                rit_nummer: r.rit_nummer,
                starttijd: `${ritDatum} ${gevondenTijd}:00`
            };
        });

        // Voer de updates uit
        for (const update of rittenUpdates) {
            await supabase
                .from('ritten')
                .update({ starttijd: update.starttijd })
                .match({ wedstrijd_id: update.wedstrijd_id, rit_nummer: update.rit_nummer });
        }

        await supabase
            .from('wedstrijden')
            .update({
                start_datum: structuur.startDate,
                eind_datum: structuur.endDate,
                aantal_ritten: structuur.is_eendagskoers ? 1 : structuur.ritten.length
            })
            .eq('id', id);

        res.json({ success: true, message: `✅ ${wedstrijd.naam} is succesvol gesynchroniseerd!` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Voeg dit toe onderaan in admin.js, net boven module.exports = router;
router.post('/klassieker', async (req, res) => {
    const { url } = req.body;

    try {
        // 1. Zoek het ID van de "Voorjaarsklassiekers" op via de slug
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden')
            .select('id')
            .eq('slug', 'voorjaarsklassiekers')
            .single();

        if (wErr || !wedstrijd) {
            return res.status(404).json({ error: "Wedstrijd 'voorjaarsklassiekers' niet gevonden. Maak deze eerst aan!" });
        }

        // 2. Gebruik de scraper om de naam en datum van de koers op te halen
        const structuur = await scraper.scrapeWedstrijdStructuur(url);

        // 3. Bepaal het volgende rit_nummer
        const { count } = await supabase
            .from('ritten')
            .select('*', { count: 'exact', head: true })
            .eq('wedstrijd_id', wedstrijd.id);

        const volgendNummer = (count || 0) + 1;

        // 4. Voeg de klassieker toe als nieuwe rit
        const { error: rErr } = await supabase
            .from('ritten')
            .insert([{
                wedstrijd_id: wedstrijd.id,
                rit_nummer: volgendNummer,
                naam: structuur.naam,
                starttijd: `${structuur.startDate} 11:00:00`, // Default tijd
                gescrapet: false,
                pcs_url: url
            }]);

        if (rErr) throw rErr;

        // --- 5. NIEUW: HAAL METEEN DE STARTLIJST OP EN SLA DE RENNERS OP ---
        console.log(`[Backend] Startlijst scrapen voor klassieker: ${url}`);
        const raceData = await scraper.scrapeFullRaceInfo(url);

        let rennersToegevoegd = 0;

        if (raceData && raceData.deelnemers && raceData.deelnemers.length > 0) {
            // Map de data naar de juiste database kolommen
            const rennersData = raceData.deelnemers.map(r => ({
                naam: r.naam,
                slug: r.slug
                // Voeg hier 'team: r.team' toe als je scraper dat ook meestuurt
            }));

            // Upsert (toevoegen of updaten als de renner al bestaat via de slug)
            const { error: upErr } = await supabase
                .from('renners')
                .upsert(rennersData, { onConflict: 'slug' });

            if (upErr) {
                console.error("❌ Fout bij opslaan renners:", upErr.message);
            } else {
                rennersToegevoegd = raceData.deelnemers.length;
                console.log(`[Backend] ✅ ${rennersToegevoegd} renners toegevoegd!`);
            }
        }

        // 6. Stuur een succesbericht terug naar de frontend
        res.json({
            success: true,
            message: `✅ ${structuur.naam} toegevoegd als rit ${volgendNummer} én ${rennersToegevoegd} renners geïmporteerd!`
        });

    } catch (err) {
        console.error("Fout bij klassieker import:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;