const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../db/supabase');

/**
 * Helper: Maakt van een naam een slug (bijv. "Tadej Pogačar" -> "tadej-pogacar")
 */
const createSlug = (name) => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Verwijder accenten
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');
};

/**
 * Stap 1: De data van het internet plukken
 */
async function scrapeRit(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const resultaten = [];

        // PAS DIT AAN: De selector hangt af van de website (bijv. ProCyclingStats)
        // Dit is een voorbeeld voor een standaard tabel:
        $('table.results tbody tr').slice(0, 20).each((index, element) => {
            const naam = $(element).find('.rider a').text().trim();
            const positie = index + 1;

            if (naam) {
                resultaten.push({
                    slug: createSlug(naam),
                    positie: positie
                });
            }
        });

        return resultaten;
    } catch (error) {
        console.error("❌ Scrape fout:", error.message);
        return [];
    }
}

/**
 * Stap 2: De scraper data koppelen aan de Database IDs en opslaan
 */
async function saveToDatabase(ritId, scraperData) {
    try {
        // 1. Haal alle renners op uit de DB
        const { data: dbRenners } = await supabase.from('renners').select('id, slug');

        const uploadData = scraperData.map(res => {
            const renner = dbRenners.find(r => r.slug === res.slug);
            if (!renner) return null;

            return {
                rit_id: ritId,
                renner_id: renner.id,
                positie: res.positie,
                rit_punten: berekenPunten(res.positie),
                truien_punten: 0 // Kan later via de 'truien' tabel
            };
        }).filter(Boolean);

        // Gebruik upsert: als de rit al gescraped was, overschrijft hij de data i.p.v. een error te geven
        const { error } = await supabase
            .from('ritresultaten')
            .upsert(uploadData, { onConflict: 'rit_id, renner_id' });

        if (error) throw error;
        console.log("✅ Database succesvol bijgewerkt!");
    } catch (err) {
        console.error("❌ Fout:", err.message);
    }
}

/**
 * HOOFDFUNCTIE
 */
async function runScraper(ritId, url) {
    try {
        console.log(`🚀 Start scraper voor rit ${ritId} via URL: ${url}`);
        const data = await scrapeRit(url);

        if (data.length === 0) throw new Error("Geen data gevonden op de website.");

        // Haal renners op voor ID-matching
        const { data: dbRenners } = await supabase.from('renners').select('id, slug');

        const uploadData = data.map(res => {
            const renner = dbRenners.find(r => r.slug === res.slug);
            if (!renner) return null;

            return {
                rit_id: ritId,
                renner_id: renner.id,
                positie: res.positie,
                rit_punten: (res.positie === 1 ? 50 : (res.positie === 2 ? 40 : (res.positie === 3 ? 30 : 10))), // Voorbeeldpunten
                truien_punten: 0
            };
        }).filter(Boolean);

        // Upsert in de database
        const { error } = await supabase
            .from('ritresultaten')
            .upsert(uploadData, { onConflict: 'rit_id, renner_id' });

        if (error) throw error;

        // Update de 'ritten' tabel om aan te geven dat deze gescraped is (zie jouw schema)
        await supabase.from('ritten').update({ gescrapet: true }).eq('id', ritId);

        return { success: true, aantal: uploadData.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { runScraper };