const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');
const axios = require('axios'); // Voeg deze regel toe
const cheerio = require('cheerio'); // Deze hebben we ook nodig voor de wedstrijdstructuur

async function getBrowser() {
    return await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
}

function parsePcsDateToIso(dateText, fallbackYear) {
    if (!dateText) return null;

    const maanden = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        oct: 10,
        nov: 11,
        dec: 12,
    };

    const clean = dateText
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const match = clean.match(/(\d{1,2})\s+([a-z]{3})(?:\s+(\d{4}))?/);

    if (!match) return null;

    const dag = Number(match[1]);
    const maand = maanden[match[2]];
    const jaar = match[3] ? Number(match[3]) : Number(fallbackYear);

    if (!dag || !maand || !jaar) return null;

    return `${jaar}-${String(maand).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
}

function parseTime(timeText) {
    if (!timeText) return null;

    const match = timeText.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;

    return `${String(match[1]).padStart(2, '0')}:${match[2]}:00+02:00`;
}

function combineDateAndTime(dateIso, timeText) {
    if (!dateIso) return null;

    const timeIso = parseTime(timeText) || "12:00:00+02:00";
    return `${dateIso}T${timeIso}`;
}

function parsePcsDateRange(text, fallbackYear) {
    if (!text) {
        return {
            start_datum: null,
            eind_datum: null,
        };
    }

    const clean = text.replace(/\s+/g, ' ').trim();
    const parts = clean.split(/\s*-\s*/);

    if (parts.length === 1) {
        const datum = parsePcsDateToIso(parts[0], fallbackYear);
        return {
            start_datum: datum,
            eind_datum: datum,
        };
    }

    const startRaw = parts[0];
    const endRaw = parts[1];

    const eind_datum = parsePcsDateToIso(endRaw, fallbackYear);

    let start_datum = parsePcsDateToIso(startRaw, fallbackYear);

    if (!start_datum && endRaw) {
        const endMatch = endRaw.toLowerCase().match(/([a-z]{3})\s+(\d{4})/);

        if (endMatch) {
            start_datum = parsePcsDateToIso(
                `${startRaw} ${endMatch[1]} ${endMatch[2]}`,
                fallbackYear
            );
        }
    }

    return {
        start_datum,
        eind_datum,
    };
}

function haalJaarUitUrlOfTekst(url, tekst) {
    const match =
        url.match(/\/(20\d{2})(?:\/|$)/) ||
        tekst.match(/\b(20\d{2})\b/);

    return match ? Number(match[1]) : new Date().getFullYear();
}

function bouwStageUrl(baseUrl, ritNummer) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBase}/stage-${ritNummer}`;
}

// wedstrijd scrapen in admin pagina

// ... (behoud je bestaande imports en helper functies bovenin)

async function scrapeWedstrijdStructuur(url) {
    console.log(`🔎 Wedstrijdstructuur ophalen: ${url}`);
    const browser = await getBrowser();

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Zoek in scraper.js naar de functie scrapeWedstrijdStructuur en pas dit stukje aan:

        const structuur = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText || "";
            const jaarMatch = h1.match(/\d{4}/);
            const jaar = jaarMatch ? parseInt(jaarMatch[0]) : new Date().getFullYear();
            const naam = h1.replace(/\d{4}/, '').trim();

            // Haal globale datums uit de info-sectie
            const infoItems = Array.from(document.querySelectorAll('ul.keyvalueList li'));
            let startDate = null;
            let endDate = null;

            infoItems.forEach(li => {
                const title = li.querySelector('.title')?.innerText.trim();
                const value = li.querySelector('.value')?.innerText.trim();

                // PCS gebruikt vaak "Startdate" en "Enddate"
                if (title?.toLowerCase().includes('startdate')) startDate = value;
                if (title?.toLowerCase().includes('enddate')) endDate = value;
            });

            // Als endDate ontbreekt (eendagskoers), is het gelijk aan startDate
            if (startDate && !endDate) endDate = startDate;

            const stageLinks = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            const rittenMap = new Map();

            stageLinks.forEach((link) => {
                const href = link.getAttribute('href') || "";
                const nrMatch = href.match(/stage-(\d+)/);
                if (!nrMatch) return;

                const rit_nummer = Number(nrMatch[1]);
                if (!rittenMap.has(rit_nummer)) {
                    // Zoek de datum in de tabelcel (meestal de kolom vóór de link of met class .date)
                    const row = link.closest('tr');
                    const dateCell = row?.querySelector('.date, td:first-child');
                    const rawDate = dateCell?.innerText?.trim();

                    rittenMap.set(rit_nummer, {
                        rit_nummer,
                        naam: link.innerText.trim() || `Etappe ${rit_nummer}`,
                        datum: rawDate || null
                    });
                }
            });

            const ritten = Array.from(rittenMap.values()).sort((a, b) => a.rit_nummer - b.rit_nummer);

            return {
                naam,
                jaar,
                ritten,
                startDate,
                endDate,
                is_eendagskoers: ritten.length === 0
            };
        });

        // FIX: Voor eendagskoersen moet er ALTIJD 1 rit zijn
        if (structuur.is_eendagskoers || structuur.ritten.length === 0) {
            structuur.ritten = [{
                rit_nummer: 1,
                naam: structuur.naam,
                datum: structuur.startDate // Gebruik de gevonden startdatum
            }];
            structuur.is_eendagskoers = true;
        }

        await page.close();
        return structuur;
    } catch (err) {
        console.error("Browser Scrape Fout:", err);
        throw err;
    }
}

