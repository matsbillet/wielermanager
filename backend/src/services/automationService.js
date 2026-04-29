const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');

async function syncNieuweResultaten() {
    console.log('🤖 Controle op onverwerkte ritten gestart...');

    // 1. Zoek ritten die nog niet gescrapet zijn
    // We pakken ook de pcs_url van de bijbehorende wedstrijd erbij via een join
    const { data: ritten, error } = await supabase
        .from('ritten')
        .select(`
            id, 
            rit_nummer, 
            naam, 
            gescrapet,
            wedstrijden (
                id,
                pcs_url,
                naam
            )
        `)
        .eq('gescrapet', false);

    if (error) {
        console.error('❌ Fout bij ophalen ritten:', error);
        return;
    }

    if (ritten.length === 0) {
        console.log('Slapende honden... Alle ritten zijn al verwerkt. ✅');
        return;
    }

    console.log(`📊 Gevonden: ${ritten.length} ritten om te controleren.`);

    for (const rit of ritten) {
        const raceUrl = rit.wedstrijden.pcs_url;
        const ritNr = rit.rit_nummer;

        console.log(`🔎 Scrapen: ${rit.wedstrijden.naam} - Rit ${ritNr}...`);

        try {
            const resultaat = await scraper.scrapeRitDetails(raceUrl, ritNr);

            // Controleer of er daadwerkelijk een uitslag is (rit moet gefinisht zijn)
            if (resultaat && resultaat.uitslag && resultaat.uitslag.length > 0) {
                console.log(`✅ Uitslag gevonden voor rit ${ritNr}. Bezig met verwerken...`);

                // HIER roep je jouw bestaande functie aan die de punten berekent en opslaat
                // Bijvoorbeeld: await verwerkRitPunten(rit.id, resultaat);

                // Update de rit status zodat we hem de volgende keer overslaan
                await supabase
                    .from('ritten')
                    .update({ gescrapet: true })
                    .eq('id', rit.id);

                console.log(`✨ Rit ${ritNr} succesvol afgerond.`);
            } else {
                console.log(`⏳ Rit ${ritNr} heeft nog geen uitslag op PCS. Overslaan...`);
            }
        } catch (err) {
            console.error(`❌ Fout bij verwerken rit ${ritNr}:`, err.message);
        }
    }
}

module.exports = { syncNieuweResultaten };