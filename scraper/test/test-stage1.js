const puppeteer = require('puppeteer');
const fs = require('fs');

const url = 'https://www.procyclingstats.com/race/tour-de-france/2024/stage-1';

async function scrapeFinalAttempt() {
    console.log('Browser opstarten...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-gpu']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log(`Navigeren naar: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Forceer een korte pauze voor de zekerheid
        await new Promise(r => setTimeout(r, 3000));

        // DEBUG: Maak een screenshot om te zien wat de bot ziet
        await page.screenshot({ path: 'debug_view.png' });
        console.log('Screenshot opgeslagen als debug_view.png');

        const results = await page.evaluate(() => {
            const data = { uitslag: [], truien: {} };

            // Zoek ELKE tabel op de pagina
            const tables = Array.from(document.querySelectorAll('table'));

            // De uitslagentabel is bijna altijd de tabel met de meeste rijen of de tekst 'Rider'
            const resultTable = tables.find(t => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10);

            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);
                data.uitslag = rows.map(row => {
                    const a = row.querySelector('a[href^="rider/"]');
                    const cells = row.querySelectorAll('td');
                    return {
                        pos: cells[0]?.innerText.trim() || '?',
                        naam: a?.innerText.trim() || 'Onbekend',
                        slug: a?.getAttribute('href')?.replace('rider/', '') || ''
                    };
                }).filter(r => r.slug !== '');
            }

            // Zoek truien: we zoeken naar de klassementstabelletjes onderaan
            // Deze hebben vaak headers als 'GC', 'Points', 'KOM', 'Youth'
            const getLeaderFromSmallTable = (headerText) => {
                const targetTable = tables.find(t => t.previousElementSibling?.innerText.includes(headerText) || t.innerText.includes(headerText));
                const firstRider = targetTable?.querySelector('a[href^="rider/"]');
                return firstRider ? firstRider.innerText.trim() : 'Niet gevonden';
            };

            data.truien = {
                geel: getLeaderFromSmallTable('GC'),
                groen: getLeaderFromSmallTable('Points'),
                bollen: getLeaderFromSmallTable('KOM'),
                wit: getLeaderFromSmallTable('Youth')
            };

            return data;
        });

        if (results.uitslag.length > 0) {
            console.log('Succes! Data gevonden.');
            console.table(results.uitslag);
            console.log('\n=== Klassementen na rit ===');
            console.log(results.truien);
        } else {
            console.log('De tabel kon niet worden uitgelezen. Check debug_view.png.');
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
        console.log('Browser afgesloten.');
    }
}

scrapeFinalAttempt();