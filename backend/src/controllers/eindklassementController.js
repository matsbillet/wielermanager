const { supabase } = require('../db/supabase');
const { scrapeEindklassement } = require('../scraper/scraper');
const scrapeEindklassementHandler = async (req, res) => {
    const { wedstrijd_id } = req.params;
    try {
        const { data: wedstrijd, error } = await supabase
            .from('wedstrijden')
            .select('id, naam, pcs_url')
            .eq('id', wedstrijd_id)
            .single();

        if (error || !wedstrijd) return res.status(404).json({ error: 'Wedstrijd niet gevonden.' });
        if (!wedstrijd.pcs_url) return res.status(400).json({ error: 'Geen PCS URL ingesteld.' });

        const resultaat = await scrapeEindklassement(wedstrijd.pcs_url, wedstrijd.id);
        res.json({ message: `✅ Eindklassement voor ${wedstrijd.naam} opgeslagen!`, count: resultaat.count });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getEindklassement = async (req, res) => {
    const { wedstrijd_id } = req.params;

    try {
        // Gebruik maybeSingle() en order op is_actief
        const { data: sessie } = await supabase
            .from('draft_sessies')
            .select('id')
            .eq('wedstrijd_id', wedstrijd_id)
            .order('is_actief', { ascending: false })
            .limit(1)
            .maybeSingle();

        console.log(`🔍 Sessie gevonden voor wedstrijd ${wedstrijd_id}:`, sessie);

        const { data, error } = await supabase
            .from('eindklassement')
            .select(`type, positie, punten, renner_id, renners ( naam )`)
            .eq('wedstrijd_id', wedstrijd_id)
            .order('type')
            .order('positie');

        if (error) throw error;

        let eigenaarMap = {};
        if (sessie) {
            const { data: draftData } = await supabase
                .from('draft')
                .select('renner_id, is_bank, spelers(id, gebruikers(naam))')
                .eq('sessie_id', sessie.id);

            console.log(`👥 Draft data gevonden:`, draftData?.length, 'renners');

            (draftData || []).forEach(d => {
                eigenaarMap[d.renner_id] = {
                    naam: d.spelers?.gebruikers?.naam || null,
                    is_bank: d.is_bank,
                };
            });
        }

        const resultaat = data.map(rij => ({
            ...rij,
            eigenaar: eigenaarMap[rij.renner_id]?.naam || null,
            is_bank: eigenaarMap[rij.renner_id]?.is_bank || false,
        }));

        res.json(resultaat);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { scrapeEindklassementHandler, getEindklassement };