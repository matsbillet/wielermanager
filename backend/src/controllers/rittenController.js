const { supabase } = require('../db/supabase');

const getRittenPerWedstrijd = async (req, res) => {
    const { slug } = req.params;
    try {
        const { data: wedstrijd, error: wErr } = await supabase
            .from('wedstrijden').select('*').eq('slug', slug).single();

        if (wErr || !wedstrijd) return res.status(404).json({ error: "Wedstrijd niet gevonden" });

        let { data: ritten } = await supabase
            .from('ritten').select('*').eq('wedstrijd_id', wedstrijd.id).order('rit_nummer', { ascending: true });

        res.json(ritten);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getVolgendeRit = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ritten')
            .select('rit_nummer, starttijd, naam')
            .gt('starttijd', new Date().toISOString())
            .order('starttijd', { ascending: true })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is 'geen resultaat'
        res.json(data || { bericht: "Geen toekomstige ritten gevonden" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getDeadlines = async (req, res) => {
    const { wedstrijd_id } = req.params;
    try {
        const { data: rit1 } = await supabase
            .from('ritten')
            .select('starttijd')
            .eq('wedstrijd_id', wedstrijd_id)
            .eq('rit_nummer', 1)
            .single();

        const { data: volgendeRit } = await supabase
            .from('ritten')
            .select('rit_nummer, starttijd, naam')
            .eq('wedstrijd_id', wedstrijd_id)
            .gt('starttijd', new Date().toISOString())
            .order('starttijd', { ascending: true })
            .limit(1)
            .single();

        res.json({
            groteStart: rit1?.starttijd || null,
            volgendeRit: volgendeRit || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getRittenPerWedstrijd, getVolgendeRit, getDeadlines };