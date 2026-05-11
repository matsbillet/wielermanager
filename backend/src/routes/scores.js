const express = require("express");
const router = express.Router();
const { supabase } = require("../db/supabase");

function berekenRitPunten(resultaat) {
    const ritPunten = Number(resultaat.rit_punten || 0);
    const punten = Number(resultaat.punten || 0);
    return ritPunten > 0 ? ritPunten : punten;
}

function berekenTruienPunten(resultaat) {
    const truienPunten = Number(resultaat.truien_punten || 0);
    const truiPunten = Number(resultaat.trui_punten || 0);
    return truienPunten > 0 ? truienPunten : truiPunten;
}

async function maakScoreboardVoorSessie(sessie) {
    const { data: spelersData, error: spelersError } = await supabase
        .from("spelers")
        .select("id, gebruiker_id, competitie_id, gebruikers(id, naam)")
        .eq("competitie_id", sessie.competitie_id)
        .order("id", { ascending: true });

    if (spelersError) throw spelersError;

    const { data: ritten, error: rittenError } = await supabase
        .from("ritten")
        .select("id, rit_nummer, naam, gescrapet, leider_algemeen, leider_punten, leider_berg, leider_jongeren")
        .eq("wedstrijd_id", sessie.wedstrijd_id)
        .order("rit_nummer", { ascending: true });

    if (rittenError) throw rittenError;

    const { data: draft, error: draftError } = await supabase
        .from("draft")
        .select(`
            speler_id,
            renner_id,
            is_bank,
            renners(id, naam),
            spelers(id, gebruikers(id, naam))
        `)
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
            .select("rit_id, renner_id, punten, rit_punten, truien_punten, trui_punten, renners(id, naam)")
            .in("rit_id", ritIds);

        if (error) throw error;

        ritresultaten = data || [];
    }

    function isRennerActiefVoorRit(spelerId, rennerId, ritNummer) {
        const statussenVoorDezeRenner = teamStatus.filter(
            (status) =>
                Number(status.speler_id) === Number(spelerId) &&
                Number(status.renner_id) === Number(rennerId)
        );

        if (statussenVoorDezeRenner.length === 0) {
            return draft.some(
                (keuze) =>
                    Number(keuze.speler_id) === Number(spelerId) &&
                    Number(keuze.renner_id) === Number(rennerId) &&
                    keuze.is_bank === false
            );
        }

        return statussenVoorDezeRenner.some(
            (status) =>
                status.status === "actief" &&
                Number(status.actief_vanaf_rit) <= Number(ritNummer) &&
                (
                    status.actief_tot_rit === null ||
                    Number(status.actief_tot_rit) >= Number(ritNummer)
                )
        );
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
                return som + berekenRitPunten(resultaat);
            }, 0);

            const truien_punten = resultatenVanRit.reduce((som, resultaat) => {
                return som + berekenTruienPunten(resultaat);
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

    const eigenaarPerRenner = new Map();

    draft.forEach((keuze) => {
        eigenaarPerRenner.set(Number(keuze.renner_id), {
            speler: keuze.spelers?.gebruikers?.naam || "Niet gekozen",
            isBank: keuze.is_bank,
        });
    });

    const rennerScores = new Map();

    ritresultaten.forEach((resultaat) => {
        const rit = ritten.find((r) => Number(r.id) === Number(resultaat.rit_id));

        if (!rit || !rit.gescrapet) return;

        const rennerId = Number(resultaat.renner_id);
        const bestaande = rennerScores.get(rennerId) || {
            renner_id: rennerId,
            renner: resultaat.renners?.naam || "Onbekende renner",
            totaal: 0,
            rit_punten: 0,
            truien_punten: 0,
            eigenaar: eigenaarPerRenner.get(rennerId)?.speler || "Niet gekozen",
            isBank: eigenaarPerRenner.get(rennerId)?.isBank || false,
        };

        const ritPunten = berekenRitPunten(resultaat);
        const truienPunten = berekenTruienPunten(resultaat);

        bestaande.rit_punten += ritPunten;
        bestaande.truien_punten += truienPunten;
        bestaande.totaal += ritPunten + truienPunten;

        rennerScores.set(rennerId, bestaande);
    });

    const topRenners = Array.from(rennerScores.values())
        .sort((a, b) => b.totaal - a.totaal)
        .slice(0, 10);

    const laatsteGescrapeteRit = [...(ritten || [])]
        .filter((rit) => rit.gescrapet)
        .sort((a, b) => Number(b.rit_nummer) - Number(a.rit_nummer))[0];

    const truien = laatsteGescrapeteRit
        ? {
            rit_nummer: laatsteGescrapeteRit.rit_nummer,
            algemeen: laatsteGescrapeteRit.leider_algemeen || "-",
            punten: laatsteGescrapeteRit.leider_punten || "-",
            berg: laatsteGescrapeteRit.leider_berg || "-",
            jongeren: laatsteGescrapeteRit.leider_jongeren || "-",
            wedstrijdNaam: sessie.wedstrijden?.naam || "",
        }
        : {
            rit_nummer: null,
            algemeen: "-",
            punten: "-",
            berg: "-",
            jongeren: "-",
        };

    return {
        scoreboard,
        topRenners,
        truien,
    };
}

router.get("/sessie/:sessieId", async (req, res) => {
    const { sessieId } = req.params;

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
            .eq("id", sessieId)
            .single();

        if (sessieError || !sessie) {
            return res.status(404).json({
                error: "Draftsessie niet gevonden.",
            });
        }

        const resultaat = await maakScoreboardVoorSessie(sessie);

        res.json({
            sessieId: sessie.id,
            sessieNaam: sessie.Naam,
            isActief: sessie.is_actief,
            wedstrijd: sessie.wedstrijden,
            scoreboard: resultaat.scoreboard,
            topRenners: resultaat.topRenners,
            truien: resultaat.truien,
        });
    } catch (error) {
        console.error("Fout bij ophalen scores voor sessie:", error);
        res.status(500).json({
            error: "Kon scores voor sessie niet ophalen",
            details: error.message,
        });
    }
});

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

        const resultaat = await maakScoreboardVoorSessie(sessie);

        res.json({
            sessieId: sessie.id,
            sessieNaam: sessie.Naam,
            isActief: sessie.is_actief,
            wedstrijd: sessie.wedstrijden,
            scoreboard: resultaat.scoreboard,
            topRenners: resultaat.topRenners,
            truien: resultaat.truien,
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