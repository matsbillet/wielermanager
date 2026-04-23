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

        const { data: bestaandeGebruiker, error: checkError } = await supabase
            .from('gebruikers')
            .select('id')
            .eq('naam', naam)
            .maybeSingle();

        if (checkError) throw checkError;

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
            .select('id, naam, is_admin')
            .single();

        if (error) throw error;

        const token = jwt.sign(
            { id: data.id, naam: data.naam, is_admin: data.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            bericht: 'Account aangemaakt',
            token,
            gebruiker: {
                id: data.id,
                naam: data.naam,
                is_admin: data.is_admin
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            error: 'Registreren mislukt',
            details: error.message
        });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        const { naam, wachtwoord } = req.body;

        if (!naam || !wachtwoord) {
            return res.status(400).json({ error: 'Naam en wachtwoord zijn verplicht.' });
        }

        const { data: gebruiker, error } = await supabase
            .from('gebruikers')
            .select('id, naam, wachtwoord_hash, is_admin')
            .eq('naam', naam)
            .maybeSingle();

        if (error) throw error;

        if (!gebruiker) {
            return res.status(401).json({ error: 'Ongeldige login' });
        }

        const geldig = await bcrypt.compare(wachtwoord, gebruiker.wachtwoord_hash);

        if (!geldig) {
            return res.status(401).json({ error: 'Ongeldige login' });
        }

        const token = jwt.sign(
            { id: gebruiker.id, naam: gebruiker.naam, is_admin: gebruiker.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            bericht: 'Login geslaagd',
            token,
            gebruiker: {
                id: gebruiker.id,
                naam: gebruiker.naam,
                is_admin: gebruiker.is_admin
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Login mislukt',
            details: error.message
        });
    }
});

module.exports = router;