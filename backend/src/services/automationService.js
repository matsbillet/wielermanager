const cron = require('node-cron');
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');
const { verwerkRitResultaat } = require('../routes/ritten');
const { verwerkRaceLifecycle } = require('./raceLifecycleService'); // Lifecycle toegevoegd!

/**
 * 1. DE UITSLAG SCRAPER (Meerdere keren per dag tijdens koers-uren)
 */
async function runAutoSync() {
    console.log(`\n🤖 [${new Date().toLocaleTimeString()}] Automatische controle gestart...`);

    try {
        const nu = new Date();

        const { data: ritten, error } = await supabase
            .from('ritten')
            .select('*, wedstrijden(id, pcs_url, jaar, naam, is_eendagskoers)')
            .eq('gescrapet', false)
            .lte('starttijd', nu.toISOString())
            .order('starttijd', { ascending: true });

        if (error) throw error;

        if (!ritten || ritten.length === 0) {
            console.log('😴 Geen actieve ritten gevonden die verwerkt moeten worden.');
            return;
        }

        for (const rit of ritten) {
            console.log(`🧐 Controleren: ${rit.wedstrijden.naam} - Rit ${rit.rit_nummer}`);

            const resultaat = await scraper.scrapeRitDetails(
                rit.wedstrijden.pcs_url,
                rit.rit_nummer,
                rit.wedstrijden.is_eendagskoers
            );

            if (resultaat?.uitslag?.length > 0) {
                console.log(`✅ Uitslag gevonden! Verwerken...`);
                await verwerkRitResultaat(rit.id, resultaat);
            } else {
                console.log(`⏳ Nog geen uitslag voor ${rit.wedstrijden.naam}.`);
            }
        }
    } catch (err) {
        console.error('🚨 Fout tijdens Automation Service:', err.message);
    }
}

/**
 * 2. DE LIFECYCLE CHECK (Rollover naar volgend jaar / Nieuwe Drafts)
 */
async function runLifecycleCheck() {
    console.log(`\n♻️ [${new Date().toLocaleTimeString()}] Automatische race lifecycle check gestart...`);
    try {
        const resultaat = await verwerkRaceLifecycle();
        console.log('Race lifecycle resultaat:', resultaat);
    } catch (error) {
        console.error('Race lifecycle fout:', error.message);
    }
}


// ============================================================================
// 🕒 DE CRON PLANNING (De "Wekkers" van je server)
// ============================================================================

// A. Check Uitslagen: Elke 30 minuten tussen 15:00 en 22:00
cron.schedule('0 */30 15-22 * * *', () => {
    runAutoSync();
});

// B. Check Uitslagen: Extra check om 10:00 (Voor nachtkoersen)
cron.schedule('0 10 * * *', () => {
    runAutoSync();
});

// C. Check Lifecycle (Oude timer uit app.js): Elke 6 uur (00:00, 06:00, 12:00, 18:00)
cron.schedule('0 */6 * * *', () => {
    runLifecycleCheck();
});

runAutoSync();

module.exports = { runAutoSync, runLifecycleCheck };