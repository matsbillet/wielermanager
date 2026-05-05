const express = require("express");
const jwt = require("jsonwebtoken");
const { supabase } = require("../db/supabase");

const router = express.Router();

function haalGebruikerUitToken(req) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
        throw new Error("Geen token meegegeven.");
    }

    return jwt.verify(token, process.env.JWT_SECRET);
}

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

async function berekenScoreVoorSpeler(sessie, spelerId) {
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

    const ritIds = (ritten || []).map((rit) => rit.id);

    if (ritIds.length === 0) return 0;

    const { data: ritresultaten, error: resultatenError } = await supabase
        .from("ritresultaten")
        .select("rit_id, renner_id, punten, rit_punten, trui_punten, truien_punten")
        .in("rit_id", ritIds);

    if (resultatenError) throw resultatenError;

    const actieveRennerIds = draft
        .filter(
            (keuze) =>
                Number(keuze.speler_id) === Number(spelerId) &&
                keuze.is_bank === false
        )
        .map((keuze) => Number(keuze.renner_id));

    return (ritresultaten || [])
        .filter((resultaat) => actieveRennerIds.includes(Number(resultaat.renner_id)))
        .reduce((som, resultaat) => {
            return som + berekenRitPunten(resultaat) + berekenTruienPunten(resultaat);
        }, 0);
}

router.get("/me", async (req, res) => {
    try {
        const gebruiker = haalGebruikerUitToken(req);

        const { data: mijnSpelers, error: spelersError } = await supabase
            .from("spelers")
            .select("id, competitie_id")
            .eq("gebruiker_id", gebruiker.id);

        if (spelersError) throw spelersError;

        if (!mijnSpelers || mijnSpelers.length === 0) {
            return res.json({
                naam: gebruiker.naam,
                totaalPunten: 0,
                positie: "-",
                actieveRaces: 0,
            });
        }

        const competitieIds = mijnSpelers.map((speler) => speler.competitie_id);

        const { data: actieveSessies, error: sessiesError } = await supabase
            .from("draft_sessies")
            .select("id, competitie_id, wedstrijd_id")
            .in("competitie_id", competitieIds)
            .eq("is_actief", true);

        if (sessiesError) throw sessiesError;

        let totaalPunten = 0;
        let positie = "-";

        if (actieveSessies && actieveSessies.length > 0) {
            const sessie = actieveSessies[0];

            const { data: alleSpelers, error: alleSpelersError } = await supabase
                .from("spelers")
                .select("id, gebruiker_id")
                .eq("competitie_id", sessie.competitie_id);

            if (alleSpelersError) throw alleSpelersError;

            const scores = [];

            for (const speler of alleSpelers) {
                const score = await berekenScoreVoorSpeler(sessie, speler.id);

                scores.push({
                    spelerId: speler.id,
                    gebruikerId: speler.gebruiker_id,
                    score,
                });

                if (Number(speler.gebruiker_id) === Number(gebruiker.id)) {
                    totaalPunten = score;
                }
            }

            scores.sort((a, b) => b.score - a.score);

            const mijnIndex = scores.findIndex(
                (score) => Number(score.gebruikerId) === Number(gebruiker.id)
            );

            positie = mijnIndex >= 0 ? `${mijnIndex + 1}e` : "-";
        }

        res.json({
            naam: gebruiker.naam,
            totaalPunten,
            positie,
            actieveRaces: actieveSessies?.length || 0,
        });
    } catch (error) {
        console.error("Dashboard stats fout:", error);
        res.status(500).json({
            error: "Kon dashboard stats niet ophalen.",
            details: error.message,
        });
    }
});

module.exports = router;