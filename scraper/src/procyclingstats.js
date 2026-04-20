const puppeteer = require('puppeteer');

/**
 * Scrapt de top 25 en de truidragers van een specifieke PCS etappe-URL.
 * @param {string} url - De volledige URL van de etappe op ProCyclingStats.
 * @returns {Promise<Object>} - Een object met de uitslag en truidragers.
 */
async function scrapeStageData(url) {
    console.log(`[Scraper] Browser opstarten voor: ${url}...`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-gpu']
    });

    try {
        const page = await browser.newPage();

        // We stellen een desktop viewport en user-agent in voor stabiliteit
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigeer naar de pagina
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wacht even extra zodat alle tabellen zeker gerenderd zijn
        await new Promise(r => setTimeout(r, 2000));

        const data = await page.evaluate(() => {
            const result = { uitslag: [], truien: {} };
            const tables = Array.from(document.querySelectorAll('table'));

            // 1. Zoek de hoofdtabel voor de daguitslag (Top 25)
            const resultTable = tables.find(t =>
                t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10
            );

            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);
                result.uitslag = rows.map(row => {
                    const a = row.querySelector('a[href^="rider/"]');
                    const cells = row.querySelectorAll('td');
                    return {
                        pos: cells[0]?.innerText.trim() || '?',
                        naam: a?.innerText.trim() || 'Onbekend',
                        slug: a?.getAttribute('href')?.replace('rider/', '') || ''
                    };
                }).filter(r => r.slug !== '');
            }

            // 2. Zoek de leiders in de klassementen (Truien)
            const getLeaderFromSmallTable = (headerText) => {
                const targetTable = tables.find(t =>
                    t.previousElementSibling?.innerText.includes(headerText) ||
                    t.innerText.includes(headerText)
                );
                const firstRider = targetTable?.querySelector('a[href^="rider/"]');
                return firstRider ? firstRider.innerText.trim() : 'Niet gevonden';
            };

            result.truien = {
                geel: getLeaderFromSmallTable('GC'),
                groen: getLeaderFromSmallTable('Points'),
                bollen: getLeaderFromSmallTable('KOM'),
                wit: getLeaderFromSmallTable('Youth')
            };

            return result;
        });

        console.log(`[Scraper] Succesvol ${data.uitslag.length} renners gescrapt.`);
        return data;

    } catch (error) {
        console.error('[Scraper] Fout tijdens het scrapen:', error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

// Exporteer de functie zodat je deze kunt gebruiken in andere bestanden
module.exports = { scrapeStageData };