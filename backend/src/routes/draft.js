const express = require('express');
const router = express.Router();
const draftController = require('../controllers/draftController');
const { supabase } = require('../db/supabase');

/**
 * Route: POST /api/draft/kies
 * Wordt aangeroepen als een speler een renner selecteert.
 */
router.post('/kies', draftController.voerKeuzeUit);

/**
 * Route: GET /api/draft/test
 * Handig om te checken of deze specifieke route-file werkt.
 */
router.get('/test', (req, res) => {
    res.json({ bericht: "Draft route werkt naar behoren!" });
});

module.exports = router;