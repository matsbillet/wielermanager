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

        const structuur = await page.evaluate(() => {
            const h1 = document.querySelector('h1')?.innerText || "";
            const jaarMatch = h1.match(/\d{4}/);
            const jaar = jaarMatch ? parseInt(jaarMatch[0]) : new Date().getFullYear();
            const naam = h1.replace(/\d{4}/, '').trim();

            // Zoek etappe links
            const stageLinks = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            const rittenMap = new Map();

            stageLinks.forEach((link) => {
                const href = link.getAttribute('href') || "";
                const nrMatch = href.match(/stage-(\d+)/);
                if (!nrMatch) return;

                const rit_nummer = Number(nrMatch[1]);
                if (!rittenMap.has(rit_nummer)) {
                    rittenMap.set(rit_nummer, {
                        rit_nummer,
                        naam: link.innerText.trim() || `Etappe ${rit_nummer}`,
                        datum: link.closest('tr')?.querySelector('.date')?.innerText?.trim() || null
                    });
                }
            });

            const ritten = Array.from(rittenMap.values()).sort((a, b) => a.rit_nummer - b.rit_nummer);

            return {
                naam: naam || document.title.split(' 20')[0],
                jaar: jaar,
                ritten: ritten,
                is_eendagskoers: ritten.length === 0
            };
        });

        // FIX: Voor eendagskoersen moet er ALTIJD 1 rit zijn in de database
        if (structuur.is_eendagskoers || structuur.ritten.length === 0) {
            structuur.ritten = [{
                rit_nummer: 1,
                naam: structuur.naam,
                datum: null
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
    // 1. Zorg voor een schone URL zonder dubbele slashes
    let cleanUrl = pcsUrl.replace(/([^:]\/)\/+/g, "$1");

    console.log(`\n--- 🏁 START STARTLIJST IMPORT ---`);
    console.log(`🔗 Bron: ${cleanUrl}`);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(cleanUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        const scrapeData = await page.evaluate(() => {
            const list = [];

            // In scraper.js binnen importStartlist -> page.evaluate
            const infoData = (() => {
                const bodyText = document.body.innerText;
                // Zoek naar "Start time: 10:30" of "Starttime: 10:30"
                const timeMatch = bodyText.match(/(?:Start\s*time|Starttime):\s*([0-9]{1,2}:[0-9]{2})/i);
                return {
                    starttijd: timeMatch ? timeMatch[1] : null
                };
            })();

            // Zoek de hoofdcontainer om de footer te vermijden
            const mainContent = document.querySelector('.page-content, .main, #main') || document.body;

            // We pakken ALLE rider links op de pagina voor de log statistieken
            const allRiderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));
            let footerSkipped = 0;
            let contextSkipped = 0;

            allRiderLinks.forEach((a) => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');

                // Check 1: Zit het in de footer? (De "Popular Riders" valkuil)
                const isFooter = a.closest('footer, .footer, .site-footer, .rn-footer');
                if (isFooter) {
                    footerSkipped++;
                    return;
                }

                // Check 2: Heeft het de juiste context? (Moet in een lijst of tabel staan)
                const hasContext = a.closest('li, tr, .rider-line, .startlist-v4');
                if (!hasContext) {
                    contextSkipped++;
                    return;
                }

                if (naam && naam.length > 3 && href) {
                    const slug = href.replace('rider/', '').split('/')[0].trim();
                    list.push({ naam, slug });
                }
            });

            // Ontdubbelen op basis van slug
            const uniqueList = Array.from(new Map(list.map((r) => [r.slug, r])).values());

            return {
                totaalLinksGevonden: allRiderLinks.length,
                footerGenegeerd: footerSkipped,
                geenContextGenegeerd: contextSkipped,
                finaleLijst: uniqueList
            };
        });

        // --- Console Logs voor validatie ---
        console.log(`📊 Scraper Analyse voor deze pagina:`);
        console.log(`   - Totaal 'rider/' links op de hele pagina: ${scrapeData.totaalLinksGevonden}`);
        console.log(`   - ❌ Genegeerd wegens footer (o.a. vrouwen): ${scrapeData.footerGenegeerd}`);
        console.log(`   - ❌ Genegeerd wegens gebrek aan context (menu/sidebar): ${scrapeData.geenContextGenegeerd}`);
        console.log(`   - ✅ Geldige renners gevonden voor import: ${scrapeData.finaleLijst.length}`);

        if (scrapeData.finaleLijst.length > 0) {
            console.log(`💾 Bezig met verzenden van ${scrapeData.finaleLijst.length} renners naar database...`);

            const { error: upsertError } = await supabase
                .from('renners')
                .upsert(scrapeData.finaleLijst, {
                    // WE GEBRUIKEN NU SLUG ALS CONFLICT CHECK
                    onConflict: 'slug',
                    ignoreDuplicates: false
                });

            if (upsertError) {
                console.error("❌ Database Upsert Fout:", upsertError.message);
                throw upsertError;
            }
            console.log(`✨ Database succesvol bijgewerkt.`);
        }

        console.log(`--- 🏁 EINDE IMPORT ---\n`);

        await page.close();
        return { success: true, count: scrapeData.finaleLijst.length };

    } catch (err) {
        console.error("❌ Fout bij startlijst import:", err);
        throw err;
    }
}
/*
 * 1. HAAL RITTEN + DATUMS OP
 */
