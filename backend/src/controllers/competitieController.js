const { supabase } = require('../db/supabase');

// 1. Een nieuwe competitie aanmaken
const maakCompetitie = async (req, res) => {
    // We verwachten nu ook een wedstrijdId vanuit de frontend!
    const { naam, beheerderId, wedstrijdId } = req.body;

    try {
        // Stap A: Maak de competitie aan
        const { data: competitie, error: compError } = await supabase
            .from('Competities')
            .insert([{
                Naam: naam,
                beheerder_id: beheerderId,
                wedstrijd_id: wedstrijdId // Nu dynamisch!
            }])
            .select()
            .single();

        if (compError) throw compError;

        // Stap B: De beheerder automatisch laten deelnemen als eerste speler
        const { error: spelerError } = await supabase
            .from('spelers')
            .insert([{
                gebruiker_id: beheerderId,
                competitie_id: competitie.id
            }]);

        if (spelerError) throw spelerError;

        // Stap C: Maak direct een actieve draft sessie aan voor deze competitie
        const { error: sessieError } = await supabase
            .from('draft_sessies')
            .insert([{
                Naam: `Draft ${naam}`,
                competitie_id: competitie.id,
                is_actief: true,
                wedstrijd_id: wedstrijdId // Zelfde wedstrijd als de competitie
            }]);

        if (sessieError) throw sessieError;

        res.json({
            status: 'Succes',
            bericht: `Competitie '${naam}' succesvol aangemaakt!`,
            competitie
        });

    } catch (error) {
        console.error("Fout bij aanmaken competitie:", error);
        res.status(500).json({ error: 'Kon competitie niet aanmaken', details: error.message });
    }
};

// 2. Een gebruiker laten deelnemen aan een bestaande competitie
const joinCompetitie = async (req, res) => {
    const { gebruikerId, competitieId } = req.body;

    try {
        // Controleer of de gebruiker niet al in deze competitie zit
        const { data: bestaandeSpeler } = await supabase
            .from('spelers')
            .select('id')
            .eq('gebruiker_id', gebruikerId)
            .eq('competitie_id', competitieId)
            .single();

        if (bestaandeSpeler) {
            return res.status(400).json({ error: 'Je doet al mee aan deze competitie.' });
        }

        const { data, error } = await supabase
            .from('spelers')
            .insert([{
                gebruiker_id: gebruikerId,
                competitie_id: competitieId
            }]);

        if (error) throw error;

        res.json({ status: 'Succes', bericht: 'Je bent nu deelnemer!' });

    } catch (error) {
        res.status(500).json({ error: 'Deelname mislukt', details: error.message });
    }
};

const getMijnCompetities = async (req, res) => {
    const { userId } = req.params;

    const { data, error } = await supabase
        .from('spelers')
        .select('competitie_id, Competities ( id, Naam )')
        .eq('gebruiker_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data.map(d => d.Competities).filter(c => c !== null));
};

module.exports = { maakCompetitie, joinCompetitie, getMijnCompetities };