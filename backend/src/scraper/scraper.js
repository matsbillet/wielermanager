const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../db/supabase');

const createSlug = (name) => {
    return name
        .toLowerCase()
        .normalize("NFD") // Haalt accenten weg (Pogačar -> Pogacar)
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '-');
};
/**
 * 1. Het puntensysteem uit jullie reglement
 */
const berekenRitPunten = (positie) => {
    const p = parseInt(positie);
    const puntenSchema = [
        100, 80, 65, 55, 45, 35, 30, 25, 20, 17,
        15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
        5, 4, 3, 2, 1
    ];
    return (p >= 1 && p <= 25) ? puntenSchema[p - 1] : 0;
};

/**
 * 2. De hoofdfunctie die alles koppelt
 */
/**
 * Importeert de volledige deelnemerslijst (Startlist)
 */
async function importStartlist(url) {
    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);
        const renners = [];

        // De juiste selector voor de PCS startlijst-pagina
        $('ul.startlist-v1 > li.team').each((i, teamElement) => {
            const ploeg = $(teamElement).find('b a').text().trim();

            $(teamElement).find('ul li').each((j, riderElement) => {
                const naam = $(riderElement).find('a').first().text().trim();

                if (naam) {
                    renners.push({
                        naam: naam,
                        ploeg: ploeg || 'Onbekend',
                        prijs: 5,
                        slug: createSlug(naam) // Zorg dat deze functie BOVENAAN je bestand staat
                    });
                }
            });
        });

        if (renners.length === 0) {
            throw new Error("Geen renners gevonden op deze pagina. Check de URL.");
        }

        const { error } = await supabase.from('renners').upsert(renners, { onConflict: 'slug' });
        if (error) throw error;

        return { success: true, count: renners.length };
    } catch (error) {
        console.error("❌ Import fout:", error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Aangepaste runScraper met URL-generator en check
 */
async function runScraper(ritId, ritNummer) {
    // Dynamische URL voor de Tour de France 2026
    const url = `https://www.procyclingstats.com/race/tour-de-france/2026/stage-${ritNummer}`;

    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);

        // CHECK: Is de uitslag-tabel aanwezig?
        const resultsTable = $('table.results tbody tr');
        if (resultsTable.length === 0) {
            return { success: false, message: "De uitslag voor deze etappe is nog niet beschikbaar." };
        }

        // ... hier volgt de rest van je bestaande top-25 scraping en saveToDatabase logica ...
        // (Zorg dat je de saveToDatabase functie aanroept die we eerder hebben gemaakt)

    } catch (error) {
        return { success: false, message: "Kon de pagina niet bereiken. Is de rit al aangemaakt op PCS?" };
    }
}

module.exports = { runScraper };