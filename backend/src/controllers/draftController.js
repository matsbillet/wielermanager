const { supabase } = require('../db/supabase');
const { getSpelerVoorBeurt } = require('../utils/draftHelper');

const voerKeuzeUit = async (req, res) => {
    const { spelerId, rennerId } = req.body;
    const volgorde = ["Jente", "Piet", "Jan", "Roel"];

    try {
        // 1. Check hoeveel rijen er al in de 'draft' tabel staan
        const { count, error: countError } = await supabase
            .from('draft')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;

        // 2. De beurt is altijd het huidige aantal + 1
        const huidigeBeurt = (count || 0) + 1;

        // 3. Bereken wie er aan de beurt is op basis van de slangvolgorde
        const info = getSpelerVoorBeurt(huidigeBeurt, volgorde);

        // Optioneel: Validatie of de juiste speler de request stuurt
        // if (volgorde[spelerId] !== info.spelerNaam) { ... }

        if (!info) {
            return res.status(400).json({
                error: 'Draft voltooid',
                bericht: 'Iedereen heeft al 18 renners gekozen. De draft is afgelopen!'
            });
        }

        // 4. Voeg de keuze toe aan de database
        const { data, error: insertError } = await supabase
            .from('draft')
            .insert([
                {
                    beurt_nummer: huidigeBeurt,
                    speler_id: spelerId,
                    renner_id: rennerId,
                    ronde: info.ronde,
                    is_bank: info.isBank // Gebruikt de logica: ronde > 12
                }
            ])
            .select();

        if (insertError) throw insertError;

        // 5. Stuur het resultaat terug naar de frontend
        res.json({
            status: 'Succes',
            bericht: `${info.spelerNaam} (Beurt ${huidigeBeurt}) heeft renner ${rennerId} gekozen!`,
            volgendeBeurt: huidigeBeurt + 1,
            ronde: info.ronde,
            isBank: info.isBank,
            data
        });

    } catch (error) {
        console.error('Fout bij uitvoeren keuze:', error);
        res.status(500).json({ error: 'Kon keuze niet verwerken', details: error.message });
    }
};

module.exports = { voerKeuzeUit };

