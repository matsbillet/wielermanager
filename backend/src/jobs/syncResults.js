const cron = require('node-cron');
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');
const { verwerkRitResultaat } = require('../routes/ritten');

cron.schedule('0 18 * * *', async () => {
    console.log('🤖 Start automatische rit-sync...');

    try {
        const vandaag = new Date().toISOString().split('T')[0];

        const { data: ritten, error } = await supabase
            .from('ritten')
            .select(`
                *,
                wedstrijden (
                    id,
                    pcs_url,
                    jaar,
                    naam,
                    is_eendagskoers
                )
            `)
            .eq('gescrapet', false)
            .lte('starttijd', `${vandaag}T23:59:59+02:00`);

        if (error) throw error;

        if (!ritten || ritten.length === 0) {
            console.log('Geen ritten gevonden om te syncen.');
            return;
        }

        for (const rit of ritten) {
            try {
                console.log(`Checking ${rit.wedstrijden.naam} - Rit ${rit.rit_nummer}`);

                const resultaat = await scraper.scrapeRitDetails(
                    rit.wedstrijden.pcs_url,
                    rit.rit_nummer,
                    rit.wedstrijden.is_eendagskoers
                );

                if (!resultaat?.uitslag?.length) {
                    console.log(`📭 Geen uitslag gevonden voor rit ${rit.rit_nummer}.`);
                    continue;
                }

                await verwerkRitResultaat(rit.id, resultaat);

                console.log(`✅ Rit ${rit.rit_nummer} succesvol gesynchroniseerd.`);
            } catch (ritError) {
                console.error(`❌ Fout bij sync van rit ${rit.id}:`, ritError.message);
            }
        }

        await checkAndScheduleNextYear();
    } catch (err) {
        console.error('❌ Fout tijdens auto-sync:', err);
    }
});

async function checkAndScheduleNextYear() {
    const { data: wedstrijden, error } = await supabase
        .from('wedstrijden')
        .select('*');

    if (error) {
        console.error('❌ Fout bij ophalen wedstrijden:', error.message);
        return;
    }

    for (const wedstrijd of wedstrijden || []) {
        const { count, error: countError } = await supabase
            .from('ritten')
            .select('*', { count: 'exact', head: true })
            .eq('wedstrijd_id', wedstrijd.id)
            .eq('gescrapet', false);

        if (countError) {
            console.error(`❌ Fout bij tellen ritten voor ${wedstrijd.naam}:`, countError.message);
            continue;
        }

        if (count === 0) {
            const volgendJaar = Number(wedstrijd.jaar) + 1;

            if (!wedstrijd.pcs_url) continue;

            const nieuweUrl = wedstrijd.pcs_url.replace(
                wedstrijd.jaar.toString(),
                volgendJaar.toString()
            );

            const { data: bestaatAl } = await supabase
                .from('wedstrijden')
                .select('id')
                .eq('pcs_url', nieuweUrl)
                .maybeSingle();

            if (!bestaatAl) {
                console.log(`📅 Nieuwe race mogelijk voor volgend jaar: ${nieuweUrl}`);
            }
        }
    }
}

module.exports = {
    checkAndScheduleNextYear,
};