const supabase = require('../db/supabase');

const getStand = async (req, res) => {
    try {
        // Haal spelers op met hun draft en de bijbehorende ritresultaten
        const { data, error } = await supabase
            .from('spelers')
            .select(`
            naam,
            draft!inner (
                is_bank,
                renners!inner (
                    id,
                    naam,
                    ritresultaten (
                        rit_punten
                    )
                )
            )
        `);

        if (error) throw error;

        // Bereken punten per speler
        const stand = data.map(speler => {
            let totaalPunten = 0;

            if (speler.draft) {
                speler.draft.forEach(selectie => {
                    // Punten tellen alleen als de renner niet op de bank zit
                    if (!selectie.is_bank && selectie.renners && selectie.renners.ritresultaten) {
                        const punten = selectie.renners.ritresultaten.reduce((sum, r) => sum + r.rit_punten, 0);
                        totaalPunten += punten;
                    }
                });
            }

            return { naam: speler.naam, punten: totaalPunten };
        }).sort((a, b) => b.punten - a.punten); // Sorteer van hoog naar laag

        res.json(stand);
    } catch (err) {
        console.error("Fout in getStand:", err.message);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getStand };