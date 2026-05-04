const express = require("express");
const router = express.Router();
const { supabase } = require("../db/supabase");

async function maakScoreboardVoorSessie(sessie) {
    const { data: spelersData, error: spelersError } = await supabase
        .from("spelers")
        .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
        .eq("competitie_id", sessie.competitie_id)
        .order("id", { ascending: true });

    if (spelersError) throw spelersError;

    const { data: ritten, error: rittenError } = await supabase
        .from("ritten")
        .select("id, rit_nummer, naam, gescrapet")
        .eq("wedstrijd_id", sessie.wedstrijd_id)
        .order("rit_nummer", { ascending: true });

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

    const scoreboard = spelersData.map((spelerEntry) => {
        const spelerId = spelerEntry.id;
        const spelerNaam = spelerEntry.gebruikers?.naam || "Onbekend";

        const per_rit = (ritten || []).map((rit) => {
            const resultatenVanRit = ritresultaten.filter(
                (resultaat) =>
                    Number(resultaat.rit_id) === Number(rit.id) &&
                    isRennerActiefVoorRit(spelerId, resultaat.renner_id, rit.rit_nummer)
            );

            const rit_punten = resultatenVanRit.reduce((som, resultaat) => {
                const ritPunten = Number(resultaat.rit_punten || 0);
                const punten = Number(resultaat.punten || 0);

                return som + (ritPunten > 0 ? ritPunten : punten);
            }, 0);

            const truien_punten = resultatenVanRit.reduce((som, resultaat) => {
                const truienPunten = Number(resultaat.truien_punten || 0);
                const truiPunten = Number(resultaat.trui_punten || 0);

                return som + (truienPunten > 0 ? truienPunten : truiPunten);
            }, 0);

            return {
                rit_id: rit.id,
                rit_nummer: rit.rit_nummer,
                naam: rit.naam,
                gescrapet: rit.gescrapet,
                rit_punten,
                truien_punten,
                punten: rit_punten + truien_punten,
            };
        });

        const totaal = per_rit.reduce((som, rit) => som + rit.punten, 0);

        return {
            speler_id: spelerId,
            speler: spelerNaam,
            totaal,
            per_rit,
        };
    });

    scoreboard.sort((a, b) => b.totaal - a.totaal);

    return scoreboard;
}

router.get("/competitie/:competitieId", async (req, res) => {
    const { competitieId } = req.params;

    try {
        const { data: sessie, error: sessieError } = await supabase
            .from("draft_sessies")
            .select(`
                id,
                competitie_id,
                wedstrijd_id,
                Naam,
                is_actief,
                wedstrijden (
                    id,
                    naam,
                    jaar,
                    slug
                )
            `)
            .eq("competitie_id", competitieId)
            .eq("is_actief", true)
            .single();

        if (sessieError || !sessie) {
            return res.status(404).json({
                error: "Geen actieve draftsessie gevonden voor deze competitie.",
            });
        }

        const scoreboard = await maakScoreboardVoorSessie(sessie);

        res.json({
            sessieId: sessie.id,
            sessieNaam: sessie.Naam,
            wedstrijd: sessie.wedstrijden,
            scoreboard,
        });
    } catch (error) {
        console.error("Fout bij ophalen scores:", error);
        res.status(500).json({
            error: "Kon scores niet ophalen",
            details: error.message,
        });
    }
});

module.exports = router;