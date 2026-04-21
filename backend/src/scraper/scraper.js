const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../db/supabase');

/**
 * Helper: Maakt van een naam een slug voor matching met de DB
 * Tadej Pogačar -> tadej-pogacar
 */
const createSlug = (name) => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');
};

/**
 * Officieel puntensysteem op basis van je screenshot (Top 25)
 */
const berekenRitPunten = (positie) => {
    const p = parseInt(positie);
    const puntenSchema = [
        100, 80, 65, 55, 45, // 1-5
        35, 30, 25, 20, 17,  // 6-10
        15, 14, 13, 12, 11,  // 11-15
        10, 9, 8, 7, 6,      // 16-20
        5, 4, 3, 2, 1        // 21-25
    ];

    if (p >= 1 && p <= 25) {
        return puntenSchema[p - 1];
    }
    return 0;
};

/**
 * Scrapt de data van een URL (bijv. ProCyclingStats)
 */
async function scrapeRit(url) {
    try {
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        const resultaten = [];

        // LET OP: De selector 'table.results tbody tr' werkt voor de meeste wielersites.
        // Controleer de HTML van je bron als er niets binnenkomt.
        $('table.results tbody tr').each((index, element) => {
            const naam = $(element).find('.rider a').text().trim();
            // Soms staat de positie in een specifieke kolom, anders gebruiken we de index
            const positieRaw = $(element).find('.pos').text().trim();
            const positie = parseInt(positieRaw) || index + 1;

            if (naam && positie <= 25) {
                resultaten.push({
                    slug: createSlug(naam),
                    positie: positie
                });
            }
        });

        console.log(`🔍 Scraper vond ${resultaten.length} renners in de top 25.`);
        return resultaten;
    } catch (error) {
        console.error("❌ Scrape fout:", error.message);
        return [];
    }
}

/**
 * Slaat de resultaten op in de database en koppelt ze aan de juiste renner_id
 */
async function saveToDatabase(ritId, scraperData) {
    try {
        // 1. Haal alle renners op om slugs te kunnen matchen aan IDs
        const { data: dbRenners, error: rennerError } = await supabase
            .from('renners')
            .select('id, slug');

        if (rennerError) throw rennerError;

        // 2. Transformeer scraper data naar database rijen
        const uploadData = scraperData.map(res => {
            const renner = dbRenners.find(r => r.slug === res.slug);

            if (!renner) {
                console.warn(`⚠️ Renner niet gevonden in database: ${res.slug}`);
                return null;
            }

            return {
                rit_id: ritId,
                renner_id: renner.id,
                positie: res.positie,
                rit_punten: berekenRitPunten(res.positie),
                truien_punten: 0 // Kan later handmatig of via andere scraper gevuld worden
            };
        }).filter(item => item !== null);

        if (uploadData.length === 0) {
            return { success: false, message: "Geen match gevonden tussen scraper en database renners." };
        }

        // 3. Voer de data in (upsert overschrijft bestaande data bij re-scrape)
        const { error: insertError } = await supabase
            .from('ritresultaten')
            .upsert(uploadData, { onConflict: 'rit_id, renner_id' });

        if (insertError) throw insertError;

        // 4. Markeer rit als gescrapet in de 'ritten' tabel
        await supabase
            .from('ritten')
            .update({ gescrapet: true })
            .eq('id', ritId);

        return { success: true, count: uploadData.length };
    } catch (error) {
        console.error("❌ Database Opslag Fout:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Hoofdfunctie die wordt aangeroepen door de Admin-route
 */
async function runScraper(ritId, url) {
    const data = await scrapeRit(url);
    if (data.length > 0) {
        return await saveToDatabase(ritId, data);
    }
    return { success: false, message: "Geen data kunnen scrapen van de URL." };
}

module.exports = { runScraper };