const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

async function getBrowser() {
    return await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
}

/**
 * 1. HAAL RITTEN OP (De ontbrekende functie)
 */
async function scrapeStagesForRace(racePcsUrl, wedstrijdId) {
    console.log(`🔎 Ritten ophalen voor: ${racePcsUrl}`);
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(racePcsUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        const rittenData = await page.evaluate(() => {
            const list = [];
            const links = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            links.forEach(link => {
                const url = link.getAttribute('href');
                const text = link.innerText.trim();
                const nrMatch = url.match(/stage-(\d+)/);
                if (nrMatch) {
                    const nr = parseInt(nrMatch[1]);
                    if (!list.find(r => r.rit_nummer === nr)) {
                        list.push({ rit_nummer: nr, naam: text });
                    }
                }
            });
            return list;
        });

        if (rittenData.length > 0) {
            console.log(`📊 Scraper vond ${rittenData.length} ritten.`);
            for (const rit of rittenData) {
                await supabase.from('ritten').upsert({
                    wedstrijd_id: wedstrijdId,
                    rit_nummer: rit.rit_nummer,
                    naam: rit.naam
                }, { onConflict: ['wedstrijd_id', 'rit_nummer'] });
            }
        }
        return { success: true, count: rittenData.length };
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
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.goto(racePcsUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        const raceDetails = await page.evaluate(() => {
            const naam = document.querySelector('h1')?.innerText.trim();
            const links = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            const ritten = [];
            links.forEach(link => {
                const url = link.getAttribute('href');
                const nrMatch = url.match(/stage-(\d+)/);
                if (nrMatch && !ritten.find(r => r.rit_nummer === parseInt(nrMatch[1]))) {
                    ritten.push({ rit_nummer: parseInt(nrMatch[1]), naam: link.innerText.trim() });
                }
            });
            return { naam, ritten, aantal_ritten: ritten.length };
        });

        const startlistUrl = racePcsUrl.endsWith('/') ? `${racePcsUrl}startlist` : `${racePcsUrl}/startlist`;
        await page.goto(startlistUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        const deelnemers = await page.evaluate(() => {
            const list = [];
            const riderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));
            riderLinks.forEach(a => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');
                if (naam && naam.length > 3 && href && a.closest('li, tr, .rider-line')) {
                    list.push({ naam, slug: href.replace('rider/', '').trim() });
                }
            });
            return Array.from(new Map(list.map(r => [r.slug, r])).values());
        });

        return { ...raceDetails, deelnemers };
    } finally {
        await browser.close();
    }
}

/**
 * 3. RIT DETAILS (Uitslag)
 */
async function scrapeRitDetails(racePcsUrl, ritNummer) {
    console.log(`🔎 SCRAPER GESTART voor Rit ${ritNummer}`);
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        const baseUrl = racePcsUrl.endsWith('/') ? racePcsUrl.slice(0, -1) : racePcsUrl;
        const stageUrl = `${baseUrl}/stage-${ritNummer}`;

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(stageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        const data = await page.evaluate(() => {
            const results = { uitslag: [], truien: {} };
            const tables = Array.from(document.querySelectorAll('table'));
            const resultTable = tables.find(t => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10);

            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);
                results.uitslag = rows.map((row, i) => {
                    const a = row.querySelector('a[href^="rider/"]');
                    return { positie: i + 1, naam: a?.innerText.trim(), slug: a?.getAttribute('href')?.replace('rider/', '') };
                }).filter(r => r.slug);
            }

            const getLeaderSlug = (headerText) => {
                const targetTable = tables.find(t => t.previousElementSibling?.innerText.includes(headerText) || t.innerText.includes(headerText));
                return targetTable?.querySelector('a[href^="rider/"]')?.getAttribute('href').replace('rider/', '') || null;
            };

            results.truien = {
                algemeen: getLeaderSlug('GC'),
                punten: getLeaderSlug('Points'),
                berg: getLeaderSlug('KOM'),
                jongeren: getLeaderSlug('Youth')
            };
            return results;
        });
        return data;
    } finally {
        await browser.close();
    }
}

// ALLES EXPORTEREN
module.exports = {
    scrapeStagesForRace,
    scrapeFullRaceInfo,
    scrapeRitDetails
};