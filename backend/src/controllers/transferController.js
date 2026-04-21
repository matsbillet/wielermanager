const supabase = require('../db/supabase');

const voerTransferUit = async (req, res) => {
    const { speler_id, wedstrijd_id, rit_nummer, renner_uit_id, renner_in_id } = req.body;

    try {
        console.log(`🔄 Transfer starten voor speler ${speler_id} in rit ${rit_nummer}`);

        // STAP 1: Log de transfer in de 'transfers' tabel
        // Dit is je "bewijsmateriaal" voor de puntentelling later
        const { error: transferError } = await supabase
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

        if (transferError) throw transferError;

        // STAP 2: Update de 'draft' tabel
        // We zoeken de oude renner in het team van de speler en vervangen deze door de nieuwe
        const { error: draftError } = await supabase
            .from('draft')
            .update({ renner_id: renner_in_id })
            .eq('speler_id', speler_id)
            .eq('renner_id', renner_uit_id)
            .eq('wedstrijd_id', wedstrijd_id);

        if (draftError) throw draftError;

        res.json({
            status: "Succes",
            bericht: "Transfer succesvol verwerkt. De nieuwe renner ontvangt punten vanaf de volgende rit."
        });

    } catch (error) {
        console.error("❌ Transfer mislukt:", error.message);
        res.status(500).json({ status: "Fout", foutmelding: error.message });
    }
};

module.exports = { voerTransferUit };