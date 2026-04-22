const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

// Browser configuratie
async function getBrowser() {
    return await puppeteer.launch({
        headless: true, // We houden hem op false zodat je kunt meekijken
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });
}

/**
 * STARTLIJST SCRAPER
 */
async function importStartlist(url) {
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1600, height: 1200 });

        console.log(`🚀 Navigeren naar: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log("Pagina geladen. We scannen nu de gehele pagina op renners...");
        await new Promise(r => setTimeout(r, 5000));

        const renners = await page.evaluate(() => {
            const list = [];

            // Methode: Zoek ELKE link die naar een rider gaat
            const allRiderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));

            allRiderLinks.forEach(a => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');

                // Filter rotzooi eruit (zoals iconen of lege links)
                if (naam && naam.length > 3 && !naam.toLowerCase().includes('statistics')) {
                    // We zoeken de dichtstbijzijnde teamnaam door omhoog te kijken in de HTML
                    // Meestal staat de teamnaam in een <b> of <h5> boven de renner
                    let teamNode = a.closest('div, li, table')?.parentElement?.querySelector('b, h5, .team-name');
                    const ploeg = teamNode?.innerText.trim() || 'Onbekend';

                    const slug = href.split('rider/')[1];

                    list.push({
                        naam: naam,
                        slug: slug,
                    });
                }
            });

            return list;
        });

        // Verwijder duplicaten op basis van slug
        const uniqueRenners = Array.from(new Map(renners.map(r => [r.slug, r])).values());

        if (uniqueRenners.length === 0) {
            // Als dit nog steeds niet werkt, dumpen we de HTML voor inspectie
            const htmlSnippet = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
            console.log("Debug HTML Snippet:", htmlSnippet);
            return { success: false, error: "Zelfs met de brede scan geen renners gevonden." };
        }

        console.log(`✅ Succes! ${uniqueRenners.length} unieke renners gevonden.`);
        const { error } = await supabase.from('renners').upsert(uniqueRenners, { onConflict: 'slug' });
        if (error) throw error;

        return { success: true, count: uniqueRenners.length };

    } catch (error) {
        console.error("❌ Scraper Error:", error.message);
        return { success: false, error: error.message };
    } finally {
        await browser.close();
    }
}

/**
 * RIT UITSLAG SCRAPER
 */
async function runScraper(ritId, ritNummer) {
    const url = `https://www.procyclingstats.com/race/tour-de-france/2024/stage-${ritNummer}`;
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2' });

        const results = await page.evaluate(() => {
            const tables = Array.from(document.querySelectorAll('table'));
            const resultTable = tables.find(t => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10);

            if (!resultTable) return null;

            const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 20);
            return rows.map(row => {
                const a = row.querySelector('a[href^="rider/"]');
                return {
                    naam: a?.innerText.trim(),
                    slug: a?.getAttribute('href')?.replace('rider/', '')
                };
            }).filter(r => r.slug);
        });

        if (!results) throw new Error("Uitslag tabel niet gevonden.");

        await supabase.from('ritten').update({ gescrapet: true }).eq('id', ritId);
        return { success: true, count: results.length, data: results };

    } catch (error) {
        console.error("❌ Scraper Error:", error.message);
        return { success: false, error: error.message };
    } finally {
        await browser.close();
    }
}

module.exports = { importStartlist, runScraper };