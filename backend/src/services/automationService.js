const cron = require('node-cron');
const { supabase } = require('../db/supabase');
const scraper = require('../scraper/scraper');
const { verwerkRitResultaat } = require('../routes/ritten');
const { verwerkRaceLifecycle, syncStartlijstEnRitten } = require('./raceLifecycleService'); // sync toegevoegd voor de scout
const { scrapeEindklassement } = require('../scraper/scraper');
// ============================================================================
// 🛠️ HULPFUNCTIES
// ============================================================================

/**
 * FASE 1: KALENDER ROLLOVER (De Lege Huls Aanmaken)
 * Wordt aangeroepen zodra de allerlaatste rit van een koers is gescrapet.
 */
async function maakVolgendJaarAan(huidigeWedstrijd) {
    try {
        const volgendJaar = huidigeWedstrijd.jaar + 1;
        const nieuweNaam = huidigeWedstrijd.naam.replace(huidigeWedstrijd.jaar.toString(), volgendJaar.toString());
        const nieuweSlug = huidigeWedstrijd.slug.replace(huidigeWedstrijd.jaar.toString(), volgendJaar.toString());

        // Zorg dat de URL netjes doorschuift (bijv. /2025 -> /2026)
        let nieuweUrl = huidigeWedstrijd.pcs_url;
        if (nieuweUrl.includes(huidigeWedstrijd.jaar.toString())) {
            nieuweUrl = nieuweUrl.replace(huidigeWedstrijd.jaar.toString(), volgendJaar.toString());
        } else {
            nieuweUrl = nieuweUrl.endsWith('/') ? `${nieuweUrl}${volgendJaar}` : `${nieuweUrl}/${volgendJaar}`;
        }

        // Check of hij al bestaat
        const { data: bestaande } = await supabase
            .from('wedstrijden')
            .select('id')
            .eq('slug', nieuweSlug)
            .maybeSingle();

        if (!bestaande) {
            const { error } = await supabase.from('wedstrijden').insert({
                naam: nieuweNaam,
                slug: nieuweSlug,
                jaar: volgendJaar,
                pcs_url: nieuweUrl,
                aantal_ritten: 0, // De Scout vult dit later aan!
                is_eendagskoers: huidigeWedstrijd.is_eendagskoers,
                status: 'wacht_op_parcours' // <-- Belangrijk voor de Scout!
            });

            if (error) throw error;
            console.log(`✨ FASE 1: Lege huls voor '${nieuweNaam}' succesvol klaargezet in de database!`);
        } else {
            console.log(`ℹ️ '${nieuweNaam}' bestond al in de database.`);
        }
    } catch (err) {
        console.error(`❌ Fout bij aanmaken volgend jaar voor ${huidigeWedstrijd.naam}:`, err.message);
    }
}

// ============================================================================
// 1. DE HOOFDMOTOR (Uitslagen Scrapen)
// ============================================================================

async function runAutoSync() {
    console.log(`\n🤖 [${new Date().toLocaleTimeString()}] Automatische controle gestart...`);

    try {
        const nu = new Date();

        const { data: ritten, error } = await supabase
            .from('ritten')
            .select('*, wedstrijden(id, pcs_url, jaar, naam, slug, is_eendagskoers, aantal_ritten)')
            .eq('gescrapet', false)
            .not('starttijd', 'is', null)
            .lte('starttijd', nu.toISOString())
            .order('starttijd', { ascending: true });

        if (error) throw error;

        if (!ritten || ritten.length === 0) {
            console.log('😴 Geen actieve ritten gevonden die verwerkt moeten worden.');
            return;
        }

        let checkDraftLifecycle = false;

        for (const rit of ritten) {
            console.log(`🧐 Controleren: ${rit.wedstrijden.naam} - Rit ${rit.rit_nummer}`);

            const targetUrl = rit.pcs_url || rit.wedstrijden?.pcs_url;
            const isEendag = rit.pcs_url ? true : rit.wedstrijden.is_eendagskoers;

            if (!targetUrl) {
                console.log(`⚠️ Geen PCS URL gevonden. Scrapen overgeslagen.`);
                continue;
            }

            try {
                const resultaat = await scraper.scrapeRitDetails(targetUrl, rit.rit_nummer, isEendag);

                if (resultaat?.uitslag?.length > 0) {
                    console.log(`✅ Uitslag gevonden! Verwerken...`);
                    await verwerkRitResultaat(rit.id, resultaat, rit.wedstrijden.naam);

                    checkDraftLifecycle = true;

                    // --- NIEUW: KALENDER ROLLOVER CHECK ---
                    // Is dit de allerlaatste rit van de wedstrijd?
                    if (rit.rit_nummer === rit.wedstrijden.aantal_ritten) {
                        console.log(`\n🏁 LAATSTE RIT van ${rit.wedstrijden.naam} is gereden!`);

                        // 1. Zet huidige wedstrijd op finished
                        await supabase.from('wedstrijden').update({ status: 'finished' }).eq('id', rit.wedstrijden.id);
                        // 2. Scrape meteen het eindklassement (voor zover mogelijk)
                        console.log(`🏆 Eindklassement automatisch ophalen voor ${rit.wedstrijden.naam}...`);
                        try {
                            const resultaat = await scrapeEindklassement(rit.wedstrijden.pcs_url, rit.wedstrijden.id);
                            console.log(`✅ Eindklassement opgeslagen: ${resultaat.count} rijen`);
                        } catch (eindErr) {
                            console.error(`❌ Fout bij automatisch scrapen eindklassement:`, eindErr.message);
                        }
                        // 3. Maak volgend jaar alvast aan als lege huls
                        await maakVolgendJaarAan(rit.wedstrijden);
                    }

                } else {
                    console.log(`⏳ Nog geen uitslag voor ${rit.wedstrijden.naam}.`);
                }
            } catch (scrapeErr) {
                console.error(`❌ Fout tijdens scrapen van Rit ${rit.rit_nummer}:`, scrapeErr.message);
            }
        }

        // Als er spelers moeten doorschuiven naar de volgende actieve koers in hun app:
        if (checkDraftLifecycle) {
            console.log(`\n🔄 Uitslagen verwerkt. Controleren of actieve drafts moeten doorschuiven...`);
            await runLifecycleCheck();
        }

    } catch (err) {
        console.error('🚨 Fout tijdens Automation Service:', err.message);
    }
}

