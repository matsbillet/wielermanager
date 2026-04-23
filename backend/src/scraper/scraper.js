const puppeteer = require('puppeteer');
const supabase = require('../db/supabase');

async function getBrowser() {
    return await puppeteer.launch({
        headless: false, // Zet op true als alles stabiel draait
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
}

// --- STARTLIJST SCRAPER ---
async function importStartlist(url) {
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1600, height: 1200 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        const renners = await page.evaluate(() => {
            const list = [];
            const allRiderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));
            allRiderLinks.forEach(a => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');
                if (naam && naam.length > 3 && !naam.toLowerCase().includes('statistics')) {
                    let teamNode = a.closest('div, li, table')?.parentElement?.querySelector('b, h5, .team-name');
                    const ploeg = teamNode?.innerText.trim() || 'Onbekend';
                    list.push({ naam, ploeg: ploeg.split(' (')[0], slug: href.split('rider/')[1] });
                }
            });
            return list;
        });

        const uniqueRenners = Array.from(new Map(renners.map(r => [r.slug, r])).values());
        const { error } = await supabase.from('renners').upsert(uniqueRenners, { onConflict: 'slug' });
        if (error) throw error;

        return { success: true, count: uniqueRenners.length };
    } finally {
        await browser.close();
    }
}

// --- RIT UITSLAG SCRAPER ---
async function scrapeRitUitslag(racePcsUrl, ritNummer) {
    const url = `${racePcsUrl}/stage-${ritNummer}`;
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const uitslag = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table.results tbody tr'));
            return rows.slice(0, 20).map((row, index) => {
                const a = row.querySelector('a[href^="rider/"]');
                return {
                    positie: index + 1,
                    slug: a?.getAttribute('href')?.split('rider/')[1]
                };
            }).filter(r => r.slug);
        });

        return uitslag;
    } finally {
        await browser.close();
    }
}

module.exports = { importStartlist, scrapeRitUitslag };