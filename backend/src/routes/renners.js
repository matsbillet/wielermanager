const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

// Alle renners ophalen
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('renners')
            .select('id, naam, slug, ploeg')
            .order('naam', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Fout bij ophalen renners:', error);
        res.status(500).json({ error: 'Kon renners niet ophalen' });
    }
});

// Alleen beschikbare renners ophalen
router.get('/beschikbaar', async (req, res) => {
    try {
        const { data: gekozen, error: draftError } = await supabase
            .from('draft')
            .select('renner_id');

        if (draftError) throw draftError;

        const gekozenIds = gekozen.map((r) => r.renner_id);

        let query = supabase
            .from('renners')
            .select('id, naam, slug, ploeg')
            .order('naam', { ascending: true });

        if (gekozenIds.length > 0) {
            query = query.not('id', 'in', `(${gekozenIds.join(',')})`);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Fout bij ophalen beschikbare renners:', error);
        res.status(500).json({ error: 'Kon beschikbare renners niet ophalen' });
    }
});

module.exports = router;