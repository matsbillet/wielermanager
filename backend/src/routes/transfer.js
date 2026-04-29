const express = require("express");
const router = express.Router();

const {
    vervangVoorStart,
    blessureWissel
} = require("../controllers/transferController");

router.post("/voor-start", vervangVoorStart);
router.post("/blessure", blessureWissel);

module.exports = router;