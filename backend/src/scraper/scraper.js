const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

async function getBrowser() {
    return await puppeteer.launch({
        headless: "new", // "new" is de aanbevolen modus in moderne Puppeteer
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
}

/**
 * DE "FUTURE PROOF" INITIALISATOR
 * Haalt wedstrijdinfo, rittenlijst en startlijst in één sessie op.
 */
async function scrapeFullRaceInfo(racePcsUrl) {
    console.log(`🚀 Volledige initiële scrape gestart voor: ${racePcsUrl}`);
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1600, height: 1200 });

        // --- STAP 1: WEDSTRIJD INFO & RITTEN ---
        await page.goto(racePcsUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        const raceDetails = await page.evaluate(() => {
            const naam = document.querySelector('h1')?.innerText.trim();
            const dateText = document.querySelector('.subheader .date')?.innerText.trim(); // Bijv: "29 Jun - 21 Jul 2024"

            // Ritten verzamelen
            const links = Array.from(document.querySelectorAll('a[href*="stage-"]'));
            const ritten = [];
            links.forEach(link => {
                const url = link.getAttribute('href');
                const text = link.innerText.trim();
                const nrMatch = url.match(/stage-(\d+)/);
                if (nrMatch && !ritten.find(r => r.rit_nummer === parseInt(nrMatch[1]))) {
                    ritten.push({ rit_nummer: parseInt(nrMatch[1]), naam: text });
                }
            });

            return { naam, dateText, ritten, aantal_ritten: ritten.length };
        });

        // --- STAP 2: STARTLIJST ---
        const startlistUrl = racePcsUrl.endsWith('/') ? `${racePcsUrl}startlist` : `${racePcsUrl}/startlist`;
        console.log(`🌐 Navigeren naar startlijst: ${startlistUrl}`);
        await page.goto(startlistUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 2000)); // Korte pauze voor JS rendering

        const deelnemers = await page.evaluate(() => {
            const list = [];
            const riderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));

            riderLinks.forEach(a => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');
                // Check of het in een deelnemers-tabel staat (om ruis te voorkomen)
                const isRiderInList = a.closest('li, tr, .rider-line');

                if (naam && naam.length > 3 && href && isRiderInList) {
                    list.push({
                        naam: naam,
                        slug: href.replace('rider/', '').trim(),
                        // Eenvoudige check voor status (DNS/DNF/OUT)
                        status: a.closest('.out, .dns, .dnf') ? 'out' : 'active'
                    });
                }
            });
            // Verwijder duplicaten op basis van slug
            return Array.from(new Map(list.map(r => [r.slug, r])).values());
        });

        return { ...raceDetails, deelnemers };
    } finally {
        await browser.close();
    }
}

/**
 * RIT DETAILS (Uitslag + Truien)
 */
async function scrapeRitDetails(racePcsUrl, ritNummer) {
    console.log(`🔎 SCRAPER GESTART voor Rit ${ritNummer}`);
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        const baseUrl = racePcsUrl.endsWith('/') ? racePcsUrl.slice(0, -1) : racePcsUrl;
        const stageUrl = `${baseUrl}/stage-${ritNummer}`;

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(stageUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));

        const data = await page.evaluate(() => {
            const results = { uitslag: [], truien: {} };
            const tables = Array.from(document.querySelectorAll('table'));

            const resultTable = tables.find(t => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10);
            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);
                results.uitslag = rows.map((row, i) => {
                    const a = row.querySelector('a[href^="rider/"]');
                    return {
                        positie: i + 1,
                        naam: a?.innerText.trim(),
                        slug: a?.getAttribute('href')?.replace('rider/', '')
                    };
                }).filter(r => r.slug);
            }

            const getLeaderSlugFromSmallTable = (headerText) => {
                const targetTable = tables.find(t =>
                    t.previousElementSibling?.innerText.includes(headerText) ||
                    t.innerText.includes(headerText)
                );
                const firstRider = targetTable?.querySelector('a[href^="rider/"]');
                return firstRider ? firstRider.getAttribute('href').replace('rider/', '') : null;
            };

            results.truien = {
                algemeen: getLeaderSlugFromSmallTable('GC'),
                punten: getLeaderSlugFromSmallTable('Points'),
                berg: getLeaderSlugFromSmallTable('KOM'),
                jongeren: getLeaderSlugFromSmallTable('Youth')
            };

            return results;
        });

        return data;
    } catch (err) {
        console.error("❌ Scraper error:", err.message);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { scrapeFullRaceInfo, scrapeRitDetails };