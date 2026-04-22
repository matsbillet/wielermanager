const express = require('express');
const router = express.Router();
const { voerWisselUit } = require('../controllers/transferController');
const { supabase } = require('../db/supabase');

// De route voor een wissel (Basis <-> Bank)
// We gebruiken POST omdat we data naar de database sturen
router.post('/transfer', voerWisselUit);

module.exports = router;