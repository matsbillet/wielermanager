const express = require("express");
const router = express.Router();
const { supabase } = require("../db/supabase");

router.get("/competitie/:competitieId", async (req, res) => {
    const { competitieId } = req.params;

    try {
        const { data, error } = await supabase
            .from("spelers")
            .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
            .eq("competitie_id", competitieId)
            .order("id", { ascending: true });

        if (error) throw error;

        const spelers = data.map((speler) => ({
            id: speler.id,
            naam: speler.gebruikers?.naam || "Onbekende gebruiker",
            gebruikerId: speler.gebruiker_id,
            competitieId: speler.competitie_id,
        }));

        res.json(spelers);
    } catch (error) {
        console.error("Fout bij ophalen spelers voor competitie:", error);
        res.status(500).json({
            error: "Kon spelers niet ophalen",
            details: error.message,
        });
    }
});

router.get("/:sessieId", async (req, res) => {
    const { sessieId } = req.params;

    try {
        const { data: sessie, error: sessieError } = await supabase
            .from("draft_sessies")
            .select("id, competitie_id")
            .eq("id", sessieId)
            .single();

        if (sessieError || !sessie) {
            return res.status(404).json({ error: "Draftsessie niet gevonden." });
        }

        const { data, error } = await supabase
            .from("spelers")
            .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
            .eq("competitie_id", sessie.competitie_id)
            .order("id", { ascending: true });

        if (error) throw error;

        const spelers = data.map((speler) => ({
            id: speler.id,
            naam: speler.gebruikers?.naam || "Onbekende gebruiker",
            gebruikerId: speler.gebruiker_id,
            competitieId: speler.competitie_id,
        }));

        res.json(spelers);
    } catch (error) {
        console.error("Fout bij ophalen spelers:", error);
        res.status(500).json({
            error: "Kon spelers niet ophalen",
            details: error.message,
        });
    }
});

module.exports = router;