async function scrapeStagesForRace(racePcsUrl, wedstrijdId) {
    console.log(`🔎 Ritten ophalen voor: ${racePcsUrl}`);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await page.goto(racePcsUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        const raceInfo = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            const dateMatch =
                bodyText.match(/Date:\s*([^\n]+)/i) ||
                bodyText.match(/Race date:\s*([^\n]+)/i);

            const stageLinks = Array.from(document.querySelectorAll('a[href*="stage-"]'));

            const rittenMap = new Map();

            stageLinks.forEach((link) => {
                const href = link.getAttribute('href') || "";
                const nrMatch = href.match(/stage-(\d+)/);
                if (!nrMatch) return;

                const rit_nummer = Number(nrMatch[1]);
                const row = link.closest('tr');
                const rowText = row?.innerText || link.parentElement?.innerText || link.innerText || "";

                if (!rittenMap.has(rit_nummer)) {
                    rittenMap.set(rit_nummer, {
                        rit_nummer,
                        naam: link.innerText.trim(),
                        rowText,
                    });
                }
            });

            return {
                datumTekst: dateMatch?.[1]?.trim() || null,
                bodyText,
                ritten: Array.from(rittenMap.values()),
            };
        });

        const { data: wedstrijd, error: wedstrijdError } = await supabase
            .from('wedstrijden')
            .select('jaar')
            .eq('id', wedstrijdId)
            .single();

        if (wedstrijdError) throw wedstrijdError;

        const fallbackYear = wedstrijd?.jaar || haalJaarUitUrlOfTekst(racePcsUrl, raceInfo.bodyText || "");
        const raceDatums = parsePcsDateRange(raceInfo.datumTekst, fallbackYear);

        if (raceDatums.start_datum || raceDatums.eind_datum) {
            await supabase
                .from('wedstrijden')
                .update(raceDatums)
                .eq('id', wedstrijdId);
        }

        const rittenMetDatum = [];

        for (const rit of raceInfo.ritten) {
            let datum = null;
            let starttijd = null;

            const rowDateMatch = rit.rowText.match(/(\d{1,2}\s+[A-Za-z]{3}(?:\s+20\d{2})?)/);
            const rowTimeMatch = rit.rowText.match(/(\d{1,2}:\d{2})/);

            if (rowDateMatch) {
                datum = parsePcsDateToIso(rowDateMatch[1], fallbackYear);
                starttijd = combineDateAndTime(datum, rowTimeMatch?.[1]);
            }

            rittenMetDatum.push({
                wedstrijd_id: wedstrijdId,
                rit_nummer: rit.rit_nummer,
                naam: rit.naam,
                starttijd,
            });
        }

        if (rittenMetDatum.length > 0) {
            console.log(`📊 Scraper vond ${rittenMetDatum.length} ritten.`);

            const { error: upsertError } = await supabase
                .from('ritten')
                .upsert(rittenMetDatum, {
                    onConflict: 'wedstrijd_id,rit_nummer',
                });

            if (upsertError) throw upsertError;
        }

        return {
            success: true,
            count: rittenMetDatum.length,
            start_datum: raceDatums.start_datum,
            eind_datum: raceDatums.eind_datum,
        };
    } finally {
        await browser.close();
    }
}

