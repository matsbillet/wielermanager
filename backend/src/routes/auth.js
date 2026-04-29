const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/supabase');

const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {
    try {
        let { naam, wachtwoord } = req.body;

        naam = naam?.toLowerCase().trim();

        if (!naam || !wachtwoord) {
            return res.status(400).json({ error: 'Naam en wachtwoord zijn verplicht.' });
        }

        if (wachtwoord.length < 4) {
            return res.status(400).json({ error: 'Wachtwoord moet minstens 4 tekens hebben.' });
        }

        const { data: bestaandeGebruiker, error: checkError } = await supabase
            .from('gebruikers')
            .select('id')
            .ilike('naam', naam)
            .maybeSingle();

        if (checkError) throw checkError;

        if (bestaandeGebruiker) {
            return res.status(400).json({ error: 'Deze naam is al in gebruik.' });
        }

        const wachtwoord_hash = await bcrypt.hash(wachtwoord, 10);

        const { data: nieuweGebruiker, error } = await supabase
            .from('gebruikers')
            .insert([
                {
                    naam,
                    wachtwoord_hash,
                    is_admin: false
                }
            ])
            .select()
            .single();

        if (error) {
            if (
                error.code === '23505' ||
                error.message?.toLowerCase().includes('duplicate') ||
                error.message?.toLowerCase().includes('unique')
            ) {
                return res.status(400).json({ error: 'Deze naam is al in gebruik.' });
            }

            throw error;
        }

        const { error: spelerError } = await supabase
            .from('spelers')
            .insert([{
                gebruiker_id: nieuweGebruiker.id,
                competitie_id: 1 // Standaard competitie (bijv. "Algemeen")
            }]);

        if (spelerError) {
            throw spelerError;
        }

        const token = jwt.sign(
            { id: nieuweGebruiker.id, naam: nieuweGebruiker.naam, is_admin: nieuweGebruiker.is_admin },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            bericht: 'Account aangemaakt',
            token,
            gebruiker: {
                id: nieuweGebruiker.id,
                naam: nieuweGebruiker.naam,
                is_admin: nieuweGebruiker.is_admin
            }
        });

    } catch (error) {
        console.error('Register error:', error);

        if (
            error.code === '23505' ||
            error.message?.toLowerCase().includes('duplicate') ||
            error.message?.toLowerCase().includes('unique')
        ) {
            return res.status(400).json({ error: 'Deze naam is al in gebruik.' });
        }

        res.status(500).json({
            error: 'Registreren mislukt',
            details: error.message
        });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    try {
        let { naam, wachtwoord } = req.body;

        naam = naam?.toLowerCase().trim();

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