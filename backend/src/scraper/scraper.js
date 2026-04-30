const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

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

/**
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
async function scrapeRitDetails(racePcsUrl, ritNummer) {
    console.log(`🔎 SCRAPER GESTART voor Rit ${ritNummer}`);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();
        const stageUrl = bouwStageUrl(racePcsUrl, ritNummer);

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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

            const dateMatch = bodyText.match(/Date:\s*([^\n]+)/i);
            const timeMatch =
                bodyText.match(/Starttime:\s*([0-9]{1,2}:[0-9]{2})/i) ||
                bodyText.match(/Start time:\s*([0-9]{1,2}:[0-9]{2})/i);

            results.starttijdTekst = dateMatch?.[1]
                ? `${dateMatch[1]} ${timeMatch?.[1] || ""}`.trim()
                : null;

            const tables = Array.from(document.querySelectorAll('table'));
            const resultTable = tables.find(
                (t) => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10
            );

            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);

                results.uitslag = rows
                    .map((row, i) => {
                        const a = row.querySelector('a[href^="rider/"]');

                        return {
                            positie: i + 1,
                            naam: a?.innerText.trim(),
                            slug: a?.getAttribute('href')?.replace('rider/', ''),
                        };
                    })
                    .filter((r) => r.slug);
            }

            const getLeaderSlug = (headerText) => {
                const targetTable = tables.find(
                    (t) =>
                        t.previousElementSibling?.innerText.includes(headerText) ||
                        t.innerText.includes(headerText)
                );

                return (
                    targetTable
                        ?.querySelector('a[href^="rider/"]')
                        ?.getAttribute('href')
                        .replace('rider/', '') || null
                );
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
};