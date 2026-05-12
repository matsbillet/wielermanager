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
    console.log(`\n=============================================================`);
    console.log(`▶️ START AUTOMATISCHE ROLLOVER VOOR: ${wedstrijd?.naam || 'Onbekend'} (ID: ${wedstrijd?.id})`);
    console.log(`=============================================================`);

    if (!wedstrijd?.pcs_url) {
        console.error("❌ FOUT: Wedstrijd heeft geen PCS URL.");
        throw new Error("Wedstrijd heeft geen PCS URL.");
    }

    const fullPcsUrl = wedstrijd.pcs_url.startsWith('http')
        ? wedstrijd.pcs_url
        : `https://www.procyclingstats.com/${wedstrijd.pcs_url.replace(/^\/+/, '')}`;

    console.log(`🔗 1. URL opgebouwd: ${fullPcsUrl}`);

    try {
        console.log(`🔎 2. Wedstrijdstructuur ophalen (datums en ritten)...`);
        const structuur = await scraper.scrapeWedstrijdStructuur(fullPcsUrl);
        console.log(`   ✅ Structuur succesvol!`);
        console.log(`      - Type: ${structuur.is_eendagskoers ? 'Eendagskoers' : 'Etappekoers'}`);
        console.log(`      - Aantal ritten: ${structuur.ritten?.length || 0}`);
        console.log(`      - Startdatum: ${structuur.startDate}`);
        console.log(`      - Einddatum: ${structuur.endDate}`);

        console.log(`💾 3. Wedstrijd updaten in de database met nieuwe datums...`);
        const { error: wedstrijdUpdateError } = await supabase
            .from("wedstrijden")
            .update({
                aantal_ritten: structuur.is_eendagskoers ? 1 : structuur.ritten.length,
                start_datum: structuur.startDate,
                eind_datum: structuur.endDate,
                status: "upcoming",
            })
            .eq("id", wedstrijd.id);

        if (wedstrijdUpdateError) {
            console.error(`   ❌ FOUT bij updaten wedstrijd:`, wedstrijdUpdateError.message);
            throw wedstrijdUpdateError;
        }
        console.log(`   ✅ Wedstrijd succesvol geüpdatet.`);

        let tijdUrl = structuur.is_eendagskoers
            ? (fullPcsUrl.endsWith('/') ? `${fullPcsUrl}result` : `${fullPcsUrl}/result`)
            : (fullPcsUrl.endsWith('/') ? `${fullPcsUrl}startlist` : `${fullPcsUrl}/startlist`);

        let gevondenTijd = "11:00";
        let deelnemersLijst = [];

        console.log(`⏱️ 4. Tijd en startlijst zoeken op: ${tijdUrl}`);
        try {
            const startResult = await scraper.importStartlist(tijdUrl, wedstrijd.id);
            if (startResult) {
                if (startResult.gevondenTijd) {
                    gevondenTijd = startResult.gevondenTijd;
                    console.log(`   ✅ Tijd gevonden op pagina: ${gevondenTijd}`);
                }
                if (startResult.deelnemers) {
                    deelnemersLijst = startResult.deelnemers;
                    console.log(`   ✅ ${deelnemersLijst.length} renners gevonden op startlijst.`);
                }
            } else {
                console.log(`   ⚠️ importStartlist gaf niets terug.`);
            }
        } catch (e) {
            console.warn(`   ⚠️ Waarschuwing: Startlijst/tijd ophalen mislukt (${e.message}). Fallback naar 11:00.`);
        }

        console.log(`🗺️ 5. Ritten voorbereiden voor database...`);
        const rittenRows = structuur.ritten.map((r) => {
            let ritDatum = structuur.startDate;

            if (r.datum && r.datum.includes('/')) {
                const [dag, maand] = r.datum.split('/');
                ritDatum = `${structuur.jaar}-${maand.padStart(2, '0')}-${dag.padStart(2, '0')}`;
            }

            const timestamp = `${ritDatum} ${gevondenTijd}:00`;
            return {
                wedstrijd_id: wedstrijd.id,
                rit_nummer: r.rit_nummer,
                naam: r.naam,
                starttijd: timestamp,
                gescrapet: false
            };
        });

        if (structuur.is_eendagskoers && rittenRows.length === 0) {
            rittenRows.push({
                wedstrijd_id: wedstrijd.id,
                rit_nummer: 1,
                naam: structuur.naam,
                starttijd: `${structuur.startDate} ${gevondenTijd}:00`,
                gescrapet: false
            });
        }

        console.log(`   ℹ️ ${rittenRows.length} ritten gegenereerd. Voorbeeld starttijd rit 1: ${rittenRows[0]?.starttijd}`);

        console.log(`💾 6. Ritten opslaan in database...`);
        if (rittenRows.length > 0) {
            const { error: rittenError } = await supabase
                .from("ritten")
                .upsert(rittenRows, { onConflict: "wedstrijd_id,rit_nummer" });

            if (rittenError) {
                console.error("   ❌ FOUT bij opslaan ritten in database:", rittenError.message);
                throw rittenError;
            }
            console.log(`   ✅ Ritten succesvol opgeslagen.`);
        } else {
            console.log(`   ⚠️ Geen ritten om op te slaan.`);
        }

        console.log(`🔗 7. Renners proberen te koppelen...`);
        let aantalGekoppeld = 0;
        if (deelnemersLijst && deelnemersLijst.length > 0) {
            try {
                const slugs = deelnemersLijst.map(r => r.slug);
                const { data: dbRenners, error: dbRennersError } = await supabase
                    .from('renners')
                    .select('id, slug')
                    .in('slug', slugs);

                if (dbRennersError) {
                    console.error("   ❌ FOUT bij ophalen renners uit DB:", dbRennersError.message);
                } else if (dbRenners) {
                    const deelnemersRows = dbRenners.map(renner => ({
                        wedstrijd_id: wedstrijd.id,
                        renner_id: renner.id,
                        status: "active"
                    }));

                    console.log(`   💾 ${deelnemersRows.length} renners koppelen in wedstrijd_deelnemers...`);
                    const { error: koppelError } = await supabase
                        .from('wedstrijd_deelnemers')
                        .upsert(deelnemersRows, { onConflict: 'wedstrijd_id,renner_id' });

                    if (koppelError) {
                        console.error("   ❌ FOUT bij opslaan wedstrijd_deelnemers:", koppelError.message);
                    } else {
                        aantalGekoppeld = deelnemersRows.length;
                        console.log(`   ✅ ${aantalGekoppeld} renners succesvol gekoppeld.`);
                    }
                }
            } catch (dbErr) {
                console.error("   ❌ CATCH FOUT tijdens renners koppelen:", dbErr.message);
            }
        } else {
            console.log(`   ℹ️ Geen deelnemers om te koppelen (startlijst was leeg).`);
        }

        console.log(`=============================================================`);
        console.log(`⏹️ EINDE AUTOMATISCHE ROLLOVER SUCCESVOL`);
        console.log(`=============================================================`);

        return {
            deelnemers: aantalGekoppeld,
            ritten: rittenRows.length,
        };

    } catch (hoofdFout) {
        console.error(`\n🚨 FATALE FOUT TIJDENS ROLLOVER:`, hoofdFout.message);
        console.error(hoofdFout.stack);
        console.log(`=============================================================`);
        throw hoofdFout;
    }
}

