const express = require('express');
const router = express.Router();
const { maakCompetitie, joinCompetitie, getMijnCompetities } = require('../controllers/competitieController');

router.post('/create', maakCompetitie);
router.post('/join', joinCompetitie);
router.get('/mijn/:userId', getMijnCompetities);

module.exports = router;