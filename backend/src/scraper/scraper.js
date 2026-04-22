const axios = require('axios');
const cheerio = require('cheerio');
const supabase = require('../db/supabase');

// Helper om namen te matchen (bijv. "Tadej Pogačar" -> "tadej-pogacar")
const createSlug = (name) => {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '-');
};

async function importStartlist(url) {
    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);
        const renners = [];

        // PCS Startlijst selector
        $('ul.startlist-v1 > li.team').each((i, teamEl) => {
            const ploeg = $(teamEl).find('b a').text().trim();
            $(teamEl).find('ul li').each((j, riderEl) => {
                const naam = $(riderEl).find('a').first().text().trim();
                if (naam) {
                    renners.push({
                        naam: naam,
                        ploeg: ploeg || 'Onbekend',
                        prijs: 5,
                        slug: createSlug(naam)
                    });
                }
            });
        });

        const { error } = await supabase.from('renners').upsert(renners, { onConflict: 'slug' });
        if (error) throw error;
        return { success: true, count: renners.length };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { importStartlist, createSlug };