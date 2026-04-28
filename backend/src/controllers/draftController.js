const { supabase } = require("../db/supabase");
const { getSpelerVoorBeurt } = require("../utils/draftHelper");

async function getSessie(sessieId) {
    const { data, error } = await supabase
        .from("draft_sessies")
        .select("id, competitie_id, wedstrijd_id, Naam")
        .eq("id", sessieId)
        .single();

    if (error || !data) {
        throw new Error("Draftsessie niet gevonden.");
    }

    return data;
}

async function getSpelersVoorSessie(sessieId) {
    const sessie = await getSessie(sessieId);

    const { data, error } = await supabase
        .from("spelers")
        .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
        .eq("competitie_id", sessie.competitie_id)
        .order("id", { ascending: true });

    if (error) throw error;

    return data.map((speler) => ({
        id: speler.id,
        naam: speler.gebruikers?.naam || "Onbekende gebruiker",
    }));
}

const voerKeuzeUit = async (req, res) => {
    const { sessieId, rennerId } = req.body;

    if (!sessieId || !rennerId) {
        return res.status(400).json({
            error: "sessieId en rennerId zijn verplicht.",
        });
    }

    try {
        const spelers = await getSpelersVoorSessie(sessieId);

        if (spelers.length === 0) {
            return res.status(400).json({
                error: "Geen spelers gevonden voor deze draftsessie.",
            });
        }

        const { count, error: countError } = await supabase
            .from("draft")
            .select("*", { count: "exact", head: true })
            .eq("sessie_id", sessieId);

        if (countError) throw countError;

        const huidigeBeurt = (count || 0) + 1;
        const info = getSpelerVoorBeurt(huidigeBeurt, spelers);

        if (!info) {
            return res.status(400).json({ error: "Draft voltooid." });
        }

        const { data: bestaandeKeuze, error: checkError } = await supabase
            .from("draft")
            .select("id")
            .eq("sessie_id", sessieId)
            .eq("renner_id", rennerId)
            .maybeSingle();

        if (checkError) throw checkError;

        if (bestaandeKeuze) {
            return res.status(409).json({
                error: "Deze renner is al gekozen in deze draft.",
            });
        }

        const { data, error: insertError } = await supabase
            .from("draft")
            .insert({
                sessie_id: Number(sessieId),
                speler_id: info.spelerId,
                renner_id: Number(rennerId),
                beurt_nummer: huidigeBeurt,
                ronde: info.ronde,
                is_bank: info.isBank,
            })
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({
            status: "Succes",
            bericht: `${info.spelerNaam} heeft gekozen.`,
            keuze: data,
        });
    } catch (error) {
        console.error("Draft actie mislukt:", error);
        res.status(500).json({
            error: "Draft actie mislukt",
            details: error.message,
        });
    }
};

const getTeamsPerSessie = async (req, res) => {
    const { sessieId } = req.params;

    try {
        const { data, error } = await supabase
            .from("draft")
            .select(`
                id,
                ronde,
                is_bank,
                beurt_nummer,
                renners(id, naam),
                spelers(id, gebruikers(id, naam))
            `)
            .eq("sessie_id", sessieId)
            .order("beurt_nummer", { ascending: true });

        if (error) throw error;

        const teams = data.reduce((acc, keuze) => {
            const spelerNaam = keuze.spelers?.gebruikers?.naam || "Onbekende gebruiker";

            if (!acc[spelerNaam]) acc[spelerNaam] = [];

            acc[spelerNaam].push({
                renner: keuze.renners?.naam || "Onbekende renner",
                ronde: keuze.ronde,
                isBank: keuze.is_bank,
            });

            return acc;
        }, {});

        res.json(teams);
    } catch (error) {
        console.error("Kon teams niet ophalen:", error);
        res.status(500).json({
            error: "Kon teams niet ophalen",
            details: error.message,
        });
    }
};

const getActieveSpeler = async (req, res) => {
    const { sessieId } = req.params;

    try {
        const spelers = await getSpelersVoorSessie(sessieId);

        if (spelers.length === 0) {
            return res.status(400).json({
                error: "Geen spelers gevonden voor deze draftsessie.",
            });
        }

        const { count, error: countError } = await supabase
            .from("draft")
            .select("*", { count: "exact", head: true })
            .eq("sessie_id", sessieId);

        if (countError) throw countError;

        const huidigeBeurt = (count || 0) + 1;
        const info = getSpelerVoorBeurt(huidigeBeurt, spelers);

        if (!info) {
            return res.json({ klaar: true });
        }

        res.json({
            spelerId: info.spelerId,
            spelerNaam: info.spelerNaam,
            ronde: info.ronde,
            isBank: info.isBank,
            klaar: false,
        });
    } catch (error) {
        console.error("Kon actieve speler niet ophalen:", error);
        res.status(500).json({
            error: "Kon actieve speler niet ophalen",
            details: error.message,
        });
    }
};

const getSessieVoorCompetitie = async (req, res) => {
    const { competitieId } = req.params;

    try {
        const { data, error } = await supabase
            .from("draft_sessies")
            .select("id, Naam, is_actief, wedstrijd_id, competitie_id")
            .eq("competitie_id", competitieId)
            .eq("is_actief", true)
            .single();

        if (error || !data) {
            return res.status(404).json({
                error: "Geen actieve sessie gevonden voor deze competitie.",
            });
        }

        res.json(data);
    } catch (error) {
        console.error("Fout bij ophalen sessie voor competitie:", error);
        res.status(500).json({
            error: "Fout bij ophalen sessie.",
            details: error.message,
        });
    }
};

module.exports = {
    voerKeuzeUit,
    getTeamsPerSessie,
    getActieveSpeler,
    getSessieVoorCompetitie,
};