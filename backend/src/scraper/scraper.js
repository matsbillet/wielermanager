const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../db/supabase');

// Helper om namen te matchen (bijv. "Tadej Pogačar" -> "tadej-pogacar")
const createSlug = (name) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
};


async function importStartlist(url) {
    try {
        console.log("Poging tot scrapen van URL:", url);

        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'max-age=0',
                'Sec-Ch-Ua': '"Chromium";v="123", "Not:A-Brand";v="8"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"macOS"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        const $ = cheerio.load(html);
        const renners = [];

        // Selecteer de teams en renners
        $('ul.startlist-v1 > li.team').each((i, teamEl) => {
            const ploeg = $(teamEl).find('b a').text().trim();
            $(teamEl).find('ul li').each((j, riderEl) => {
                const naam = $(riderEl).find('a').first().text().trim();
                if (naam) {
                    renners.push({
                        naam: naam,
                        ploeg: ploeg || 'Onbekend',
                        prijs: 5,
                        slug: naam.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-')
                    });
                }
            });
        });

        if (renners.length === 0) {
            throw new Error("Geen renners gevonden op de pagina. Is de URL correct?");
        }

        console.log(`✅ Succes! ${renners.length} renners gevonden. Opslaan...`);

        const { error } = await supabase.from('renners').upsert(renners, { onConflict: 'slug' });
        if (error) throw error;

        return { success: true, count: renners.length };

    } catch (error) {
        console.error("❌ Scraper fout:", error.message);
        return {
            success: false,
            error: error.response?.status === 403
                ? "PCS blokkeert de server nog steeds (403). Probeer een andere URL of wacht even."
                : error.message
        };
    }
}



module.exports = { importStartlist, createSlug };