const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

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

// backend/src/scraper/scraper.js

async function scrapeStagesForRace(racePcsUrl, wedstrijdId) {
    console.log(`🔎 Browser opstarten voor: ${racePcsUrl}`);
    const browser = await getBrowser();
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Stap 1: Navigatie
        console.log("🌐 Pagina laden...");
        await page.goto(racePcsUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log("📄 Pagina geladen, elementen zoeken...");

        // Stap 2: Data ophalen
        const rittenData = await page.evaluate(() => {
            const list = [];
            // We zoeken alle links die naar een 'stage-' verwijzen
            const links = Array.from(document.querySelectorAll('a[href*="stage-"]'));

            links.forEach(link => {
                const url = link.getAttribute('href');
                const text = link.innerText.trim();
                const nrMatch = url.match(/stage-(\d+)/);

                if (nrMatch) {
                    const nr = parseInt(nrMatch[1]);
                    // Voorkom dubbele ritten in de lijst
                    if (!list.find(r => r.rit_nummer === nr)) {
                        list.push({ rit_nummer: nr, naam: text });
                    }
                }
            });
            return list;
        });

        console.log(`📊 Scraper vond ${rittenData.length} ritten.`);

        // Stap 3: Opslaan
        if (rittenData.length > 0) {
            console.log("💾 Opslaan in database...");
            for (const rit of rittenData) {
                const { error } = await supabase.from('ritten').upsert({
                    wedstrijd_id: wedstrijdId,
                    rit_nummer: rit.rit_nummer,
                    naam: rit.naam
                }, { onConflict: ['wedstrijd_id', 'rit_nummer'] });

                if (error) console.error(`❌ DB Fout voor rit ${rit.rit_nummer}:`, error.message);
            }
            console.log("✨ Alles opgeslagen!");
        } else {
            console.log("⚠️ Geen ritten gevonden op de pagina. Controleer de PCS URL.");
        }

        return { success: true, count: rittenData.length };
    } catch (err) {
        console.error("❌ SCRAPER CRASH:", err.message);
        throw err;
    } finally {
        await browser.close();
        console.log("🚪 Browser gesloten.");
    }
}

module.exports = { importStartlist, scrapeRitUitslag, scrapeStagesForRace };