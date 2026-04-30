const { supabase } = require("../db/supabase");
const { getSpelerVoorBeurt } = require("../utils/draftHelper");
const { getSpelersMetDraftVolgorde } = require("../utils/draftOrder");

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
    return await getSpelersMetDraftVolgorde(sessieId);
}

async function getVolgendeDraftSlot(sessieId, spelers) {
    const maxBeurten = spelers.length * 18;

    const { data, error } = await supabase
        .from("draft")
        .select("id, beurt_nummer, speler_id, ronde, is_bank, renner_id")
        .eq("sessie_id", sessieId)
        .order("beurt_nummer", { ascending: true });

    if (error) throw error;

    const draftRijen = data || [];

    const legeRij = draftRijen.find((rij) => rij.renner_id === null);

    if (legeRij) {
        return {
            bestaatAl: true,
            draftId: legeRij.id,
            beurtNummer: legeRij.beurt_nummer,
            spelerId: legeRij.speler_id,
            ronde: legeRij.ronde,
            isBank: legeRij.is_bank,
        };
    }

    const gebruikteBeurten = new Set(
        draftRijen.map((rij) => Number(rij.beurt_nummer))
    );

    for (let beurt = 1; beurt <= maxBeurten; beurt++) {
        if (!gebruikteBeurten.has(beurt)) {
            const info = getSpelerVoorBeurt(beurt, spelers);

            return {
                bestaatAl: false,
                beurtNummer: beurt,
                spelerId: info.spelerId,
                ronde: info.ronde,
                isBank: info.isBank,
            };
        }
    }

    return null;
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

        const slot = await getVolgendeDraftSlot(sessieId, spelers);

        if (!slot) {
            return res.status(400).json({ error: "Draft voltooid." });
        }

        const speler = spelers.find(
            (speler) => Number(speler.id) === Number(slot.spelerId)
        );

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

        let data;

        if (slot.bestaatAl) {
            const { data: updateData, error: updateError } = await supabase
                .from("draft")
                .update({
                    renner_id: Number(rennerId),
                })
                .eq("id", slot.draftId)
                .select()
                .single();

            if (updateError) throw updateError;

            data = updateData;
        } else {
            const { data: insertData, error: insertError } = await supabase
                .from("draft")
                .insert({
                    sessie_id: Number(sessieId),
                    speler_id: slot.spelerId,
                    renner_id: Number(rennerId),
                    beurt_nummer: slot.beurtNummer,
                    ronde: slot.ronde,
                    is_bank: slot.isBank,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            data = insertData;
        }

        res.json({
            status: "Succes",
            bericht: `${speler?.naam || "Speler"} heeft gekozen.`,
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
                renner_id,
                renners(id, naam),
                spelers(id, gebruikers(id, naam))
            `)
            .eq("sessie_id", sessieId)
            .order("beurt_nummer", { ascending: true });

        if (error) throw error;

        const teams = data.reduce((acc, keuze) => {
            const spelerNaam = keuze.spelers?.gebruikers?.naam || "Onbekende gebruiker";

            if (!acc[spelerNaam]) acc[spelerNaam] = [];

            if (keuze.renner_id !== null) {
                acc[spelerNaam].push({
                    renner: keuze.renners?.naam || "Onbekende renner",
                    ronde: keuze.ronde,
                    isBank: keuze.is_bank,
                });
            }

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

        const slot = await getVolgendeDraftSlot(sessieId, spelers);

        if (!slot) {
            return res.json({ klaar: true });
        }

        const speler = spelers.find(
            (speler) => Number(speler.id) === Number(slot.spelerId)
        );

        res.json({
            spelerId: slot.spelerId,
            spelerNaam: speler?.naam || "Onbekende speler",
            ronde: slot.ronde,
            isBank: slot.isBank,
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
            .select(`
                id,
                Naam,
                is_actief,
                wedstrijd_id,
                competitie_id,
                wedstrijden (
                    id,
                    naam,
                    jaar,
                    slug,
                    start_datum,
                    eind_datum,
                    status
                )
            `)
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

const getTeamVanSpeler = async (req, res) => {
    const { sessieId, spelerId } = req.params;

    try {
        const { data, error } = await supabase
            .from("draft")
            .select(`
                id,
                ronde,
                is_bank,
                beurt_nummer,
                renner_id,
                renners(id, naam, ploeg)
            `)
            .eq("sessie_id", sessieId)
            .eq("speler_id", spelerId)
            .order("is_bank", { ascending: true })
            .order("ronde", { ascending: true });

        if (error) throw error;

        const team = data.map((keuze) => ({
            draftId: keuze.id,
            rennerId: keuze.renner_id,
            naam: keuze.renners?.naam || "Onbekende renner",
            ploeg: keuze.renners?.ploeg || "",
            ronde: keuze.ronde,
            isBank: keuze.is_bank,
        }));

        res.json(team);
    } catch (error) {
        res.status(500).json({
            error: "Kon team van speler niet ophalen",
            details: error.message,
        });
    }
};

module.exports = {
    voerKeuzeUit,
    getTeamsPerSessie,
    getActieveSpeler,
    getSessieVoorCompetitie,
    getTeamVanSpeler,
};