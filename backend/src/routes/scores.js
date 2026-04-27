const express = require('express');
const router = express.Router();
const { supabase } = require('../db/supabase');

router.get('/:wedstrijdId', async (req, res) => {
    try {
        const { wedstrijdId } = req.params;

        const { data: spelers, error: spelersError } = await supabase
            .from('gebruikers')
            .select('id, naam')
            .order('naam', { ascending: true });

        if (spelersError) throw spelersError;

        const { data: ritten, error: rittenError } = await supabase
            .from('ritten')
            .select('id, rit_nummer, wedstrijd_id, gescrapet')
            .eq('wedstrijd_id', wedstrijdId)
            .order('rit_nummer', { ascending: true });

        if (rittenError) throw rittenError;

        const { data: draft, error: draftError } = await supabase
            .from('draft')
            .select('speler_id, renner_id');

        if (draftError) throw draftError;

        const { data: ritresultaten, error: resultatenError } = await supabase
            .from('ritresultaten')
            .select('rit_id, renner_id, rit_punten, truien_punten');

        if (resultatenError) throw resultatenError;

        const scoreboard = spelers.map((speler) => {
            const rennerIdsVanSpeler = draft
                .filter((d) => d.speler_id === speler.id)
                .map((d) => d.renner_id);

            const per_rit = ritten.map((rit) => {
                const resultatenVanRit = ritresultaten.filter((resultaat) =>
                    resultaat.rit_id === rit.id &&
                    rennerIdsVanSpeler.includes(resultaat.renner_id)
                );

                const rit_punten = resultatenVanRit.reduce(
                    (som, resultaat) => som + (resultaat.rit_punten || 0),
                    0
                );

                const truien_punten = resultatenVanRit.reduce(
                    (som, resultaat) => som + (resultaat.truien_punten || 0),
                    0
                );

                return {
                    rit_nummer: rit.rit_nummer,
                    rit_punten,
                    truien_punten,
                    punten: rit_punten + truien_punten
                };
            });

            const totaal = per_rit.reduce((som, rit) => som + rit.punten, 0);

            return {
                speler_id: speler.id,
                speler: speler.naam,
                totaal,
                per_rit
            };
        });

        scoreboard.sort((a, b) => b.totaal - a.totaal);

        res.json(scoreboard);
    } catch (error) {
        console.error('Fout bij ophalen scores:', error);
        res.status(500).json({
            error: 'Kon scoreboard niet ophalen',
            details: error.message
        });
    }
});

module.exports = router;