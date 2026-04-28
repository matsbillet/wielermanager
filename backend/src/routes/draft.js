const express = require("express");
const router = express.Router();
const draftController = require("../controllers/draftController");

router.post("/kies", draftController.voerKeuzeUit);
router.get("/teams/:sessieId", draftController.getTeamsPerSessie);
router.get("/actieve-speler/:sessieId", draftController.getActieveSpeler);

router.get("/test", (req, res) => {
    res.json({ bericht: "Draft route werkt naar behoren!" });
});

module.exports = router;