const express = require("express");
const router = express.Router();
const { supabase } = require("../db/supabase");

router.get("/", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("renners")
            .select("id, naam, slug, ploeg")
            .order("naam", { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error("Fout bij ophalen renners:", error);
        res.status(500).json({ error: "Kon renners niet ophalen" });
    }
});

// --- RENNER HANDMATIG TOEVOEGEN + DIRECT KOPPELEN AAN WEDSTRIJD ---
router.post('/', async (req, res) => {
    // We verwachten nu ook een wedstrijd_id mee te krijgen!
    const { naam, slug, team, pcs_id, wedstrijd_id } = req.body;

    // Als de frontend 'pcs_id' stuurt (zoals je had), of 'slug', of we maken er zelf één:
    const rennerSlug = slug || pcs_id || naam.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    try {
        if (!wedstrijd_id) {
            return res.status(400).json({ error: "Selecteer een wedstrijd waar je de renner aan wilt toevoegen." });
        }

        // 1. Maak de renner aan in de algemene 'renners' tabel (als hij nog niet bestaat)
        const { data: renner, error: insertErr } = await supabase
            .from('renners')
            .upsert(
                { naam, slug: rennerSlug, ploeg: team || null },
                { onConflict: 'slug' } // Als de slug al bestaat, update hij hem gewoon
            )
            .select('id')
            .single();

        if (insertErr) throw insertErr;

        // 2. Koppel de renner aan de wedstrijd, zodat hij zichtbaar wordt in de draft!
        const { error: koppelErr } = await supabase
            .from('wedstrijd_deelnemers')
            .upsert(
                { wedstrijd_id: wedstrijd_id, renner_id: renner.id },
                { onConflict: 'wedstrijd_id,renner_id' }
            );

        if (koppelErr) throw koppelErr;

        res.json({ success: true, message: "Renner succesvol toegevoegd aan de draft!" });

    } catch (err) {
        console.error("Fout bij handmatig renner toevoegen:", err);
        res.status(500).json({ error: err.message || "Fout op de server bij opslaan renner." });
    }
});

router.get("/beschikbaar/:sessieId", async (req, res) => {
    const { sessieId } = req.params;

    try {
        const { data: sessie, error: sessieError } = await supabase
            .from("draft_sessies")
            .select("id, wedstrijd_id")
            .eq("id", sessieId)
            .single();

        if (sessieError || !sessie) {
            return res.status(404).json({ error: "Draftsessie niet gevonden." });
        }

        const { data: deelnemers, error: deelnemersError } = await supabase
            .from("wedstrijd_deelnemers")
            .select("renners(id, naam, slug, ploeg)")
            .eq("wedstrijd_id", sessie.wedstrijd_id);

        if (deelnemersError) throw deelnemersError;

        const { data: gekozen, error: gekozenError } = await supabase
            .from("draft")
            .select("renner_id")
            .eq("sessie_id", sessieId);

        if (gekozenError) throw gekozenError;

        const gekozenIds = new Set(
            (gekozen || [])
                .filter((keuze) => keuze.renner_id !== null)
                .map((keuze) => Number(keuze.renner_id))
        );

        const beschikbareRenners = (deelnemers || [])
            .map((deelnemer) => deelnemer.renners)
            .filter(Boolean)
            .filter((renner) => !gekozenIds.has(Number(renner.id)))
            .sort((a, b) => a.naam.localeCompare(b.naam));

        res.json(beschikbareRenners);
    } catch (error) {
        console.error("Fout bij ophalen beschikbare renners:", error);
        res.status(500).json({
            error: "Kon beschikbare renners niet ophalen",
            details: error.message,
        });
    }
});

module.exports = router;