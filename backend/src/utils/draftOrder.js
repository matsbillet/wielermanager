const { supabase } = require("../db/supabase");

async function getSessie(sessieId) {
    const { data, error } = await supabase
        .from("draft_sessies")
        .select("id, competitie_id, wedstrijd_id, created_at")
        .eq("id", sessieId)
        .single();

    if (error || !data) {
        throw new Error("Draftsessie niet gevonden.");
    }

    return data;
}

async function getBasisSpelers(competitieId) {
    const { data, error } = await supabase
        .from("spelers")
        .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
        .eq("competitie_id", competitieId)
        .order("id", { ascending: true });

    if (error) throw error;

    return (data || []).map((speler) => ({
        id: speler.id,
        naam: speler.gebruikers?.naam || "Onbekende gebruiker",
        gebruikerId: speler.gebruiker_id,
        competitieId: speler.competitie_id,
    }));
}

async function getVorigeSessie(huidigeSessie) {
    const { data, error } = await supabase
        .from("draft_sessies")
        .select("id, competitie_id, wedstrijd_id, created_at")
        .eq("competitie_id", huidigeSessie.competitie_id)
        .neq("id", huidigeSessie.id)
        .lt("created_at", huidigeSessie.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;

    return data || null;
}

async function berekenScoresVoorSessie(sessie, spelers) {
    const { data: ritten, error: rittenError } = await supabase
        .from("ritten")
        .select("id, rit_nummer")
        .eq("wedstrijd_id", sessie.wedstrijd_id);

    if (rittenError) throw rittenError;

    const { data: draft, error: draftError } = await supabase
        .from("draft")
        .select("speler_id, renner_id, is_bank")
        .eq("sessie_id", sessie.id)
        .not("renner_id", "is", null);

    if (draftError) throw draftError;

    const { data: teamStatusData, error: teamStatusError } = await supabase
        .from("team_status")
        .select("speler_id, wedstrijd_id, renner_id, actief_vanaf_rit, actief_tot_rit, status")
        .eq("wedstrijd_id", sessie.wedstrijd_id);

    if (teamStatusError) throw teamStatusError;

    const teamStatus = teamStatusData || [];
    const ritIds = (ritten || []).map((rit) => rit.id);

    let ritresultaten = [];

    if (ritIds.length > 0) {
        const { data, error } = await supabase
            .from("ritresultaten")
            .select("rit_id, renner_id, punten, rit_punten, truien_punten, trui_punten")
            .in("rit_id", ritIds);

        if (error) throw error;

        ritresultaten = data || [];
    }

    function isRennerActiefVoorRit(spelerId, rennerId, ritNummer) {
        const actieveStatus = teamStatus.some(
            (status) =>
                Number(status.speler_id) === Number(spelerId) &&
                Number(status.renner_id) === Number(rennerId) &&
                status.status === "actief" &&
                Number(status.actief_vanaf_rit) <= Number(ritNummer) &&
                (
                    status.actief_tot_rit === null ||
                    Number(status.actief_tot_rit) >= Number(ritNummer)
                )
        );

        if (actieveStatus) return true;

        const heeftStatusHistoriek = teamStatus.some(
            (status) => Number(status.speler_id) === Number(spelerId)
        );

        if (!heeftStatusHistoriek) {
            return draft.some(
                (keuze) =>
                    Number(keuze.speler_id) === Number(spelerId) &&
                    Number(keuze.renner_id) === Number(rennerId) &&
                    keuze.is_bank === false
            );
        }

        return false;
    }

    const scores = new Map();

    spelers.forEach((speler) => {
        let totaal = 0;

        (ritten || []).forEach((rit) => {
            const resultatenVanRit = ritresultaten.filter(
                (resultaat) =>
                    Number(resultaat.rit_id) === Number(rit.id) &&
                    isRennerActiefVoorRit(speler.id, resultaat.renner_id, rit.rit_nummer)
            );

            totaal += resultatenVanRit.reduce((som, resultaat) => {
                return som +
                    Number(resultaat.rit_punten ?? resultaat.punten ?? 0) +
                    Number(resultaat.truien_punten ?? resultaat.trui_punten ?? 0);
            }, 0);
        });

        scores.set(Number(speler.id), totaal);
    });

    return scores;
}

async function getSpelersMetDraftVolgorde(sessieId) {
    const huidigeSessie = await getSessie(sessieId);
    const spelers = await getBasisSpelers(huidigeSessie.competitie_id);

    if (spelers.length === 0) return [];

    const vorigeSessie = await getVorigeSessie(huidigeSessie);

    if (!vorigeSessie) {
        return spelers.map((speler, index) => ({
            ...speler,
            draftVolgorde: index + 1,
            vorigeScore: null,
        }));
    }

    const scores = await berekenScoresVoorSessie(vorigeSessie, spelers);

    return spelers
        .map((speler) => ({
            ...speler,
            vorigeScore: scores.get(Number(speler.id)) ?? 0,
        }))
        .sort((a, b) => {
            if (a.vorigeScore !== b.vorigeScore) {
                return a.vorigeScore - b.vorigeScore;
            }

            return Number(a.id) - Number(b.id);
        })
        .map((speler, index) => ({
            ...speler,
            draftVolgorde: index + 1,
        }));
}

module.exports = {
    getSpelersMetDraftVolgorde,
};