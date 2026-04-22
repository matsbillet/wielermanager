const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { naam, email, wachtwoord } = req.body;

        if (!naam || !email || !wachtwoord) {
            return res.status(400).json({ error: 'Naam, email en wachtwoord zijn verplicht.' });
        }

        if (wachtwoord.length < 6) {
            return res.status(400).json({ error: 'Wachtwoord moet minstens 6 tekens hebben.' });
        }

        const { data: bestaandeNaam, error: naamError } = await supabase
            .from('gebruikers')
            .select('id')
            .eq('naam', naam)
            .maybeSingle();

        if (naamError) throw naamError;

        if (bestaandeNaam) {
            return res.status(400).json({ error: 'Deze naam is al in gebruik.' });
        }

        const { data: bestaandeEmail, error: emailError } = await supabase
            .from('gebruikers')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (emailError) throw emailError;

        if (bestaandeEmail) {
            return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
        }

        const wachtwoord_hash = await bcrypt.hash(wachtwoord, 10);

        const { data, error } = await supabase
            .from('gebruikers')
            .insert([
                {
                    naam,
                    email,
                    wachtwoord_hash
                }
            ])
            .select('id, naam, email')
            .single();

        if (error) throw error;

        const token = jwt.sign(
            { id: data.id, naam: data.naam, email: data.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            bericht: 'Account aangemaakt.',
            token,
            gebruiker: data
        });
    } catch (error) {
        console.error('Fout bij registreren:', error);
        res.status(500).json({
            error: 'Registreren mislukt.',
            details: error.message
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { naam, wachtwoord } = req.body;

        if (!naam || !wachtwoord) {
            return res.status(400).json({ error: 'Naam en wachtwoord zijn verplicht.' });
        }

        const { data: gebruiker, error } = await supabase
            .from('gebruikers')
            .select('id, naam, email, wachtwoord_hash')
            .eq('naam', naam)
            .maybeSingle();

        if (error) throw error;

        if (!gebruiker) {
            return res.status(401).json({ error: 'Ongeldige login.' });
        }

        const geldig = await bcrypt.compare(wachtwoord, gebruiker.wachtwoord_hash);

        if (!geldig) {
            return res.status(401).json({ error: 'Ongeldige login.' });
        }

        const token = jwt.sign(
            { id: gebruiker.id, naam: gebruiker.naam, email: gebruiker.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            bericht: 'Login geslaagd.',
            token,
            gebruiker: {
                id: gebruiker.id,
                naam: gebruiker.naam,
                email: gebruiker.email
            }
        });
    } catch (error) {
        console.error('Fout bij login:', error);
        res.status(500).json({
            error: 'Login mislukt.',
            details: error.message
        });
    }
});

module.exports = router;