const supabase = require('../db/supabase');

const getStand = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('spelers')
            .select(`
            naam,
            draft!inner (
                is_bank,
                renners!renner_id (
                    id,
                    naam,
                    ritresultaten (
                        rit_punten
                    )
                )
            )
        `);

        if (error) throw error;

        // Bereken de stand
        const stand = data.map(speler => {
            let totaalPunten = 0;
            if (speler.draft) {
                speler.draft.forEach(item => {
                    // Punten tellen alleen als de renner niet op de bank zit
                    if (!item.is_bank && item.renners && item.renners.ritresultaten) {
                        const punten = item.renners.ritresultaten.reduce((sum, r) => sum + r.rit_punten, 0);
                        totaalPunten += punten;
                    }
                });
            }
            return { naam: speler.naam, punten: totaalPunten };
        }).sort((a, b) => b.punten - a.punten);

        res.json(stand);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getStand };