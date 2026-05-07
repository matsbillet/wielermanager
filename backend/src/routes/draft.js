const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draftController");

router.post("/kies", draftController.voerKeuzeUit);
router.post("/auto-vullen", draftController.vulDraftAutomatisch);
router.get("/teams/:sessieId", draftController.getTeamsPerSessie);
router.get("/team/:sessieId/:spelerId", draftController.getTeamVanSpeler);
router.get("/actieve-speler/:sessieId", draftController.getActieveSpeler);
router.get("/sessies/:competitieId", draftController.getSessiesVoorCompetitie);
router.get("/sessie/:competitieId", draftController.getSessieVoorCompetitie);


router.get("/test", (req, res) => {
    res.json({ bericht: "Draft route werkt naar behoren!" });
});

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('sessies')
            .select('*, wedstrijden(*)') // Haalt ook meteen de wedstrijd info op
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;