const cron = require('node-cron');
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');
const { verwerkRitResultaat } = require('../routes/ritten');
const { verwerkRaceLifecycle } = require('./raceLifecycleService');

/**
 * 1. DE UITSLAG SCRAPER (Slimme "Retry & Verify" Motor)
 */
async function runAutoSync() {
    console.log(`\n🤖 [${new Date().toLocaleTimeString()}] Automatische controle gestart...`);

    try {
        const nu = new Date();

        // 1. Haal ritten op die: Niet gescrapet zijn, een datum hebben, en al gestart zijn.
        const { data: ritten, error } = await supabase
            .from('ritten')
            .select('*, wedstrijden(id, pcs_url, jaar, naam, is_eendagskoers, aantal_ritten)')
            .eq('gescrapet', false)
            .not('starttijd', 'is', null) // FIX: Negeer ritten waar starttijd nog ontbreekt (bijv Tour 2026)
            .lte('starttijd', nu.toISOString()) // FIX: Check strikt in het verleden
            .order('starttijd', { ascending: true });

        if (error) throw error;

        if (!ritten || ritten.length === 0) {
            console.log('😴 Geen actieve ritten gevonden die verwerkt moeten worden.');
            return;
        }

        let checkLifecycle = false; // We houden bij of er iéts is opgeslagen

        for (const rit of ritten) {
            console.log(`🧐 Controleren: ${rit.wedstrijden.naam} - Rit ${rit.rit_nummer}`);

            // 1. BEPAAL DE JUISTE URL & TYPE KOERS
            const targetUrl = rit.pcs_url || rit.wedstrijden?.pcs_url;

            // FIX: Als de rit een eigen URL heeft, is het een losse klassieker. 
            // Forceer dan 'true' zodat de scraper netjes '/result' gebruikt!
            const isEendag = rit.pcs_url ? true : rit.wedstrijden.is_eendagskoers;

            // 2. CHECK OF URL BESTAAT
            if (!targetUrl) {
                console.log(`⚠️ Geen PCS URL gevonden. Scrapen overgeslagen.`);
                continue;
            }

            // 3. START DE SCRAPER
            try {
                const resultaat = await scraper.scrapeRitDetails(
                    targetUrl,
                    rit.rit_nummer,
                    isEendag // <--- Gebruik de slimme variabele
                );
                if (resultaat?.uitslag?.length > 0) {
                    console.log(`✅ Uitslag gevonden! Verwerken...`);
                    // We geven de naam mee voor de slimme Grote Ronde truien-check
                    await verwerkRitResultaat(rit.id, resultaat, rit.wedstrijden.naam);

                    // We hebben een uitslag opgeslagen, we moeten na de loop de lifecycle checken!
                    checkLifecycle = true;
                } else {
                    console.log(`⏳ Nog geen uitslag voor ${rit.wedstrijden.naam}.`);
                }
            } catch (scrapeErr) {
                console.error(`❌ Fout tijdens scrapen van Rit ${rit.rit_nummer}:`, scrapeErr.message);
            }
        }

        // 2. CHECK ROLLOVER: Als er ritten zijn opgeslagen, checken we of dit toevallig de laatste rit was.
        if (checkLifecycle) {
            console.log(`\n🔄 Er zijn nieuwe uitslagen verwerkt. Controleren of een wedstrijd compleet is voor rollover...`);
            await runLifecycleCheck();
        }

    } catch (err) {
        console.error('🚨 Fout tijdens Automation Service:', err.message);
    }
}

/**
 * 2. DE LIFECYCLE CHECK (Rollover naar volgend jaar)
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
cron.schedule('0 */30 * * * *', () => {
    runAutoSync();
});

// B. Check Uitslagen: Extra check om 10:00 (Voor nachtkoersen of missende truien)
cron.schedule('0 */4 * * *', () => {
    runAutoSync();
});

// 3. DE OPSTART-CATCH-UP (De magische truc voor lokale projecten)
// Deze functie wordt aangeroepen zodra jij je backend opstart.
function startLokaleMotor() {
    console.log('\n⚙️ Lokale Automation wordt warmgedraaid...');

    // Wacht 5 seconden na het opstarten van de server, en doe dan direct een check.
    // Zo haalt hij direct alles in wat hij vannacht of gisteren gemist heeft!
    setTimeout(() => {
        console.log('⏰ Opstart-check: Kijken of we werk gemist hebben toen de PC uit stond...');
        runAutoSync();
        runLifecycleCheck();
    }, 5000);
}

module.exports = { runAutoSync, runLifecycleCheck, startLokaleMotor };