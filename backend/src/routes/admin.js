const express = require('express');
const router = express.Router();
const { runScraper } = require('../scraper/scraper');

router.post('/scrape-rit', async (req, res) => {
    const { ritId, url } = req.body;

    if (!ritId || !url) {
        return res.status(400).json({ error: "ritId en url zijn verplicht." });
    }

    const resultaat = await runScraper(ritId, url);

    if (resultaat.success) {
        res.json({ message: `Succesvol ${resultaat.aantal} renners gescrapet voor rit ${ritId}` });
    } else {
        res.status(500).json({ error: resultaat.error });
    }
});

module.exports = router;