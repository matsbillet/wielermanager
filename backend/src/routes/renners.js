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

        const gekozenIds = new Set((gekozen || []).map((keuze) => Number(keuze.renner_id)));

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