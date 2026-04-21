const supabase = require('./supabase');
const fs = require('fs');
const path = require('path');

async function seedRenners() {
    try {
        console.log('Starten met het inladen van renners...');


        const jsonPath = path.join(__dirname, '..', '..', '..', 'docs', 'renners.json');

        console.log(`Zoeken naar bestand op: ${jsonPath}`);

        if (!fs.existsSync(jsonPath)) {
            console.error('❌ Fout: renners.json niet gevonden!');
            return;
        }

        const rawData = fs.readFileSync(jsonPath, 'utf8');
        const renners = JSON.parse(rawData);

        const rennersToInsert = renners.map(r => ({
            naam: r.naam,
            slug: r.slug || r.naam.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
            ploeg: r.ploeg || 'Onbekend'
        }));

        console.log(`Bezig met uploaden van ${rennersToInsert.length} renners naar Supabase...`);

        const { data, error } = await supabase
            .from('renners')
            .insert(rennersToInsert);

        if (error) throw error;

        console.log('✅ Succes! De database is gevuld.');

    } catch (error) {
        console.error('❌ Er ging iets mis:', error.message);
    }
}

seedRenners();