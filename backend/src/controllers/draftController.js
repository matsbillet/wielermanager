const supabase = require('../db/supabase');
const { getSpelerVoorBeurt } = require('../utils/draftHelper');

const voerKeuzeUit = async (req, res) => {
    const { spelerId, rennerId, huidigeBeurt } = req.body;

    const volgorde = ["Jente", "Piet", "Jan", "Roel"];
    const info = getSpelerVoorBeurt(huidigeBeurt, volgorde);

    try {
        const { data, error } = await supabase
            .from('draft')
            .insert([
                {
                    beurt_nummer: huidigeBeurt,
                    speler_id: spelerId,
                    renner_id: rennerId,
                    is_bank: info.isBank
                }
            ])
            .select();

        if (error) {
            console.error('Supabase insert error:', error);
            throw error;
        }

        res.json({
            status: 'Succes',
            bericht: `Speler ${spelerId} heeft renner ${rennerId} gekozen!`,
            ronde: info.ronde,
            type: info.isBank ? 'Bankzitter' : 'Basis',
            data
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