const createSlug = (text) => {
    return text
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Verwijder accenten (bijv. á -> a)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
};
// importeren startlijst admin pagina wedstrijden
async function importStartlist(pcsUrl, wedstrijdId) {
    let cleanUrl = pcsUrl.replace(/([^:]\/)\/+/g, "$1");
    console.log(`\n--- 🏁 START STARTLIJST IMPORT ---`);
    console.log(`🔗 Bron: ${cleanUrl}`);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(cleanUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        const scrapeData = await page.evaluate(() => {
            // --- 1. Tijd Scrapen ---
            const bodyText = document.body.innerText;
            const timeMatch = bodyText.match(/(?:Start\s*time|Starttime):\s*([0-9]{1,2}:[0-9]{2})/i);
            const gevondenTijd = timeMatch ? timeMatch[1] : "11:00";

            // --- 2. Renners Scrapen ---
            const list = [];
            const mainContent = document.querySelector('.page-content, .main, #main') || document.body;
            const allRiderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));
            let footerSkipped = 0;
            let contextSkipped = 0;

            allRiderLinks.forEach((a) => {
                const isFooter = a.closest('footer, .footer, .site-footer, .rn-footer');
                if (isFooter) { footerSkipped++; return; }

                const hasContext = a.closest('li, tr, .rider-line, .startlist-v4');
                if (!hasContext) { contextSkipped++; return; }

                const naam = a.innerText.trim();
                const href = a.getAttribute('href');
                if (naam && naam.length > 3 && href) {
                    const slug = href.replace('rider/', '').split('/')[0].trim();
                    list.push({ naam, slug });
                }
            });

            const uniqueList = Array.from(new Map(list.map((r) => [r.slug, r])).values());

            return {
                totaalLinksGevonden: allRiderLinks.length,
                footerGenegeerd: footerSkipped,
                geenContextGenegeerd: contextSkipped,
                finaleLijst: uniqueList,
                gevondenTijd: gevondenTijd // NU CORRECT TERUGGEGEVEN
            };
        });

        // Logs en Database Upsert (Blijft hetzelfde als jouw code)
        console.log(`📊 Analyse: Links: ${scrapeData.totaalLinksGevonden}, Footer Skip: ${scrapeData.footerGenegeerd}, Renners: ${scrapeData.finaleLijst.length}`);

        if (scrapeData.finaleLijst.length > 0) {
            const { error: upsertError } = await supabase
                .from('renners')
                .upsert(scrapeData.finaleLijst, { onConflict: 'slug', ignoreDuplicates: false });
            if (upsertError) throw upsertError;
        }

        await page.close();

        // RETURN MET DE TIJD
        return {
            success: true,
            count: scrapeData.finaleLijst.length,
            gevondenTijd: scrapeData.gevondenTijd,
            deelnemers: scrapeData.finaleLijst
        };

    } catch (err) {
        console.error("❌ Fout bij startlijst import:", err);
        throw err;
    }
}
/*
 * 1. HAAL RITTEN + DATUMS OP
 */