// ============================================================================
// 2. DE GAME LIFECYCLE (Drafts Doorschuiven)
// ============================================================================
async function runLifecycleCheck() {
    try {
        const resultaat = await verwerkRaceLifecycle();
        // Alleen printen als hij écht iets heeft gedaan, anders spammen we de console niet vol
        if (resultaat.resultaten.some(r => r.actie !== 'geen_actie')) {
            console.log('♻️ Draft lifecycle geüpdatet:', resultaat);
        }
    } catch (error) {
        console.error('Race lifecycle fout:', error.message);
    }
}

// ============================================================================
// 3. DE NACHTPLOEG SCOUT (Parcours & Startlijsten inladen)
// ============================================================================
async function runScoutFutureRaces() {
    console.log('\n🕵️ De Scout controleert toekomstige wedstrijden...');

    try {
        const nu = new Date();
        const eenWeekVantevoren = new Date(nu.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: wedstrijden, error } = await supabase
            .from('wedstrijden')
            .select('*')
            .in('status', ['wacht_op_parcours', 'wacht_op_startlijst']);

        if (error) throw error;
        if (!wedstrijden || wedstrijden.length === 0) {
            console.log('✅ Geen wedstrijden die wachten op parcours of startlijst.');
            return;
        }

        for (const w of wedstrijden) {
            // FASE 2: Wacht op parcours (0 ritten bekend)
            if (w.status === 'wacht_op_parcours' || w.aantal_ritten === 0) {
                console.log(`🔎 Checkt of parcours al bekend is voor: ${w.naam}...`);
                try {
                    const structuur = await scraper.scrapeWedstrijdStructuur(w.pcs_url);
                    if (structuur && structuur.ritten?.length > 0) {
                        await syncStartlijstEnRitten(w);
                        await supabase.from('wedstrijden').update({ status: 'wacht_op_startlijst' }).eq('id', w.id);
                        console.log(`✨ FASE 2: Parcours gevonden en ingeladen voor ${w.naam}!`);
                    } else {
                        console.log(`   ⏳ Nog geen parcours gevonden.`);
                    }
                } catch (e) {
                    console.log(`   ⏳ Pagina bestaat nog niet op PCS (404).`);
                }
                continue;
            }

            // FASE 3: Korter dan 7 dagen tot start? Haal startlijst op!
            if (w.status === 'wacht_op_startlijst' && w.start_datum) {
                const startDatum = new Date(w.start_datum);
                if (startDatum <= eenWeekVantevoren && startDatum > nu) {
                    console.log(`👥 FASE 3: Startlijst-check voor ${w.naam} (Start binnen 7 dagen)`);

                    try {
                        const startResult = await scraper.importStartlist(w.pcs_url.endsWith('/') ? `${w.pcs_url}startlist` : `${w.pcs_url}/startlist`, w.id);
                        if (startResult && startResult.deelnemers?.length > 50) { // Check of het een fatsoenlijke lijst is
                            await supabase.from('wedstrijden').update({ status: 'upcoming' }).eq('id', w.id);
                            console.log(`✨ FASE 3: Startlijst binnen! Drafts kunnen open voor ${w.naam}.`);
                        } else {
                            console.log(`   ⏳ Nog geen (volledige) startlijst gevonden.`);
                        }
                    } catch (e) {
                        console.log(`   ⏳ Startlijst pagina nog niet beschikbaar.`);
                    }
                }
            }
        }
    } catch (err) {
        console.error('🚨 Scout fout:', err.message);
    }
}

// ============================================================================
// 🕒 LOKALE WEKKERS (Schoolproject modus)
// ============================================================================

// A. Check Uitslagen: Elke 30 minuten
cron.schedule('*/30 * * * *', () => {
    runAutoSync();
});

// B. Check Scout (Parcours & Startlijsten): Elke 4 uur
cron.schedule('0 */4 * * *', () => {
    runScoutFutureRaces();
});

// C. Opstart-Catch-up
function startLokaleMotor() {
    console.log('\n⚙️ Lokale Automation wordt warmgedraaid...');
    setTimeout(() => {
        console.log('⏰ Opstart-check: Kijken of we werk gemist hebben toen de PC uit stond...');
        runAutoSync();
        // We draaien de scout ook even bij opstarten!
        runScoutFutureRaces();
    }, 5000);
}

module.exports = { runAutoSync, runLifecycleCheck, startLokaleMotor, runScoutFutureRaces };