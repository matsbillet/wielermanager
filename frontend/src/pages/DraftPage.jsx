import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getBeschikbareRenners,
    getSpelers,
    kiesRenner,
    getTeams,
    getActieveSpeler,
    getSessieVoorCompetitie,
    getDraftSessiesVoorCompetitie,
    vulDraftAutomatisch,
} from "../services/api";
import { useRealtimeDraft } from "../hooks/useRealtimeDraft";

const MAX_RENNERS_PER_SPELER = 18;

function normaliseer(text = "") {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ø/g, "o")
        .replace(/æ/g, "ae")
        .replace(/œ/g, "oe")
        .replace(/ß/g, "ss")
        .replace(/đ/g, "d")
        .replace(/ł/g, "l");
}

export default function DraftPage() {
    const { competitieId } = useParams();

    const [riders, setRiders] = useState([]);
    const [spelers, setSpelers] = useState([]);
    const [ladenPagina, setLadenPagina] = useState(true);
    const [loading, setLoading] = useState(false);
    const [melding, setMelding] = useState("");
    const [zoekTerm, setZoekTerm] = useState("");

    const [actieveSpelerIndex, setActieveSpelerIndex] = useState(0);
    const [draftKlaar, setDraftKlaar] = useState(false);
    const [gekozenTeller, setGekozenTeller] = useState({});
    const [teams, setTeams] = useState({});
    const [sessieId, setSessieId] = useState(null);
    const [wedstrijdNaam, setWedstrijdNaam] = useState("");
    const [draftSessies, setDraftSessies] = useState([]);
    const [actieveSessieId, setActieveSessieId] = useState(null);
    const [bekekenSessie, setBekekenSessie] = useState(null);

    async function laadDraftData() {
        try {
            setLadenPagina(true);
            setMelding("");

            const [sessiesResponse, actieveSessieResponse] = await Promise.all([
                getDraftSessiesVoorCompetitie(competitieId),
                getSessieVoorCompetitie(competitieId),
            ]);

            const sessies = Array.isArray(sessiesResponse.data)
                ? sessiesResponse.data
                : [];

            const actieveSessie = actieveSessieResponse.data;

            setDraftSessies(sessies);
            setActieveSessieId(actieveSessie.id);

            await laadSessieData(actieveSessie);
        } catch (err) {
            console.error("Fout bij ophalen draft data:", err);
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                "Kon draft data niet laden.",
            );
        } finally {
            setLadenPagina(false);
        }
    }

    async function laadSessieData(sessie) {
        const gekozenSessieId = sessie.id;

        setBekekenSessie(sessie);
        setSessieId(gekozenSessieId);

        setWedstrijdNaam(
            sessie.wedstrijden?.naam || "Onbekende koers"
        );

        const [rennersResponse, spelersResponse, teamsResponse, actieveSpelerResponse] =
            await Promise.all([
                getBeschikbareRenners(gekozenSessieId),
                getSpelers(gekozenSessieId),
                getTeams(gekozenSessieId),
                getActieveSpeler(gekozenSessieId),
            ]);

        const rennersData = Array.isArray(rennersResponse.data)
            ? rennersResponse.data
            : [];

        const spelersData = Array.isArray(spelersResponse.data)
            ? spelersResponse.data
            : [];

        const teamsData = teamsResponse.data || {};

        setRiders(rennersData);
        setSpelers(spelersData);
        setTeams(teamsData);

        const tellerInit = {};
        spelersData.forEach((speler) => {
            const spelerTeam = teamsData[speler.naam] || [];
            tellerInit[speler.id] = spelerTeam.length;
        });

        setGekozenTeller(tellerInit);

        if (actieveSpelerResponse.data.klaar) {
            setDraftKlaar(true);
        } else {
            setDraftKlaar(false);

            const actieveIndex = spelersData.findIndex(
                (speler) => speler.id === actieveSpelerResponse.data.spelerId,
            );

            if (actieveIndex >= 0) {
                setActieveSpelerIndex(actieveIndex);
            }
        }
    }

    async function handleSelectSessie(event) {
        const gekozenId = Number(event.target.value);
        const sessie = draftSessies.find((s) => Number(s.id) === gekozenId);

        if (!sessie) return;

        try {
            setLoading(true);
            setMelding("");
            await laadSessieData(sessie);
        } catch (err) {
            console.error("Fout bij wisselen van sessie:", err);
            setMelding("Kon deze draftsessie niet laden.");
        } finally {
            setLoading(false);
        }
    }

    async function refreshDraftData() {
        if (!sessieId) return;

        try {
            const [rennersResponse, teamsResponse, actieveSpelerResponse] =
                await Promise.all([
                    getBeschikbareRenners(sessieId),
                    getTeams(sessieId),
                    getActieveSpeler(sessieId),
                ]);

            setRiders(Array.isArray(rennersResponse.data) ? rennersResponse.data : []);

            const teamsData = teamsResponse.data || {};
            setTeams(teamsData);

            const nieuweTeller = {};
            spelers.forEach((speler) => {
                const spelerTeam = teamsData[speler.naam] || [];
                nieuweTeller[speler.id] = spelerTeam.length;
            });

            setGekozenTeller(nieuweTeller);

            if (actieveSpelerResponse.data.klaar) {
                setDraftKlaar(true);
            } else {
                setDraftKlaar(false);

                const nextIndex = spelers.findIndex(
                    (speler) => speler.id === actieveSpelerResponse.data.spelerId,
                );

                if (nextIndex >= 0) {
                    setActieveSpelerIndex(nextIndex);
                }
            }
        } catch (err) {
            console.error("Fout bij vernieuwen draft data:", err);
        }
    }

    useEffect(() => {
        if (competitieId) {
            laadDraftData();
        }
    }, [competitieId]);

    useRealtimeDraft(
        async () => {
            setTimeout(() => {
                refreshDraftData();
            }, 500);
        },
        async () => {
            refreshDraftData();
        },
    );

    const actieveSpeler = spelers[actieveSpelerIndex] || null;

    const isActieveBekekenSessie =
        bekekenSessie && Number(bekekenSessie.id) === Number(actieveSessieId);
    const gefilterdeRenners = useMemo(() => {
        const term = normaliseer(zoekTerm.trim());

        if (!term) return riders;

        return riders.filter((rider) => {
            const naam = normaliseer(rider.naam);
            return naam.includes(term);
        });
    }, [riders, zoekTerm]);

    const alleSpelersKlaar = useMemo(() => {
        if (spelers.length === 0) return false;

        return spelers.every(
            (speler) => (gekozenTeller[speler.id] || 0) >= MAX_RENNERS_PER_SPELER,
        );
    }, [spelers, gekozenTeller]);

    const beurtVoorActieveSpeler = actieveSpeler
        ? (gekozenTeller[actieveSpeler.id] || 0) + 1
        : 1;

    useEffect(() => {
        if (alleSpelersKlaar && !draftKlaar) {
            setDraftKlaar(true);
            setMelding("Draft is gedaan, iedereen heeft 18 renners gekozen.");
        }
    }, [alleSpelersKlaar, draftKlaar]);

    async function handleKiesRenner(rennerId, naam) {
        if (!isActieveBekekenSessie || !actieveSpeler || draftKlaar || !sessieId) return;

        try {
            setLoading(true);
            setMelding("");

            setRiders((vorigeRiders) =>
                vorigeRiders.filter((rider) => rider.id !== rennerId),
            );

            await kiesRenner({
                sessieId: Number(sessieId),
                rennerId,
            });

            setMelding(`${naam} gekozen door ${actieveSpeler.naam}.`);

            await refreshDraftData();
        } catch (err) {
            await refreshDraftData();

            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                "Fout bij kiezen van renner.",
            );

            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAutoVulDraft() {
        if (!sessieId || draftKlaar) return;

        const zeker = window.confirm(
            "Weet je zeker dat je de rest van de draft automatisch wil vullen?"
        );

        if (!zeker) return;

        try {
            setLoading(true);
            setMelding("");

            const response = await vulDraftAutomatisch(Number(sessieId));

            setMelding(`${response.data.aantalToegevoegd} renners automatisch toegevoegd.`);

            await refreshDraftData();
        } catch (err) {
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                "Automatisch vullen mislukt."
            );
        } finally {
            setLoading(false);
        }
    }

    if (ladenPagina) {
        return <div>Laden van draft data...</div>;
    }

    return (
        <div>
            <div className="draft-page-header">
                <div>
                    <h1>Live Draft Board</h1>
                    <p className="small-muted">
                        Bekeken koers: <strong>{wedstrijdNaam}</strong>
                    </p>

                    <select
                        className="draft-session-select"
                        value={sessieId || ""}
                        onChange={handleSelectSessie}
                        disabled={loading}
                    >
                        {draftSessies.map((sessie) => (
                            <option key={sessie.id} value={sessie.id}>
                                {sessie.is_actief ? "Actief · " : ""}
                                {sessie.wedstrijden?.naam || "Onbekende koers"}
                            </option>
                        ))}
                    </select>

                    {!isActieveBekekenSessie && (
                        <p className="small-muted">
                            Historische draft: alleen bekijken, niet aanpassen.
                        </p>
                    )}
                </div>
            </div>

            <section className="draft-overview">
                {spelers.map((speler, index) => {
                    const gekozen = gekozenTeller[speler.id] || 0;
                    const isActief = !draftKlaar && index === actieveSpelerIndex;
                    const isKlaar = gekozen >= MAX_RENNERS_PER_SPELER;
                    const spelerTeam = teams[speler.naam] || [];
                    const volgendeBeurtNummer = Math.min(
                        gekozen + 1,
                        MAX_RENNERS_PER_SPELER,
                    );
                    const pct = Math.round((gekozen / MAX_RENNERS_PER_SPELER) * 100);

                    return (
                        <div
                            key={speler.id}
                            className={`draft-player-card ${isActief ? "draft-player-card-active" : ""
                                }`}
                        >
                            <div className="draft-player-header">
                                <div className="draft-player-title-row">
                                    <span className="draft-player-name">{speler.naam}</span>

                                    {isActief && (
                                        <span className="draft-status draft-status-active">
                                            <span className="draft-status-dot" />
                                            Picking now
                                        </span>
                                    )}

                                    {!isActief && !isKlaar && (
                                        <span className="draft-status draft-status-waiting">
                                            Waiting
                                        </span>
                                    )}

                                    {isKlaar && (
                                        <span className="draft-status draft-status-done">
                                            Klaar
                                        </span>
                                    )}
                                </div>

                                <div className="draft-player-info-row">
                                    <span>
                                        {gekozen} / {MAX_RENNERS_PER_SPELER} renners
                                    </span>

                                    {!draftKlaar && !isKlaar && (
                                        <span>Next: R{volgendeBeurtNummer}</span>
                                    )}
                                </div>
                            </div>

                            <div className="draft-progress-bar">
                                <div
                                    className="draft-progress-fill"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>

                            <div className="draft-team-section-title">Basis (R1–12)</div>

                            <ul className="draft-team-list">
                                {spelerTeam
                                    .filter((renner) => !renner.isBank)
                                    .map((renner, i) => (
                                        <li key={i} className="draft-team-list-item">
                                            <span>{renner.renner}</span>
                                            <span>R{renner.ronde}</span>
                                        </li>
                                    ))}
                            </ul>

                            <div className="draft-team-section-title">De bank (R13–18)</div>

                            <ul className="draft-team-list draft-bank-list">
                                {spelerTeam
                                    .filter((renner) => renner.isBank)
                                    .map((renner, i) => (
                                        <li key={i} className="draft-team-list-item">
                                            <span>{renner.renner}</span>
                                            <span>R{renner.ronde}</span>
                                        </li>
                                    ))}

                                {spelerTeam.filter((renner) => renner.isBank).length === 0 && (
                                    <li className="draft-empty-bank">—</li>
                                )}
                            </ul>
                        </div>
                    );
                })}
            </section>

            <section className="turn-banner">
                <div>
                    <div className="rider-name">
                        {draftKlaar
                            ? "Draft voltooid"
                            : `${actieveSpeler?.naam || "Speler"} is aan de beurt`}
                    </div>
                    <p>
                        {draftKlaar
                            ? "Iedereen heeft 18 renners gekozen."
                            : `Beurt ${beurtVoorActieveSpeler} - Selecteer een renner voor ${actieveSpeler?.naam || "de actieve speler"
                            }`}
                    </p>
                </div>

                <button className="pill-btn" disabled>
                    {loading ? "Bezig..." : draftKlaar ? "Draft klaar" : "Draft actief"}
                </button>

                <button
                    className="pill-btn"
                    onClick={handleAutoVulDraft}
                    disabled={loading || draftKlaar || !sessieId}
                >
                    Auto vul draft
                </button>
            </section>

            {melding && <div className="draft-message">{melding}</div>}

            <div className="section-head">
                <h2>
                    Available Riders ({gefilterdeRenners.length}/{riders.length})
                </h2>
            </div>

            <div className="draft-search-row">
                <input
                    className="draft-search-input"
                    type="search"
                    value={zoekTerm}
                    onChange={(event) => setZoekTerm(event.target.value)}
                    placeholder="Zoek renner op naam..."
                />

                {zoekTerm && (
                    <button className="pill-btn" onClick={() => setZoekTerm("")}>
                        Wis
                    </button>
                )}
            </div>

            {gefilterdeRenners.length === 0 && (
                <div className="draft-no-results">
                    Geen beschikbare renners gevonden voor “{zoekTerm}”.
                </div>
            )}

            <section className="riders-grid">
                {gefilterdeRenners.map((rider) => (
                    <article key={rider.id} className="rider-card card">


                        <div className="rider-body">
                            <div className="rider-topline">
                                <div className="rider-name">{rider.naam}</div>
                            </div>

                            <div className="rider-action-row">
                                <button
                                    className="pill-btn"
                                    onClick={() => handleKiesRenner(rider.id, rider.naam)}
                                    disabled={loading || draftKlaar || !actieveSpeler || !isActieveBekekenSessie}
                                >
                                    {isActieveBekekenSessie ? (loading ? "Bezig..." : "Kies") : "Alleen bekijken"}
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}
