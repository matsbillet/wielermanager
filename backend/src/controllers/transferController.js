const { supabase } = require("../db/supabase");

async function haalSessieOp(sessieId) {
    const { data, error } = await supabase
        .from("draft_sessies")
        .select("id, competitie_id, wedstrijd_id")
        .eq("id", sessieId)
        .single();

    if (error || !data) throw new Error("Draftsessie niet gevonden.");
    return data;
}

async function vervangVoorStart(req, res) {
    const { sessie_id, speler_id, renner_uit_id, renner_in_id } = req.body;

    if (!sessie_id || !speler_id || !renner_uit_id || !renner_in_id) {
        return res.status(400).json({ error: "sessie_id, speler_id, renner_uit_id en renner_in_id zijn verplicht." });
    }

    try {
        const sessie = await haalSessieOp(sessie_id);

        const { data: bestaandeKeuze } = await supabase
            .from("draft")
            .select("id")
            .eq("sessie_id", sessie_id)
            .eq("renner_id", renner_in_id)
            .maybeSingle();

        if (bestaandeKeuze) {
            return res.status(409).json({ error: "Deze renner zit al in een team." });
        }

        const { error: updateError } = await supabase
            .from("draft")
            .update({ renner_id: renner_in_id })
            .eq("sessie_id", sessie_id)
            .eq("speler_id", speler_id)
            .eq("renner_id", renner_uit_id);

        if (updateError) throw updateError;

        await supabase
            .from("transfers")
            .insert({
                speler_id,
                wedstrijd_id: sessie.wedstrijd_id,
                rit_nummer: 0,
                renner_uit: renner_uit_id,
                renner_in: renner_in_id,
                reden: "voor_start"
            });

        res.json({ status: "Succes", bericht: "Renner vervangen vóór de start." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function blessureWissel(req, res) {
    const { sessie_id, speler_id, renner_uit_id, renner_in_id, rit_nummer } = req.body;

    if (!sessie_id || !speler_id || !renner_uit_id || !renner_in_id || !rit_nummer) {
        return res.status(400).json({ error: "Alle velden zijn verplicht." });
    }

    try {
        const sessie = await haalSessieOp(sessie_id);
        const volgendeRit = Number(rit_nummer) + 1;

        await supabase
            .from("team_status")
            .update({ actief_tot_rit: Number(rit_nummer) })
            .eq("speler_id", speler_id)
            .eq("wedstrijd_id", sessie.wedstrijd_id)
            .eq("renner_id", renner_uit_id)
            .eq("status", "actief")
            .is("actief_tot_rit", null);

        await supabase
            .from("team_status")
            .insert([
                {
                    speler_id,
                    wedstrijd_id: sessie.wedstrijd_id,
                    renner_id: renner_uit_id,
                    actief_vanaf_rit: volgendeRit,
                    actief_tot_rit: null,
                    status: "uitgevallen",
                    reden: "blessure"
                },
                {
                    speler_id,
                    wedstrijd_id: sessie.wedstrijd_id,
                    renner_id: renner_in_id,
                    actief_vanaf_rit: volgendeRit,
                    actief_tot_rit: null,
                    status: "actief",
                    reden: "bank_naar_actief"
                }
            ]);

        await supabase
            .from("draft")
            .update({ is_bank: true })
            .eq("sessie_id", sessie_id)
            .eq("speler_id", speler_id)
            .eq("renner_id", renner_uit_id);

        await supabase
            .from("draft")
            .update({ is_bank: false })
            .eq("sessie_id", sessie_id)
            .eq("speler_id", speler_id)
            .eq("renner_id", renner_in_id);

        await supabase
            .from("transfers")
            .insert({
                speler_id,
                wedstrijd_id: sessie.wedstrijd_id,
                rit_nummer: volgendeRit,
                renner_uit: renner_uit_id,
                renner_in: renner_in_id,
                reden: "blessure"
            });

        res.json({ status: "Succes", bericht: `Wissel actief vanaf rit ${volgendeRit}.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    vervangVoorStart,
    blessureWissel
};