async function maakNieuweDraftSessie({
    competitieId,
    wedstrijd,
    aantalBasis = 12,
    aantalBank = 6,
}) {
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
            .update({
                is_actief: true,
                aantal_basis: Number(aantalBasis),
                aantal_bank: Number(aantalBank),
            })
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
            aantal_basis: Number(aantalBasis),
            aantal_bank: Number(aantalBank),
        })
        .select()
        .single();

    if (insertError) throw insertError;

    return nieuweSessie;
}

async function verwerkRaceLifecycle({
    dryRun = false,
    aantalBasis = 12,
    aantalBank = 6,
} = {}) {
    if (lifecycleBezig) {
        return {
            success: false,
            resultaten: [
                {
                    actie: "geen_actie",
                    reden: "Lifecycle draait al.",
                },
            ],
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
            .eq("is_actief", true)
            .order("created_at", { ascending: false });

        if (error) throw error;

        const sessiesPerCompetitie = new Map();

        for (const sessie of actieveSessies || []) {
            if (!sessiesPerCompetitie.has(sessie.competitie_id)) {
                sessiesPerCompetitie.set(sessie.competitie_id, sessie);
            }
        }

        const resultaten = [];

        for (const sessie of sessiesPerCompetitie.values()) {
            const huidigeWedstrijd = sessie.wedstrijden;

            if (!huidigeWedstrijd) {
                resultaten.push({
                    sessieId: sessie.id,
                    actie: "geen_actie",
                    reden: "Geen wedstrijd gekoppeld aan actieve sessie.",
                });
                continue;
            }

            const klaar = await isWedstrijdVolledigGescrapet(huidigeWedstrijd.id);

            if (!klaar) {
                resultaten.push({
                    sessieId: sessie.id,
                    competitieId: sessie.competitie_id,
                    actie: "geen_actie",
                    reden: `${huidigeWedstrijd.naam} is nog niet volledig gescrapet.`,
                });
                continue;
            }

            const volgendeWedstrijd = await getVolgendeWedstrijd(huidigeWedstrijd);

            if (!volgendeWedstrijd) {
                resultaten.push({
                    sessieId: sessie.id,
                    competitieId: sessie.competitie_id,
                    actie: "geen_actie",
                    reden: "Geen volgende wedstrijd gevonden.",
                });
                continue;
            }

            if (dryRun) {
                resultaten.push({
                    sessieId: sessie.id,
                    competitieId: sessie.competitie_id,
                    actie: "preview_volgende_koers",
                    vorigeWedstrijd: huidigeWedstrijd.naam,
                    vorigeJaar: huidigeWedstrijd.jaar,
                    nieuweWedstrijd: volgendeWedstrijd.naam,
                    nieuweJaar: volgendeWedstrijd.jaar,
                    nieuweStartDatum: volgendeWedstrijd.start_datum,
                });
                continue;
            }

            try {
                const syncResultaat = await syncStartlijstEnRitten(volgendeWedstrijd);

                const { error: wedstrijdFinishedError } = await supabase
                    .from("wedstrijden")
                    .update({ status: "finished" })
                    .eq("id", huidigeWedstrijd.id);

                if (wedstrijdFinishedError) throw wedstrijdFinishedError;

                const { error: sessiesUitError } = await supabase
                    .from("draft_sessies")
                    .update({ is_actief: false })
                    .eq("competitie_id", sessie.competitie_id);

                if (sessiesUitError) throw sessiesUitError;

                const nieuweSessie = await maakNieuweDraftSessie({
                    competitieId: sessie.competitie_id,
                    wedstrijd: volgendeWedstrijd,
                    aantalBasis,
                    aantalBank,
                });

                resultaten.push({
                    oudeSessieId: sessie.id,
                    nieuweSessieId: nieuweSessie.id,
                    competitieId: sessie.competitie_id,
                    actie: "nieuwe_draft_aangemaakt",
                    vorigeWedstrijd: huidigeWedstrijd.naam,
                    nieuweWedstrijd: volgendeWedstrijd.naam,
                    deelnemers: syncResultaat.deelnemers,
                    ritten: syncResultaat.ritten,
                });
            } catch (syncError) {
                resultaten.push({
                    sessieId: sessie.id,
                    competitieId: sessie.competitie_id,
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