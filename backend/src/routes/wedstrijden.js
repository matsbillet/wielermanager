const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

// Alle wedstrijden
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wedstrijden')
            .select('id, naam, jaar, aantal_ritten, slug')
            .order('jaar', { ascending: false });

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Fout bij ophalen wedstrijden:', error);
        res.status(500).json({ error: 'Kon wedstrijden niet ophalen' });
    }
});

// Eén wedstrijd op slug
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const { data, error } = await supabase
            .from('wedstrijden')
            .select('id, naam, jaar, aantal_ritten, slug')
            .eq('slug', slug)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Fout bij ophalen wedstrijd:', error);
        res.status(500).json({ error: 'Kon wedstrijd niet ophalen' });
    }
});

// Ritten van één wedstrijd
router.get('/:slug/ritten', async (req, res) => {
    try {
        const { slug } = req.params;

        const { data: wedstrijd, error: wedstrijdError } = await supabase
            .from('wedstrijden')
            .select('id, naam, jaar, aantal_ritten, slug')
            .eq('slug', slug)
            .single();

        if (wedstrijdError) throw wedstrijdError;

        const { data: ritten, error: rittenError } = await supabase
            .from('ritten')
            .select('id, rit_nummer, datum, gescrapet')
            .eq('wedstrijd_id', wedstrijd.id)
            .order('rit_nummer', { ascending: true });

        if (rittenError) throw rittenError;

        res.json({
            wedstrijd,
            ritten
        });
    } catch (error) {
        console.error('Fout bij ophalen ritten van wedstrijd:', error);
        res.status(500).json({ error: 'Kon ritten niet ophalen' });
    }
});

module.exports = router;