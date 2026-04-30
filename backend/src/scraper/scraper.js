const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

async function getBrowser() {
    return await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
}

function parsePcsDate(dateText, fallbackYear) {
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

    const match = clean.match(/(\d{1,2})\s+([a-z]{3})\s+(\d{4})?/);

    if (!match) return null;

    const dag = Number(match[1]);
    const maand = maanden[match[2]];
    const jaar = match[3] ? Number(match[3]) : Number(fallbackYear);

    if (!dag || !maand || !jaar) return null;

    return `${jaar}-${String(maand).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
}

function parsePcsDateRange(text, fallbackYear) {
    if (!text) {
        return {
            start_datum: null,
            eind_datum: null,
        };
    }

    const clean = text
        .replace(/\s+/g, ' ')
        .trim();

    const parts = clean.split(/\s*-\s*/);

    if (parts.length === 1) {
        const datum = parsePcsDate(parts[0], fallbackYear);
        return {
            start_datum: datum,
            eind_datum: datum,
        };
    }

    const startRaw = parts[0];
    const endRaw = parts[1];

    const endDatum = parsePcsDate(endRaw, fallbackYear);

    let startDatum = parsePcsDate(startRaw, fallbackYear);

    if (!startDatum && endRaw) {
        const endMatch = endRaw.toLowerCase().match(/([a-z]{3})\s+(\d{4})/);
        if (endMatch) {
            startDatum = parsePcsDate(`${startRaw} ${endMatch[1]} ${endMatch[2]}`, fallbackYear);
        }
    }

    return {
        start_datum: startDatum,
        eind_datum: endDatum,
    };
}

/**
 * 1. HAAL RITTEN OP
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
            const tekst = document.body.innerText;

            const dateMatch =
                tekst.match(/Date:\s*([^\n]+)/i) ||
                tekst.match(/Race date:\s*([^\n]+)/i);

            const links = Array.from(document.querySelectorAll('a[href*="stage-"]'));

            const ritten = [];

            links.forEach((link) => {
                const url = link.getAttribute('href');
                const text = link.innerText.trim();
                const nrMatch = url.match(/stage-(\d+)/);

                if (nrMatch) {
                    const nr = parseInt(nrMatch[1]);

                    if (!ritten.find((r) => r.rit_nummer === nr)) {
                        ritten.push({
                            rit_nummer: nr,
                            naam: text,
                        });
                    }
                }
            });

            return {
                datumTekst: dateMatch?.[1]?.trim() || null,
                ritten,
            };
        });

        const { data: wedstrijd, error: wedstrijdError } = await supabase
            .from('wedstrijden')
            .select('jaar')
            .eq('id', wedstrijdId)
            .single();

        if (wedstrijdError) throw wedstrijdError;

        const datums = parsePcsDateRange(raceInfo.datumTekst, wedstrijd.jaar);

        if (datums.start_datum || datums.eind_datum) {
            await supabase
                .from('wedstrijden')
                .update(datums)
                .eq('id', wedstrijdId);
        }

        if (raceInfo.ritten.length > 0) {
            console.log(`📊 Scraper vond ${raceInfo.ritten.length} ritten.`);

            for (const rit of raceInfo.ritten) {
                await supabase
                    .from('ritten')
                    .upsert(
                        {
                            wedstrijd_id: wedstrijdId,
                            rit_nummer: rit.rit_nummer,
                            naam: rit.naam,
                        },
                        {
                            onConflict: 'wedstrijd_id,rit_nummer',
                        }
                    );
            }
        }

        return {
            success: true,
            count: raceInfo.ritten.length,
            ...datums,
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
            const naam = document.querySelector('h1')?.innerText.trim();
            const tekst = document.body.innerText;

            const yearMatch = naam?.match(/(20\d{2})/) || tekst.match(/(20\d{2})/);
            const jaar = yearMatch ? Number(yearMatch[1]) : null;

            const dateMatch =
                tekst.match(/Date:\s*([^\n]+)/i) ||
                tekst.match(/Race date:\s*([^\n]+)/i);

            const links = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            const ritten = [];

            links.forEach((link) => {
                const url = link.getAttribute('href');
                const nrMatch = url.match(/stage-(\d+)/);

                if (nrMatch && !ritten.find((r) => r.rit_nummer === parseInt(nrMatch[1]))) {
                    ritten.push({
                        rit_nummer: parseInt(nrMatch[1]),
                        naam: link.innerText.trim(),
                    });
                }
            });

            return {
                naam,
                jaar,
                datumTekst: dateMatch?.[1]?.trim() || null,
                ritten,
                aantal_ritten: ritten.length,
            };
        });

        const datums = parsePcsDateRange(raceDetails.datumTekst, raceDetails.jaar);

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
            ...raceDetails,
            ...datums,
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
        const baseUrl = racePcsUrl.endsWith('/') ? racePcsUrl.slice(0, -1) : racePcsUrl;
        const stageUrl = `${baseUrl}/stage-${ritNummer}`;

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        await page.goto(stageUrl, {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        const data = await page.evaluate(() => {
            const results = { uitslag: [], truien: {} };
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