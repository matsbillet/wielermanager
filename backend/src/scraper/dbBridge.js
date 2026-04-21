const supabase = require('../db/supabase');

async function verwerkScraperData(ritId, scraperResults) {
    try {
        console.log("1. Renners ophalen uit de database voor ID-matching...");
        const { data: dbRenners, error: rennerError } = await supabase
            .from('renners')
            .select('id, slug');

        if (rennerError) throw rennerError;

        console.log("2. Scraper namen matchen met Database ID's...");
        const uploadData = scraperResults.map(result => {
            // Zoek de renner in de DB die matcht met de slug van de scraper
            const match = dbRenners.find(r => r.slug === result.slug);

            if (!match) {
                console.warn(`⚠️ Renner niet gevonden in DB: ${result.slug}`);
                return null;
            }

            return {
                rit_id: ritId,
                renner_id: match.id,
                positie: result.positie,
                rit_punten: berekenPunten(result.positie), // Helper functie
                truien_punten: 0 // Kun je later invullen
            };
        }).filter(row => row !== null); // Verwijder renners die niet in de DB stonden

        console.log(`3. ${uploadData.length} resultaten uploaden naar 'ritresultaten'...`);
        const { error: insertError } = await supabase
            .from('ritresultaten')
            .insert(uploadData);

        if (insertError) throw insertError;

        console.log("✅ Alles succesvol opgeslagen!");

    } catch (err) {
        console.error("❌ Fout bij het linken van scraper aan DB:", err.message);
    }
}

// Simpele puntenverdeling (pas dit aan naar jullie eigen regels)
function berekenPunten(positie) {
    const puntenSchema = { 1: 50, 2: 40, 3: 30, 4: 20, 5: 10 };
    return puntenSchema[positie] || 0;
}

module.exports = { verwerkScraperData };