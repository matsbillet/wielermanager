const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.procyclingstats.com/race/tour-de-france/2024/stage-1';

async function testScraper() {
    try {
        console.log('Data aan het ophalen van PCS...');
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        const uitslag = [];

        // PCS zet de belangrijkste uitslag in een tabel met de class 'results'
        $('.results > tbody > tr').each((index, element) => {
            // We zoeken de specifieke kolommen op
            const rankText = $(element).find('td').eq(0).text().trim();

            // We zoeken de link die begint met 'rider/'
            const riderNode = $(element).find('a[href^="rider/"]');
            const riderName = riderNode.text().trim();

            // Dit is de gouden tip: haal de ID uit de URL (bijv. 'tadej-pogacar')
            const riderUrl = riderNode.attr('href') || '';
            const riderSlug = riderUrl.replace('rider/', '');

            // Team link
            const teamNode = $(element).find('a[href^="team/"]');
            const teamName = teamNode.text().trim();

            // Sla alleen rijen op waar daadwerkelijk een renner in staat
            if (riderName) {
                uitslag.push({
                    positie: parseInt(rankText) || rankText, // Zet '1' om in een getal, maar behoudt dingen als 'DNF'
                    naam: riderName,
                    pcs_id: riderSlug,
                    ploeg: teamName
                });
            }
        });

        console.log('=== Top 10 van Rit 1 ===');
        console.log(uitslag.slice(0, 10));

    } catch (error) {
        console.error('Er ging iets mis:', error.message);
    }
}

testScraper();