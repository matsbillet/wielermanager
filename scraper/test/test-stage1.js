const puppeteer = require('puppeteer');

const url = 'https://www.procyclingstats.com/race/tour-de-france/2024/stage-1';

async function testScraper() {
    console.log('Browser opstarten...');

    const browser = await puppeteer.launch({
        headless: false, // JE GAAT NU EEN BROWSER ZIEN OPENEN!
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Simuleer een echte Mac gebruiker
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');

        console.log(`Navigeren naar: ${url}`);

        // Wacht tot de basis van de pagina geladen is
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        console.log('Wachten op tabel (max 15 sec)...');

        // We zoeken nu naar ELKE tabel die op de pagina verschijnt
        await page.waitForSelector('table', { timeout: 15000 });

        const uitslag = await page.evaluate(() => {
            // We zoeken specifiek naar de tabel waar 'Rider' in de kolomkop staat
            const allTables = Array.from(document.querySelectorAll('table'));
            const resultTable = allTables.find(t => t.innerText.includes('Rider'));

            if (!resultTable) return [];

            const rows = Array.from(resultTable.querySelectorAll('tbody tr'));

            return rows.map(row => {
                const cells = row.querySelectorAll('td');
                const riderLink = row.querySelector('a[href^="rider/"]');
                const teamLink = row.querySelector('a[href^="team/"]');

                if (!riderLink) return null;

                return {
                    pos: cells[0]?.innerText.trim(),
                    naam: riderLink.innerText.trim(),
                    slug: riderLink.getAttribute('href').replace('rider/', ''),
                    team: teamLink ? teamLink.innerText.trim() : '?'
                };
            }).filter(item => item !== null);
        });

        if (uitslag.length === 0) {
            console.log('❌ Geen data gevonden in de tabel.');
        } else {
            console.log('✅ Succes!');
            console.table(uitslag.slice(0, 10));
        }

    } catch (error) {
        console.error('❌ Fout:', error.message);
    } finally {
        // We houden de browser 5 seconden open zodat je kunt kijken wat er gebeurde
        console.log('Browser sluit over 5 seconden...');
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
}

testScraper();