/*
 * 1. HAAL RITTEN + DATUMS OP (Nieuwe versie met Admin logica)
 */
async function scrapeStagesForRace(racePcsUrl, wedstrijdId) {
    console.log(`🔎 Ritten ophalen voor (Nieuwe methode): ${racePcsUrl}`);

    try {
        // 1. Gebruik jouw JOUW perfecte admin functie!
        const structuur = await scrapeWedstrijdStructuur(racePcsUrl);

        // Update de datums van deze wedstrijd in Supabase
        if (structuur.startDate) {
            await supabase
                .from('wedstrijden')
                .update({
                    start_datum: structuur.startDate,
                    eind_datum: structuur.endDate || structuur.startDate
                })
                .eq('id', wedstrijdId);
        }

        // 2. Haal de starttijd op (net als in admin.js)
        let tijdUrl = structuur.is_eendagskoers
            ? (racePcsUrl.endsWith('/') ? `${racePcsUrl}result` : `${racePcsUrl}/result`)
            : (racePcsUrl.endsWith('/') ? `${racePcsUrl}stage-1` : `${racePcsUrl}/stage-1`);

        let gevondenTijd = "11:00";
        try {
            // Roep importStartlist aan (die zit ook in dit bestand)
            const startResult = await importStartlist(tijdUrl, wedstrijdId);
            if (startResult && startResult.gevondenTijd) {
                gevondenTijd = startResult.gevondenTijd;
            }
        } catch (e) {
            console.log(`⚠️ Starttijd opzoeken mislukt voor volgend jaar, fallback naar 11:00.`);
        }

        // 3. Jouw Ritten-Mapping en Fallback Logica!
        const rittenToInsert = structuur.ritten.map((r) => {
            let ritDatum = structuur.startDate;

            if (r.datum && r.datum.includes('/')) {
                const [dag, maand] = r.datum.split('/');
                ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
            }

            return {
                wedstrijd_id: wedstrijdId,
                rit_nummer: r.rit_nummer,
                naam: r.naam,
                starttijd: `${ritDatum} ${gevondenTijd}:00`, // De veilige timestamp!
                gescrapet: false
            };
        });

        if (structuur.is_eendagskoers && rittenToInsert.length === 0) {
            rittenToInsert.push({
                wedstrijd_id: wedstrijdId,
                rit_nummer: 1,
                naam: structuur.naam,
                starttijd: `${structuur.startDate} ${gevondenTijd}:00`,
                gescrapet: false
            });
        }

        // 4. Ritten opslaan in de database
        if (rittenToInsert.length > 0) {
            console.log(`📊 Scraper vond ${rittenToInsert.length} ritten (MET geldige tijden!).`);

            const { error: upsertError } = await supabase
                .from('ritten')
                .upsert(rittenToInsert, {
                    onConflict: 'wedstrijd_id,rit_nummer',
                });

            if (upsertError) throw upsertError;
        }

        return {
            success: true,
            count: rittenToInsert.length,
            start_datum: structuur.startDate,
            eind_datum: structuur.endDate,
        };

    } catch (err) {
        console.error("❌ Fout in scrapeStagesForRace:", err);
        throw err;
    }
}

//2. VOLLEDIGE RACE INITIALISATIE(Nu een exacte kopie van je admin logica)

async function scrapeFullRaceInfo(racePcsUrl) {
    console.log(`🚀 Volledige scrape gestart via rollover: ${racePcsUrl}`);

    // 1. Haal de structuur op met de functie die al perfect werkt in de admin
    const structuur = await scrapeWedstrijdStructuur(racePcsUrl);

    // 2. Bepaal de URL voor de starttijd (exact zoals in admin.js)
    let tijdUrl = structuur.is_eendagskoers
        ? (racePcsUrl.endsWith('/') ? `${racePcsUrl}result` : `${racePcsUrl}/result`)
        : (racePcsUrl.endsWith('/') ? `${racePcsUrl}stage-1` : `${racePcsUrl}/stage-1`);

    // 3. Haal de starttijd EN de deelnemers in één klap op
    const startResult = await importStartlist(tijdUrl, null);
    const gevondenTijd = startResult.gevondenTijd || "11:00";

    // 4. Bouw de ritten op (exact zoals in admin.js)
    const ritten = structuur.ritten.map(r => {
        let ritDatum = structuur.startDate;
        if (r.datum && r.datum.includes('/')) {
            const [dag, maand] = r.datum.split('/');
            ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
        }
        return {
            rit_nummer: r.rit_nummer,
            naam: r.naam,
            starttijd: `${ritDatum} ${gevondenTijd}:00`
        };
    });

    return {
        naam: structuur.naam,
        jaar: structuur.jaar,
        aantal_ritten: structuur.is_eendagskoers ? 1 : structuur.ritten.length,
        start_datum: structuur.startDate,
        eind_datum: structuur.endDate,
        ritten: ritten,
        deelnemers: startResult.deelnemers || []
    };
}

