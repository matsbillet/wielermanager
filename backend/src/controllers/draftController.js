const supabase = require('../db/supabase');
const { getSpelerVoorBeurt } = require('../utils/draftHelper');

const voerKeuzeUit = async (req, res) => {
    // De frontend stuurt: welke speler, welke renner (slug) en welk beurtnummer
    const { spelerNaam, rennerSlug, huidigeBeurt } = req.body;

    // 1. Bereken de ronde en bankzitter-status via je helper
    // De volgorde vorig jaar: [Laatste, 3de, 2de, Winnaar]
    const volgorde = ["Jente", "Piet", "Jan", "Roel"];
    const info = getSpelerVoorBeurt(huidigeBeurt, volgorde);

    try {
        // 2. Sla de keuze op in de 'draft' tabel
        const { data, error } = await supabase
            .from('draft')
            .insert([
                {
                    beurt_nummer: huidigeBeurt,
                    speler_naam: spelerNaam,
                    renner_slug: rennerSlug,
                    is_bank: info.isBank
                }
            ]);

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        res.json({
            status: "Succes",
            bericht: `${spelerNaam} heeft ${rennerSlug} gekozen!`,
            ronde: info.ronde,
            type: info.isBank ? "Bankzitter" : "Basis"
        });

    } catch (error) {
        console.error('Supabase fout bij draft keuze:', error);

        res.status(400).json({
            error: 'Draft keuze mislukt',
            details: error.message
        });
    }
};

module.exports = { voerKeuzeUit };