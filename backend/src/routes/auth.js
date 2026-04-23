const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');

const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {
    try {
        const { naam, wachtwoord } = req.body;

        if (!naam || !wachtwoord) {
            return res.status(400).json({ error: 'Naam en wachtwoord zijn verplicht.' });
        }

        if (wachtwoord.length < 4) {
            return res.status(400).json({ error: 'Wachtwoord moet minstens 4 tekens hebben.' });
        }

        // check unieke naam
        const { data: bestaandeGebruiker } = await supabase
            .from('gebruikers')
            .select('id')
            .eq('naam', naam)
            .maybeSingle();

        if (bestaandeGebruiker) {
            return res.status(400).json({ error: 'Deze naam is al in gebruik.' });
        }

        const wachtwoord_hash = await bcrypt.hash(wachtwoord, 10);

        const { data, error } = await supabase
            .from('gebruikers')
            .insert([
                {
                    naam,
                    wachtwoord_hash
                }
            ])
            .select('id, naam')
            .single();

        if (error) throw error;

        const token = jwt.sign(
            { id: data.id, naam: data.naam },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            bericht: 'Account aangemaakt',
            token,
            gebruiker: data
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registreren mislukt' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { naam, wachtwoord } = req.body;

        if (!naam || !wachtwoord) {
            return res.status(400).json({ error: 'Naam en wachtwoord zijn verplicht.' });
        }

        const { data: gebruiker } = await supabase
            .from('gebruikers')
            .select('*')
            .eq('naam', naam)
            .maybeSingle();

        if (!gebruiker) {
            return res.status(401).json({ error: 'Ongeldige login' });
        }

        const geldig = await bcrypt.compare(wachtwoord, gebruiker.wachtwoord_hash);

        if (!geldig) {
            return res.status(401).json({ error: 'Ongeldige login' });
        }

        const token = jwt.sign(
            { id: gebruiker.id, naam: gebruiker.naam },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            gebruiker: {
                id: gebruiker.id,
                naam: gebruiker.naam
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login mislukt' });
    }
});

module.exports = router;