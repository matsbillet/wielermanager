const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL en SUPABASE_KEY moeten ingesteld zijn in .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Insert race stage results
 */
async function insertStageResult(stageData) {
    try {
        const { data, error } = await supabase
            .from('ritresultaten')
            .insert([
                {
                    race_name: stageData.race_name,
                    stage_number: stageData.stage_number,
                    date: new Date().toISOString(),
                    results: stageData.uitslag,
                    leaders: stageData.truien
                }
            ])
            .select();

        if (error) throw error;
        console.log('[Supabase] Stage resultaat opgeslagen:', data);
        return data;
    } catch (error) {
        console.error('[Supabase] Fout bij inserting stage result:', error.message);
        throw error;
    }
}

/**
 * Get all stage results
 */
async function getStageResults(raceId = null) {
    try {
        let query = supabase.from('ritresultaten').select('*');

        if (raceId) {
            query = query.eq('race_name', raceId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Fout bij fetching stage results:', error.message);
        throw error;
    }
}

/**
 * Insert rider data
 */
async function insertRider(riderData) {
    try {
        const { data, error } = await supabase
            .from('renners')
            .upsert(
                [
                    {
                        slug: riderData.slug,
                        name: riderData.naam,
                        team: riderData.team,
                        type: riderData.type,
                        points: riderData.points || 0
                    }
                ],
                { onConflict: 'slug' }
            )
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Fout bij inserting rider:', error.message);
        throw error;
    }
}

/**
 * Get all riders
 */
async function getRiders() {
    try {
        const { data, error } = await supabase
            .from('renners')
            .select('*')
            .order('points', { ascending: false });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Fout bij fetching riders:', error.message);
        throw error;
    }
}

/**
 * Update rider points
 */
async function updateRiderPoints(slug, points) {
    try {
        const { data, error } = await supabase
            .from('renners')
            .update({ points })
            .eq('slug', slug)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('[Supabase] Fout bij updating rider points:', error.message);
        throw error;
    }
}

module.exports = {
    supabase,
    insertStageResult,
    getStageResults,
    insertRider,
    getRiders,
    updateRiderPoints
};