const express = require("express");
const router = express.Router();
const { supabase } = require("../db/supabase");
const { scrapeFullRaceInfo } = require("../scraper/scraper"); // Zorg dat dit pad klopt
const scraper = require("../scraper/scraper");
// Let op: controleer of dit het juiste pad is naar je scraper bestand vanuit routes/wedstrijden.js!

// --- NIEUW: INITIALISEER EEN NIEUWE WEDSTRIJD ---
// Deze route zorgt dat je via 1 URL een hele tour inlaadt
router.post("/initialize", async (req, res) => {
    const { pcsUrl, slug, jaar } = req.body;

    if (!pcsUrl) return res.status(400).json({ error: "PCS URL is verplicht" });

    try {
        console.log("🚀 Initialisatie gestart voor:", pcsUrl);

        // 1. Roep de scraper aan voor alle data
        const info = await scrapeFullRaceInfo(pcsUrl);

        if (!info) throw new Error("Scraper kon geen data ophalen.");

        // 2. Wedstrijd opslaan of updaten
        // We gebruiken de slug uit de body of genereren er een op basis van de naam
        const wedstrijdSlug = slug || info.naam.toLowerCase().replace(/ /g, "-");

        const { data: wedstrijd, error: wErr } = await supabase
            .from("wedstrijden")
            .upsert(
                {
                    naam: info.naam,
                    pcs_url: pcsUrl,
                    aantal_ritten: info.aantal_ritten,
                    jaar: jaar || info.jaar || new Date().getFullYear(),
                    slug: wedstrijdSlug,
                    start_datum: info.start_datum,
                    eind_datum: info.eind_datum,
                },
                { onConflict: "pcs_url" },
            )
            .select()
            .single();

        if (wErr) throw wErr;

        // 3. Ritten automatisch aanmaken
        console.log(`⏱️ Bezig met aanmaken van ${info.ritten.length} ritten...`);
        const rittenRows = info.ritten.map((r) => ({
            wedstrijd_id: wedstrijd.id,
            rit_nummer: r.rit_nummer,
            naam: r.naam,
            starttijd: r.starttijd,
        }));

        const { error: rittenErr } = await supabase
            .from("ritten")
            .upsert(rittenRows, { onConflict: ["wedstrijd_id", "rit_nummer"] });

        if (rittenErr) throw rittenErr;

        // 4. Renners opslaan en koppelen aan de startlijst (wedstrijd_deelnemers)
        console.log(
            `🚴 Bezig met koppelen van ${info.deelnemers.length} renners...`,
        );

        // Stap A: Renners in de hoofd-tabel zetten
        const { data: savedRenners, error: rennersErr } = await supabase
            .from("renners")
            .upsert(
                info.deelnemers.map((d) => ({ naam: d.naam, slug: d.slug })),
                { onConflict: "slug" },
            )
            .select("id, slug");

        if (rennersErr) throw rennersErr;

        // Stap B: Koppel deze renners aan de tabel 'wedstrijd_deelnemers'
        const deelnemersRows = info.deelnemers
            .map((d) => {
                const rennerId = savedRenners.find((sr) => sr.slug === d.slug)?.id;
                return {
                    wedstrijd_id: wedstrijd.id,
                    renner_id: rennerId,
                };
            })
            .filter((d) => d.renner_id);

        const { error: dErr } = await supabase
            .from("wedstrijd_deelnemers")
            .upsert(deelnemersRows, { onConflict: ["wedstrijd_id", "renner_id"] });

        if (dErr) throw dErr;

        res.json({
            success: true,
            message: `Wedstrijd '${info.naam}' succesvol geïnitialiseerd!`,
            ritten: info.aantal_ritten,
            deelnemers: info.deelnemers.length,
        });
    } catch (err) {
        console.error("❌ Fout bij initialisatie:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// --- BESTAANDE GET ROUTES ---

// Alle wedstrijden
router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("wedstrijden")
            .select(
                "id, naam, jaar, aantal_ritten, slug, start_datum, is_eendagskoers",
            )
            .order("jaar", { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Kon wedstrijden niet ophalen" });
    }
});

router.get("/klassiekers/:jaar", async (req, res) => {
    try {
        const jaar = Number(req.params.jaar);

        const { data, error } = await supabase
            .from("wedstrijden")
            .select(
                "id, naam, jaar, slug, aantal_ritten, is_eendagskoers, ritten(id, rit_nummer)",
            )
            .eq("jaar", jaar)
            .eq("is_eendagskoers", true)
            .order("naam", { ascending: true });

        if (error) throw error;

        const klassiekers = (data || []).map((wedstrijd) => ({
            ...wedstrijd,
            rit_id: wedstrijd.ritten?.[0]?.id || null,
            rit_nummer: wedstrijd.ritten?.[0]?.rit_nummer || 1,
        }));

        res.json(klassiekers);
    } catch (error) {
        res.status(500).json({ error: "Kon klassiekers niet ophalen" });
    }
});

// Eén wedstrijd op slug
router.get("/:slug", async (req, res) => {
    try {
        const { slug } = req.params;
        const { data, error } = await supabase
            .from("wedstrijden")
            .select("*")
            .eq("slug", slug)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Kon wedstrijd niet ophalen" });
    }
});

// Ritten van één wedstrijd
router.get("/:slug/ritten", async (req, res) => {
    try {
        const { slug } = req.params;
        const { data: wedstrijd, error: wedstrijdError } = await supabase
            .from("wedstrijden")
            .select("id, naam, jaar, aantal_ritten, slug")
            .eq("slug", slug)
            .single();

        if (wedstrijdError) throw wedstrijdError;

        const { data: ritten, error: rittenError } = await supabase
            .from("ritten")
            .select("id, rit_nummer, naam, gescrapet")
            .eq("wedstrijd_id", wedstrijd.id)
            .order("rit_nummer", { ascending: true });

        if (rittenError) throw rittenError;

        res.json({ wedstrijd, ritten });
    } catch (error) {
        res.status(500).json({ error: "Kon ritten niet ophalen" });
    }
});
// In je routes/wedstrijden.js of ritten.js
router.post("/:id/sync-startlijst", async (req, res) => {
    const { id } = req.params;

    try {
        const { data: wedstrijd, error: wedstrijdError } = await supabase
            .from("wedstrijden")
            .select("*")
            .eq("id", id)
            .single();

        if (wedstrijdError || !wedstrijd) {
            return res.status(404).json({
                error: "Wedstrijd niet gevonden.",
            });
        }

        if (!wedstrijd.pcs_url) {
            return res.status(400).json({
                error: "Deze wedstrijd heeft geen PCS URL.",
            });
        }

        console.log(
            `🔄 Startlijst sync gestart voor ${wedstrijd.naam}: ${wedstrijd.pcs_url}`,
        );

        const raceData = await scraper.scrapeFullRaceInfo(wedstrijd.pcs_url);

        if (!raceData?.deelnemers || raceData.deelnemers.length === 0) {
            return res.status(400).json({
                error: "Geen deelnemers gevonden. Is de startlijst al bekend op PCS?",
            });
        }

        const { data: opgeslagenRenners, error: rennersError } = await supabase
            .from("renners")
            .upsert(
                raceData.deelnemers.map((renner) => ({
                    naam: renner.naam,
                    slug: renner.slug,
                    ploeg: renner.ploeg || null,
                })),
                { onConflict: "slug" },
            )
            .select("id, slug");

        if (rennersError) throw rennersError;

        const deelnemersRows = raceData.deelnemers
            .map((renner) => {
                const opgeslagenRenner = opgeslagenRenners.find(
                    (item) => item.slug === renner.slug,
                );

                if (!opgeslagenRenner) return null;

                return {
                    wedstrijd_id: Number(id),
                    renner_id: opgeslagenRenner.id,
                    ploeg: renner.ploeg || null,
                    status: "active",
                };
            })
            .filter(Boolean);

        const { error: deelnemersError } = await supabase
            .from("wedstrijd_deelnemers")
            .upsert(deelnemersRows, {
                onConflict: "wedstrijd_id,renner_id",
            });

        if (deelnemersError) throw deelnemersError;

        if (raceData.ritten?.length > 0) {
            const rittenRows = raceData.ritten.map((rit) => ({
                wedstrijd_id: Number(id),
                rit_nummer: rit.rit_nummer,
                naam: rit.naam,
                starttijd: rit.starttijd || null,
            }));

            const { error: rittenError } = await supabase
                .from("ritten")
                .upsert(rittenRows, {
                    onConflict: "wedstrijd_id,rit_nummer",
                });

            if (rittenError) throw rittenError;
        }

        const { error: wedstrijdUpdateError } = await supabase
            .from("wedstrijden")
            .update({
                aantal_ritten: raceData.aantal_ritten || wedstrijd.aantal_ritten,
                start_datum: raceData.start_datum || wedstrijd.start_datum,
                eind_datum: raceData.eind_datum || wedstrijd.eind_datum,
            })
            .eq("id", id);

        if (wedstrijdUpdateError) throw wedstrijdUpdateError;

        res.json({
            success: true,
            message: `${deelnemersRows.length} renners gekoppeld aan ${wedstrijd.naam}.`,
            deelnemers: deelnemersRows.length,
            ritten: raceData.ritten?.length || 0,
        });
    } catch (err) {
        console.error("❌ Sync startlijst fout:", err);
        res.status(500).json({
            error: err.message,
        });
    }
});

// --- HAAL ALLE UITVALLERS VAN EEN WEDSTRIJD OP (INCLUSIEF EIGENAAR) ---
router.get('/:id/uitvallers', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Haal de uitvallers op
        const { data: deelnemers, error } = await supabase
            .from('wedstrijd_deelnemers')
            .select(`renner_id, status, renners (naam, ploeg)`)
            .eq('wedstrijd_id', id)
            .neq('status', 'active');

        if (error) throw error;

        // 2. Zoek de eigenaren op via de actieve draft sessie
        const { data: sessie } = await supabase
            .from('draft_sessies')
            .select('id')
            .eq('wedstrijd_id', id)
            .eq('is_actief', true)
            .single();

        let eigenaarMap = {};
        if (sessie) {
            const { data: draftData } = await supabase
                .from('draft')
                .select('renner_id, spelers(gebruikers(naam))')
                .eq('sessie_id', sessie.id);

            if (draftData) {
                draftData.forEach(d => {
                    eigenaarMap[d.renner_id] = d.spelers?.gebruikers?.naam || "Niemand";
                });
            }
        }

        // 3. Combineer de data
        const resultaat = (deelnemers || []).map(d => ({
            status: d.status,
            renners: d.renners,
            eigenaar: eigenaarMap[d.renner_id] || "Niemand"
        }));

        res.json(resultaat);
    } catch (err) {
        console.error("Fout bij ophalen uitvallers:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
