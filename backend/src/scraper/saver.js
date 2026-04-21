const supabase = require('../db/supabase');

async function slaRitUitslagOp(ritId, resultaten) {
    console.log(`🚀 Resultaten uploaden voor rit ${ritId}...`);

    const rowsToInsert = resultaten.map(res => ({
        rit_id: ritId,
        renner_id: res.renner_id, // Dit moet het ID uit de database zijn
        positie: res.positie,
        rit_punten: res.rit_punten || 0,
        truien_punten: res.truien_punten || 0
    }));

    const { data, error } = await supabase
        .from('ritresultaten')
        .insert(rowsToInsert);

    if (error) {
        console.error('❌ Fout bij opslaan:', error.message);
    } else {
        console.log('✅ Uitslag succesvol verwerkt in de database!');
    }
}