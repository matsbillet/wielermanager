const axios = require('axios');
const cheerio = require('cheerio');

const url = 'https://www.procyclingstats.com/race/tour-de-france/2024/stage-1';

axios.get(url).then(res => {
    const $ = cheerio.load(res.data);
    $('table').each((i, table) => {
        console.log(=== Tabel ${ i } ===);
        console.log($(table).text().slice(0, 300));
    });
}).catch(err => console.error(err.message));