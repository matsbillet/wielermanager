const puppeteer = require('puppeteer');
const { supabase } = require('../db/supabase');

async function getBrowser() {
    return await puppeteer.launch({
        headless: true, // Zet op true als alles stabiel draait
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
}

// --- STARTLIJST SCRAPER ---
async function importStartlist(url, wedstrijdId) {
    if (!url) {
        throw new Error('PCS startlist URL ontbreekt.');
    }

    if (!wedstrijdId) {
        throw new Error('wedstrijdId ontbreekt. Kies eerst voor welke koers je de startlijst importeert.');
    }

    console.log('Startlist import gestart');
    console.log('URL:', url);
    console.log('wedstrijdId:', wedstrijdId);

    const browser = await getBrowser();

    try {
        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        );

        await page.setViewport({ width: 1600, height: 1200 });

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise((r) => setTimeout(r, 5000));

        const renners = await page.evaluate(() => {
            const list = [];
            const allRiderLinks = Array.from(document.querySelectorAll('a[href^="rider/"]'));

            allRiderLinks.forEach((a) => {
                const naam = a.innerText.trim();
                const href = a.getAttribute('href');

                if (naam && naam.length > 3 && href) {
                    list.push({
                        naam,
                        ploeg: 'Onbekend',
                        slug: href.replace('rider/', '').trim(),
                    });
                }
            });

            return list;
        });

        const uniqueRenners = Array.from(
            new Map(renners.map((renner) => [renner.slug, renner])).values()
        );

        console.log(`Aantal gevonden unieke renners: ${uniqueRenners.length}`);

        if (uniqueRenners.length === 0) {
            throw new Error('Geen renners gevonden. Controleer of je echt een PCS startlist URL gebruikt.');
        }

        const { data: opgeslagenRenners, error: rennersError } = await supabase
            .from('renners')
            .upsert(uniqueRenners, { onConflict: 'slug' })
            .select('id, naam, slug, ploeg');

        if (rennersError) {
            console.error('Fout bij upsert renners:', rennersError);
            throw rennersError;
        }

        console.log(`Aantal opgeslagen renners: ${opgeslagenRenners.length}`);

        const { error: deleteError } = await supabase
            .from('wedstrijd_deelnemers')
            .delete()
            .eq('wedstrijd_id', Number(wedstrijdId));

        if (deleteError) {
            console.error('Fout bij verwijderen oude wedstrijd_deelnemers:', deleteError);
            throw deleteError;
        }

        const deelnemersRows = opgeslagenRenners.map((renner) => ({
            wedstrijd_id: Number(wedstrijdId),
            renner_id: Number(renner.id),
        }));

        const { data: deelnemersData, error: deelnemersError } = await supabase
            .from('wedstrijd_deelnemers')
            .insert(deelnemersRows)
            .select();

        if (deelnemersError) {
            console.error('Fout bij insert wedstrijd_deelnemers:', deelnemersError);
            throw deelnemersError;
        }

        console.log(`Aantal gekoppelde wedstrijd_deelnemers: ${deelnemersData.length}`);

        return {
            success: true,
            count: opgeslagenRenners.length,
            gekoppeld: deelnemersData.length,
            wedstrijdId: Number(wedstrijdId),
        };
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
        console.log("📄 Pagina geladen. Wachten op tabel...");

        try {
            // PCS laadt resultaten vaak in een div met class .result-cont
            await page.waitForSelector('.results-table', { timeout: 10000 });
        } catch (e) {
            console.log("⚠️ Tabel niet verschenen binnen 10 seconden.");
        }

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

            // 1. Uitslag tabel (zoals in je test)
            const resultTable = tables.find(t => t.innerText.includes('Rider') && t.querySelectorAll('tr').length > 10);
            if (resultTable) {
                const rows = Array.from(resultTable.querySelectorAll('tbody tr')).slice(0, 25);
                results.uitslag = rows.map(row => {
                    const a = row.querySelector('a[href^="rider/"]');
                    return {
                        naam: a?.innerText.trim(),
                        slug: a?.getAttribute('href')?.replace('rider/', '')
                    };
                }).filter(r => r.slug);
            }

            // 2. Truien tabel (zoals in je test)
            const getLeaderSlugFromSmallTable = (headerText) => {
                const targetTable = tables.find(t =>
                    t.previousElementSibling?.innerText.includes(headerText) ||
                    t.innerText.includes(headerText)
                );
                const firstRider = targetTable?.querySelector('a[href^="rider/"]');
                // Belangrijk: we hebben de SLUG nodig voor de database koppeling later
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

        console.log("✅ Scraper resultaat:", data.truien);
        return data;
    } catch (err) {
        console.error("❌ Scraper error:", err.message);
        return null;
    } finally {
        await browser.close();
    }
}

module.exports = { importStartlist, scrapeRitUitslag, scrapeStagesForRace, scrapeRitDetails };