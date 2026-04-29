const cron = require('node-cron');
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');

// ELKE AVOND OM 19:00 (Pas aan naar wens)
cron.schedule('0 18 * * *', async () => {
    console.log('🤖 Start automatische rit-sync...');

    try {
        // 1. Zoek ritten van VANDAAG die nog niet gescrapet zijn
        const vandaag = new Date().toISOString().split('T')[0];
        const { data: ritten } = await supabase
            .from('ritten')
            .select('*, wedstrijden(pcs_url, jaar, naam)')
            .eq('gescrapet', false)
            .lte('datum', vandaag); // Alleen ritten tot en met vandaag

        for (const rit of ritten) {
            console.log(`Checking ${rit.wedstrijden.naam} - Rit ${rit.rit_nummer}`);

            const resultaten = await scraper.scrapeRitDetails(rit.wedstrijden.pcs_url, rit.rit_nummer);

            if (resultaten && resultaten.uitslag.length > 0) {
                // Sla uitslag op (jouw bestaande logica voor punten)
                // ... verwerkPunten(rit.id, resultaten) ...

                // Markeer als klaar
                await supabase.from('ritten').update({ gescrapet: true }).eq('id', rit.id);
                console.log(`✅ Rit ${rit.rit_nummer} succesvol gesynchroniseerd.`);
            }
        }

        // 2. Check of de wedstrijd afgelopen is voor "Next Year" logica
        await checkAndScheduleNextYear();

    } catch (err) {
        console.error('❌ Fout tijdens auto-sync:', err);
    }
});

async function checkAndScheduleNextYear() {
    // Zoek actieve wedstrijden
    const { data: wedstrijden } = await supabase.from('wedstrijden').select('*');

    for (const w of wedstrijden) {
        const { count } = await supabase
            .from('ritten')
            .select('*', { count: 'exact', head: true })
            .eq('wedstrijd_id', w.id)
            .eq('gescrapet', false);

        // Als alle ritten gescrapet zijn (count === 0)
        if (count === 0) {
            const volgendJaar = w.jaar + 1;
            const nieuweUrl = w.pcs_url.replace(w.jaar.toString(), volgendJaar.toString());

            // Check of deze al bestaat
            const { data: bestaatAl } = await supabase.from('wedstrijden').select('id').eq('pcs_url', nieuweUrl).single();

            if (!bestaatAl) {
                console.log(`📅 Nieuwe race gedetecteerd voor volgend jaar: ${nieuweUrl}`);
                // Optioneel: Stuur jezelf een mail of initialiseer hem direct (voorzichtig hiermee!)
            }
        }
    }
}