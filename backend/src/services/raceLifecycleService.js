const { supabase } = require("../db/supabase");
const scraper = require("../scraper/scraper");

let lifecycleBezig = false;

async function isWedstrijdVolledigGescrapet(wedstrijdId) {
    const { data: ritten, error } = await supabase
        .from("ritten")
        .select("id, gescrapet")
        .eq("wedstrijd_id", wedstrijdId);

    if (error) throw error;

    if (!ritten || ritten.length === 0) return false;

    return ritten.every((rit) => rit.gescrapet === true);
}

async function getVolgendeWedstrijd(huidigeWedstrijd) {
    let query = supabase
        .from("wedstrijden")
        .select("*")
        .neq("id", huidigeWedstrijd.id)
        .not("pcs_url", "is", null)
        .order("start_datum", { ascending: true })
        .limit(1);

    if (huidigeWedstrijd.start_datum) {
        query = query.gt("start_datum", huidigeWedstrijd.start_datum);
    } else {
        query = query.gt("id", huidigeWedstrijd.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    return data || null;
}

async function syncStartlijstEnRitten(wedstrijd) {
    if (!wedstrijd?.pcs_url) {
        throw new Error("Wedstrijd heeft geen PCS URL.");
    }

    const raceData = await scraper.scrapeFullRaceInfo(wedstrijd.pcs_url);

    if (!raceData?.deelnemers || raceData.deelnemers.length === 0) {
        throw new Error("Startlijst nog niet beschikbaar.");
    }

    if (raceData.ritten?.length > 0) {
        const rittenRows = raceData.ritten.map((rit) => ({
            wedstrijd_id: wedstrijd.id,
            rit_nummer: rit.rit_nummer,
            naam: rit.naam,
        }));

        const { error: rittenError } = await supabase
            .from("ritten")
            .upsert(rittenRows, {
                onConflict: "wedstrijd_id,rit_nummer",
            });

        if (rittenError) throw rittenError;
    }

    const { data: opgeslagenRenners, error: rennersError } = await supabase
        .from("renners")
        .upsert(
            raceData.deelnemers.map((renner) => ({
                naam: renner.naam,
                slug: renner.slug,
                ploeg: renner.ploeg || null,
            })),
            { onConflict: "slug" }
        )
        .select("id, slug");

    if (rennersError) throw rennersError;

    const deelnemersRows = raceData.deelnemers
        .map((renner) => {
            const opgeslagenRenner = opgeslagenRenners.find(
                (item) => item.slug === renner.slug
            );

            if (!opgeslagenRenner) return null;

            return {
                wedstrijd_id: wedstrijd.id,
                renner_id: opgeslagenRenner.id,
                ploeg: renner.ploeg || null,
                status: "active",
            };
        })
        .filter(Boolean);

    const { error: deelnemersError } = await supabase
        .from("wedstrijd_deelnemers")
        .upsert(deelnemersRows, {
            onConflict: "wedstrijd_id,renner_id",
        });

    if (deelnemersError) throw deelnemersError;

    const { error: wedstrijdUpdateError } = await supabase
        .from("wedstrijden")
        .update({
            aantal_ritten: raceData.aantal_ritten || wedstrijd.aantal_ritten,
            start_datum: raceData.start_datum || wedstrijd.start_datum,
            eind_datum: raceData.eind_datum || wedstrijd.eind_datum,
            status: "upcoming",
        })
        .eq("id", wedstrijd.id);

    if (wedstrijdUpdateError) throw wedstrijdUpdateError;

    return {
        deelnemers: deelnemersRows.length,
        ritten: raceData.ritten?.length || 0,
    };
}

async function maakNieuweDraftSessie({ competitieId, wedstrijd }) {
    const { data: bestaandeSessie, error: bestaandeError } = await supabase
        .from("draft_sessies")
        .select("id")
        .eq("competitie_id", competitieId)
        .eq("wedstrijd_id", wedstrijd.id)
        .maybeSingle();

    if (bestaandeError) throw bestaandeError;

    if (bestaandeSessie) {
        const { error: updateError } = await supabase
            .from("draft_sessies")
            .update({ is_actief: true })
            .eq("id", bestaandeSessie.id);

        if (updateError) throw updateError;

        return bestaandeSessie;
    }

    const { data: nieuweSessie, error: insertError } = await supabase
        .from("draft_sessies")
        .insert({
            Naam: `${wedstrijd.naam} ${wedstrijd.jaar} Draft`,
            competitie_id: competitieId,
            wedstrijd_id: wedstrijd.id,
            is_actief: true,
        })
        .select()
        .single();

    if (insertError) throw insertError;

    return nieuweSessie;
}

async function verwerkRaceLifecycle() {
    if (lifecycleBezig) {
        return {
            success: false,
            message: "Lifecycle draait al.",
        };
    }

    lifecycleBezig = true;

    try {
        const { data: actieveSessies, error } = await supabase
            .from("draft_sessies")
            .select(`
                id,
                Naam,
                competitie_id,
                wedstrijd_id,
                is_actief,
                wedstrijden (
                    id,
                    naam,
                    jaar,
                    slug,
                    pcs_url,
                    start_datum,
                    status
                )
            `)
            .eq("is_actief", true);

        if (error) throw error;

        const resultaten = [];

        for (const sessie of actieveSessies || []) {
            const huidigeWedstrijd = sessie.wedstrijden;

            if (!huidigeWedstrijd) continue;

            const klaar = await isWedstrijdVolledigGescrapet(huidigeWedstrijd.id);

            if (!klaar) {
                resultaten.push({
                    sessieId: sessie.id,
                    actie: "geen_actie",
                    reden: "wedstrijd_nog_niet_klaar",
                });
                continue;
            }

            const volgendeWedstrijd = await getVolgendeWedstrijd(huidigeWedstrijd);

            if (!volgendeWedstrijd) {
                resultaten.push({
                    sessieId: sessie.id,
                    actie: "geen_actie",
                    reden: "geen_volgende_wedstrijd",
                });
                continue;
            }

            try {
                const syncResultaat = await syncStartlijstEnRitten(volgendeWedstrijd);

                await supabase
                    .from("wedstrijden")
                    .update({ status: "finished" })
                    .eq("id", huidigeWedstrijd.id);

                await supabase
                    .from("draft_sessies")
                    .update({ is_actief: false })
                    .eq("id", sessie.id);

                const nieuweSessie = await maakNieuweDraftSessie({
                    competitieId: sessie.competitie_id,
                    wedstrijd: volgendeWedstrijd,
                });

                resultaten.push({
                    oudeSessieId: sessie.id,
                    nieuweSessieId: nieuweSessie.id,
                    actie: "nieuwe_draft_aangemaakt",
                    vorigeWedstrijd: huidigeWedstrijd.naam,
                    nieuweWedstrijd: volgendeWedstrijd.naam,
                    deelnemers: syncResultaat.deelnemers,
                    ritten: syncResultaat.ritten,
                });
            } catch (syncError) {
                resultaten.push({
                    sessieId: sessie.id,
                    actie: "wachten",
                    reden: syncError.message,
                });
            }
        }

        return {
            success: true,
            resultaten,
        };
    } finally {
        lifecycleBezig = false;
    }
}

module.exports = {
    verwerkRaceLifecycle,
    syncStartlijstEnRitten,
};