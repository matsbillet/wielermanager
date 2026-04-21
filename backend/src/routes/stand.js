const express = require('express');
const router = express.Router();
const standController = require('../controllers/standController');

/**
 * Route: GET /api/stand/totaal
 * Haalt de berekende stand op van alle spelers.
 */
router.get('/totaal', standController.getStand);

/**
 * Route: GET /api/stand/test
 * Handig om te controleren of dit bestand correct geladen wordt in app.js
 */
router.get('/test', (req, res) => {
    res.json({
        bericht: "De stand-router is correct verbonden!",
        uitleg: "Als je dit ziet, werkt de export/import van stand.js."
    });
});

module.exports = router;