/**
 * 2. VOLLEDIGE RACE INITIALISATIE
 */
async function scrapeFullRaceInfo(racePcsUrl) {
    console.log(`🚀 Volledige initiële scrape gestart voor: ${racePcsUrl}`);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await page.goto(racePcsUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        const raceDetails = await page.evaluate(() => {
            const naam = document.querySelector('h1')?.innerText.trim() || "";
            const bodyText = document.body.innerText;

            const yearMatch = naam.match(/(20\d{2})/) || bodyText.match(/(20\d{2})/);
            const jaar = yearMatch ? Number(yearMatch[1]) : null;

            const dateMatch =
                bodyText.match(/Date:\s*([^\n]+)/i) ||
                bodyText.match(/Race date:\s*([^\n]+)/i);

            const stageLinks = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            const rittenMap = new Map();

            stageLinks.forEach((link) => {
                const href = link.getAttribute('href') || "";
                const nrMatch = href.match(/stage-(\d+)/);
                if (!nrMatch) return;

                const rit_nummer = Number(nrMatch[1]);
                const row = link.closest('tr');
                const rowText = row?.innerText || link.parentElement?.innerText || link.innerText || "";

                if (!rittenMap.has(rit_nummer)) {
                    rittenMap.set(rit_nummer, {
                        rit_nummer,
                        naam: link.innerText.trim(),
                        rowText,
                    });
                }
            });

            return {
                naam,
                jaar,
                datumTekst: dateMatch?.[1]?.trim() || null,
                ritten: Array.from(rittenMap.values()),
                aantal_ritten: rittenMap.size,
            };
        });

        const fallbackYear = raceDetails.jaar || haalJaarUitUrlOfTekst(racePcsUrl, raceDetails.naam || "");
        const raceDatums = parsePcsDateRange(raceDetails.datumTekst, fallbackYear);

        const ritten = raceDetails.ritten.map((rit) => {
            const rowDateMatch = rit.rowText.match(/(\d{1,2}\s+[A-Za-z]{3}(?:\s+20\d{2})?)/);
            const rowTimeMatch = rit.rowText.match(/(\d{1,2}:\d{2})/);

            const datum = rowDateMatch
                ? parsePcsDateToIso(rowDateMatch[1], fallbackYear)
                : null;

            return {
                rit_nummer: rit.rit_nummer,
                naam: rit.naam,
                starttijd: combineDateAndTime(datum, rowTimeMatch?.[1]),
            };
        });

        const startlistUrl = racePcsUrl.endsWith('/')
            ? `${racePcsUrl}startlist`
            : `${racePcsUrl}/startlist`;

        await page.goto(startlistUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        const deelnemers = await page.evaluate(() => {
            const list = [];
            const riderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));

            riderLinks.forEach((a) => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');

                if (naam && naam.length > 3 && href && a.closest('li, tr, .rider-line')) {
                    list.push({
                        naam,
                        slug: href.replace('rider/', '').trim(),
                    });
                }
            });

            return Array.from(new Map(list.map((r) => [r.slug, r])).values());
        });

        return {
            naam: raceDetails.naam,
            jaar: fallbackYear,
            aantal_ritten: ritten.length,
            start_datum: raceDatums.start_datum,
            eind_datum: raceDatums.eind_datum,
            ritten,
            deelnemers,
        };
    } finally {
        await browser.close();
    }
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