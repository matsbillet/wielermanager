const express = require("express");
const router = express.Router();
const { supabase } = require("../db/supabase");
const { getSpelersMetDraftVolgorde } = require("../utils/draftOrder");

router.get("/competitie/:competitieId", async (req, res) => {
    const { competitieId } = req.params;

    try {
        const { data: actieveSessie } = await supabase
            .from("draft_sessies")
            .select("id")
            .eq("competitie_id", competitieId)
            .eq("is_actief", true)
            .maybeSingle();

        if (actieveSessie) {
            const spelers = await getSpelersMetDraftVolgorde(actieveSessie.id);
            return res.json(spelers);
        }

        const { data, error } = await supabase
            .from("spelers")
            .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
            .eq("competitie_id", competitieId)
            .order("id", { ascending: true });

        if (error) throw error;

        const spelers = data.map((speler, index) => ({
            id: speler.id,
            naam: speler.gebruikers?.naam || "Onbekende gebruiker",
            gebruikerId: speler.gebruiker_id,
            competitieId: speler.competitie_id,
            draftVolgorde: index + 1,
            vorigeScore: null,
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
        const spelers = await getSpelersMetDraftVolgorde(sessieId);
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