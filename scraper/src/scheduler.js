const { scrapeStageData } = require('./procyclingstats.js');

async function run() {
    try {
        const url = 'https://www.procyclingstats.com/race/tour-de-france/2024/stage-2';
        const data = await scrapeStageData(url);

        console.log('Ontvangen data:', data);
        // Hier kun je de data later naar de backend sturen
    } catch (err) {
        console.error('Run gefaald:', err);
    }
}

run();