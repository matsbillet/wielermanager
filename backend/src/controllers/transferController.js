const { supabase } = require('../db/supabase');

const voerWisselUit = async (req, res) => {
    const { speler_id, wedstrijd_id, rit_nummer, renner_uit_id, renner_in_id } = req.body;

    try {
        console.log(`🔄 Wissel starten voor speler ${speler_id} bij start rit ${rit_nummer}`);

        // STAP 1: De renner die eruit gaat op de bank zetten
        const { error: uitError } = await supabase
            .from('draft')
            .update({ is_bank: true })
            .eq('speler_id', speler_id)
            .eq('renner_id', renner_uit_id);

        if (uitError) throw uitError;

        // STAP 2: De renner die erin komt van de bank halen
        const { error: inError } = await supabase
            .from('draft')
            .update({ is_bank: false })
            .eq('speler_id', speler_id)
            .eq('renner_id', renner_in_id);

        if (inError) throw inError;

        // STAP 3: Log de wissel in de 'transfers' tabel als bewijs voor de puntentelling
        const { error: logError } = await supabase
            .from('transfers')
            .insert([
                {
                    speler_id,
                    wedstrijd_id,
                    rit_nummer,
                    renner_uit: renner_uit_id,
                    renner_in: renner_in_id
                }
            ]);

        if (logError) throw logError;

        res.json({
            status: "Succes",
            bericht: "Wissel verwerkt: Basis en bank zijn omgedraaid!"
        });

    } catch (error) {
        console.error("❌ Wissel mislukt:", error.message);
        res.status(500).json({ status: "Fout", foutmelding: error.message });
    }
};

module.exports = { voerWisselUit };