// backend/src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { runScraper } = require('../scraper/scraper');

router.post('/scrape-rit', async (req, res) => {
    const { ritId, url } = req.body; // De frontend stuurt deze twee mee

    if (!ritId || !url) {
        return res.status(400).json({ error: "ritId en url zijn verplicht voor de scraper." });
    }

    const resultaat = await runScraper(ritId, url);

    if (resultaat.success) {
        res.json({ message: `Succes! ${resultaat.aantal} resultaten verwerkt.` });
    } else {
        res.status(500).json({ error: resultaat.error });
    }
});

module.exports = router;