/**
 * 3. RIT DETAILS
 */
async function scrapeRitDetails(racePcsUrl, ritNummer, isEendagskoers = false) {
    console.log(`🔎 SCRAPER GESTART voor Rit ${ritNummer} (${isEendagskoers ? 'Eendagskoers' : 'Etappe'})`);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();

        // Dynamische URL opbouw op basis van het type wedstrijd
        let stageUrl;
        const cleanBase = racePcsUrl.endsWith('/') ? racePcsUrl.slice(0, -1) : racePcsUrl;

        if (isEendagskoers) {
            // Voor eendagskoersen (zoals Amstel Gold Race) eindigt de URL op /result
            stageUrl = `${cleanBase}/result`;
        } else {
            // Voor etappekoersen (zoals Paris-Nice) gebruiken we de stage URL + 's'
            // De helper bouwStageUrl maakt meestal .../stage-1, PCS uitslagen staan op .../stage-1/results
            const baseUrl = bouwStageUrl(racePcsUrl, ritNummer);
            stageUrl = baseUrl.endsWith('/') ? `${baseUrl}results` : `${baseUrl}/results`;
        }

        console.log(`🔗 Scrapen van uitslag via: ${stageUrl}`);

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await page.goto(stageUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        const data = await page.evaluate(() => {
            const results = {
                uitslag: [],
                truien: {},
                starttijdTekst: null,
            };

            const bodyText = document.body.innerText;

            // Zoek naar datum en starttijd op de pagina
            const dateMatch = bodyText.match(/Date:\s*([^\n]+)/i);
            const timeMatch =
                bodyText.match(/Starttime:\s*([0-9]{1,2}:[0-9]{2})/i) ||
                bodyText.match(/Start time:\s*([0-9]{1,2}:[0-9]{2})/i);

            results.starttijdTekst = dateMatch?.[1]
                ? `${dateMatch[1]} ${timeMatch?.[1] || ""}`.trim()
                : null;

            const tables = Array.from(document.querySelectorAll('table'));

            // Zoek de juiste tabel (bevat 'Rider' en heeft genoeg rijen)
            const resultTable = tables.find(
                (t) => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10
            );

            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);

                results.uitslag = rows
                    .map((row, i) => {
                        const a = row.querySelector('a[href^="rider/"]');
                        // Pak de slug direct uit de href om mismatches te voorkomen
                        const href = a?.getAttribute('href') || "";
                        const slug = href.replace('rider/', '').split('/')[0];

                        return {
                            positie: i + 1,
                            naam: a?.innerText.trim(),
                            slug: slug || null,
                        };
                    })
                    .filter((r) => r.slug);
            }

            // Helper om de leider van een klassement te vinden
            const getLeaderSlug = (headerText) => {
                const targetTable = tables.find(
                    (t) =>
                        t.previousElementSibling?.innerText.includes(headerText) ||
                        t.innerText.includes(headerText)
                );

                const a = targetTable?.querySelector('a[href^="rider/"]');
                return a?.getAttribute('href')?.replace('rider/', '').split('/')[0] || null;
            };

            results.truien = {
                algemeen: getLeaderSlug('GC'),
                punten: getLeaderSlug('Points'),
                berg: getLeaderSlug('KOM'),
                jongeren: getLeaderSlug('Youth'),
            };

            return results;
        });

        return data;
    } finally {
        await browser.close();
    }
}

module.exports = {
    scrapeStagesForRace,
    scrapeFullRaceInfo,
    scrapeRitDetails,
    scrapeWedstrijdStructuur,
    importStartlist
};