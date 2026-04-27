const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

router.get('/:wedstrijdId', async (req, res) => {
    try {
        const { wedstrijdId } = req.params;

        // 1. Haal de spelers op die gekoppeld zijn aan de gebruikers
        // We filteren eventueel op competitie als je die logica hebt
        const { data: spelersData, error: spelersError } = await supabase
            .from('spelers')
            .select(`
                id,
                gebruiker_id,
                gebruikers (
                    naam
                )
            `);

        if (spelersError) throw spelersError;

        // 2. Haal alle ritten van deze wedstrijd op
        const { data: ritten, error: rittenError } = await supabase
            .from('ritten')
            .select('id, rit_nummer, gescrapet')
            .eq('wedstrijd_id', wedstrijdId)
            .order('rit_nummer', { ascending: true });

        if (rittenError) throw rittenError;

        // 3. Haal de volledige draft op (welke speler heeft welke renner)
        const { data: draft, error: draftError } = await supabase
            .from('draft')
            .select('speler_id, renner_id');

        if (draftError) throw draftError;

        // 4. Haal alle resultaten op
        // LET OP: Controleer of je kolommen 'punten' en 'trui_punten' heten!
        const { data: ritresultaten, error: resultatenError } = await supabase
            .from('ritresultaten')
            .select('rit_id, renner_id, punten');

        if (resultatenError) throw resultatenError;

        // 5. Bouw het scoreboard
        const scoreboard = spelersData.map((spelerEntry) => {
            const spelerId = spelerEntry.id;
            const spelerNaam = spelerEntry.gebruikers?.naam || 'Onbekend';

            // Welke renners heeft deze speler?
            const rennerIdsVanSpeler = draft
                .filter((d) => d.speler_id === spelerId)
                .map((d) => d.renner_id);

            const per_rit = ritten.map((rit) => {
                // Welke resultaten behaalden deze renners in deze specifieke rit?
                // In scores.js binnen de per_rit map:

                const resultatenVanRit = ritresultaten.filter((res) =>
                    res.rit_id === rit.id &&
                    rennerIdsVanSpeler.includes(res.renner_id)
                );

                const dag_punten = resultatenVanRit.reduce(
                    (som, res) => som + (res.punten || 0),
                    0
                );

                const bonus_punten = resultatenVanRit.reduce(
                    (som, res) => som + (res.trui_punten || 0),
                    0
                );

                return {
                    rit_nummer: rit.rit_nummer,
                    punten: dag_punten + bonus_punten
                };

                const rit_punten = resultatenVanRit.reduce(
                    (som, res) => som + (res.punten || 0),
                    0
                );

                // Hier kun je later truipunten toevoegen als je die apart opslaat
                const truien_punten = 0;

                return {
                    rit_nummer: rit.rit_nummer,
                    punten: rit_punten + truien_punten
                };
            });

            const totaal = per_rit.reduce((som, r) => som + r.punten, 0);

            return {
                speler_id: spelerId,
                speler: spelerNaam,
                totaal,
                per_rit
            };
        });

        // Sorteren op hoogste score
        scoreboard.sort((a, b) => b.totaal - a.totaal);

        res.json(scoreboard);
    } catch (error) {
        console.error('Fout bij ophalen scores:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;