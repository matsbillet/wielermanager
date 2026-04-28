const { supabase } = require('../db/supabase');
const { getSpelerVoorBeurt } = require('../utils/draftHelper');

const voerKeuzeUit = async (req, res) => {
    const { spelerId, rennerId } = req.body;


    try {
        // 1. Zoek de actieve sessie
        // GEBRUIK: 'Draft_sessies' en 'is_actief' (zoals in je screenshot)
        const { data: speler } = await supabase
            .from('spelers')
            .select('competitie_id')
            .eq('id', spelerId)
            .single();

        if (!speler) return res.status(404).json({ error: "Speler niet gevonden." });

        // 2. Zoek de actieve sessie voor EXACT DEZE competitie
        const { data: actieveSessie, error: sessieError } = await supabase
            .from('draft_sessies')
            .select('id')
            .eq('competitie_id', speler.competitie_id)
            .eq('is_actief', true)
            .single();

        if (sessieError || !actieveSessie) {
            return res.status(404).json({ error: "Geen actieve draft-sessie voor deze competitie." });
        }

        const sessieId = actieveSessie.id;

        // 3. Haal ALLEEN de spelers op uit DEZE competitie
        const { data: spelers, error: spelersError } = await supabase
            .from('spelers')
            .select('id, gebruikers ( naam )')
            .eq('competitie_id', speler.competitie_id)
            .order('id', { ascending: true });

        if (spelersError || !spelers) {
            return res.status(500).json({ error: "Kon spelers niet ophalen." });
        }

        const getransformeerdeSpelers = spelers.map(s => ({
            id: s.id,
            naam: s.gebruikers?.naam
        }));
        // 2. Tel beurten voor deze specifieke sessie
        const { count, error: countError } = await supabase
            .from('draft')
            .select('*', { count: 'exact', head: true })
            .eq('sessie_id', sessieId);

        if (countError) throw countError;

        const huidigeBeurt = (count || 0) + 1;

        // Slangvolgorde: Oneven rondes 1->4, Even rondes 4->1
        const info = getSpelerVoorBeurt(huidigeBeurt, getransformeerdeSpelers);

        if (!info) {
            return res.status(400).json({ error: 'Draft voltooid' });
        }

        // 3. RPC aanroep
        // De parameters (p_...) moeten matchen met je SQL functie
        const { data, error: rpcError } = await supabase.rpc('voer_draft_keuze_uit', {
            p_sessie_id: sessieId,
            p_speler_id: info.spelerId,
            p_renner_id: rennerId,
            p_ronde: info.ronde, // De eerste 12 zijn vast, de laatste 6 zijn bank
            p_is_bank: info.isBank
        });

        if (rpcError) throw rpcError;

        res.json({
            status: 'Succes',
            bericht: `${info.spelerNaam} heeft gekozen!`,
            data
        });

    } catch (error) {
        console.error('VOLLEDIGE FOUT:', error);
        res.status(500).json({
            error: 'Draft actie mislukt',
            details: error.message
        });
    }
};

const getTeamsPerSessie = async (req, res) => {
    const { sessieId } = req.params; // We halen de ID uit de URL, bijv. /api/draft/teams/1

    try {
        const { data, error } = await supabase
            .from('draft')
            .select(`
                id,
                ronde,
                is_bank,
                beurt_nummer,
                renners (id, naam), 
                spelers (id, gebruikers (naam))
            `)
            .eq('sessie_id', sessieId)
            .order('beurt_nummer', { ascending: true });

        if (error) throw error;

        //Optioneel: Groepeer de data alvast in de backend per speler
        const teams = data.reduce((acc, keuze) => {
            const spelerNaam = keuze.spelers.gebruikers.naam;
            if (!acc[spelerNaam]) acc[spelerNaam] = [];
            acc[spelerNaam].push({
                renner: keuze.renners.naam,
                ronde: keuze.ronde,
                isBank: keuze.is_bank
            });
            return acc;
        }, {});

        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: 'Kon teams niet ophalen', details: error.message });
    }
};

const getActieveSpeler = async (req, res) => {
    const { sessieId } = req.params; // We verwachten nu een ID vanuit de URL!

    try {
        // Zoek de sessie en kijk bij welke competitie deze hoort
        const { data: actieveSessie, error: sessieError } = await supabase
            .from('draft_sessies')
            .select('id, competitie_id')
            .eq('id', sessieId)
            .single();

        if (sessieError || !actieveSessie) {
            return res.status(404).json({ error: 'Geen sessie gevonden.' });
        }

        // Haal alleen de spelers van deze specifieke competitie op
        const { data: spelersRaw, error: spelersError } = await supabase
            .from('spelers')
            .select('id, gebruikers ( naam )')
            .eq('competitie_id', actieveSessie.competitie_id)
            .order('id', { ascending: true });

        if (spelersError) throw spelersError;

        const spelers = spelersRaw?.map(s => ({
            id: s.id,
            naam: s.gebruikers?.naam
        }));

        const { count, error: countError } = await supabase
            .from('draft')
            .select('*', { count: 'exact', head: true })
            .eq('sessie_id', actieveSessie.id);

        if (countError) throw countError;

        const huidigeBeurt = (count || 0) + 1;
        const info = getSpelerVoorBeurt(huidigeBeurt, spelers);

        res.json(info);
    } catch (error) {
        res.status(500).json({ error: 'Kon actieve speler niet ophalen', details: error.message });
    }
};

const getSessieVoorCompetitie = async (req, res) => {
    const { competitieId } = req.params;
    try {
        const { data, error } = await supabase
            .from('draft_sessies')
            .select('id, Naam, is_actief, wedstrijd_id')
            .eq('competitie_id', competitieId)
            .eq('is_actief', true)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Geen actieve sessie gevonden voor deze competitie.' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Fout bij ophalen sessie.' });
    }
};
module.exports = { voerKeuzeUit, getTeamsPerSessie, getActieveSpeler, getSessieVoorCompetitie };
