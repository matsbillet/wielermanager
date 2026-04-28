const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');


router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('spelers')
            .select('id, gebruikers(naam), draft(count)')
            .order('id', { ascending: true });

        if (error) throw error;

        const mapped = data.map(speler => ({
            id: speler.id,
            naam: speler.gebruikers?.naam || 'Onbekende gebruiker',
            aantalGekozen: speler.draft[0]?.count || 0
        }));

        res.json(mapped);
    } catch (error) {
        console.error('Fout bij ophalen spelers:', error);
        res.status(500).json({ error: 'Kon spelers niet ophalen' });
    }
});

module.exports = router;