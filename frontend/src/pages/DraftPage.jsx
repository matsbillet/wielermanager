import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getBeschikbareRenners,
    getSpelers,
    kiesRenner,
    getTeams,
    getActieveSpeler,
    getSessieVoorCompetitie,
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

    async function laadDraftData() {
        try {
            setLadenPagina(true);
            setMelding("");

            const sessieResponse = await getSessieVoorCompetitie(competitieId);

            setSessieId(sessieResponse.data.id);

            setWedstrijdNaam(
                `${sessieResponse.data.wedstrijden?.naam || "Onbekende koers"} ${sessieResponse.data.wedstrijden?.jaar || ""}`
            );
            const actieveSessieId = sessieResponse.data.id;
            setSessieId(actieveSessieId);

            const [rennersResponse, spelersResponse, teamsResponse, actieveSpelerResponse] =
                await Promise.all([
                    getBeschikbareRenners(actieveSessieId),
                    getSpelers(actieveSessieId),
                    getTeams(actieveSessieId),
                    getActieveSpeler(actieveSessieId),
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
        if (!actieveSpeler || draftKlaar || !sessieId) return;

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

    if (ladenPagina) {
        return <div>Laden van draft data...</div>;
    }

    return (
        <div>
            <div className="draft-page-header">
                <div>
                    <h1>Live Draft Board</h1>
                    <p className="small-muted">
                        Huidige koers: <strong>{wedstrijdNaam}</strong>
                    </p>
                </div>

                <span>Competitie #{competitieId}</span>
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
                                <div className="rider-country">{rider.ploeg || "-"}</div>
                            </div>

                            <div className="rider-action-row">
                                <button
                                    className="pill-btn"
                                    onClick={() => handleKiesRenner(rider.id, rider.naam)}
                                    disabled={loading || draftKlaar || !actieveSpeler}
                                >
                                    {loading ? "Bezig..." : `Kies ${rider.naam}`}
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </section>

            <div className="section-head teams-section-head">
                <h2>Gekozen Teams</h2>
            </div>

            <section className="teams-grid">
                {spelers.map((speler) => {
                    const spelerTeam = teams[speler.naam] || [];

                    return (
                        <div key={speler.id} className="card team-card">
                            <div className="team-card-header">Team {speler.naam}</div>

                            <div className="team-card-body">
                                <div className="team-section-title">Basis (R1-12)</div>

                                <ul className="team-list">
                                    {spelerTeam
                                        .filter((renner) => !renner.isBank)
                                        .map((renner, i) => (
                                            <li key={i} className="team-list-item">
                                                <span className="yellow">R{renner.ronde}</span>
                                                {renner.renner}
                                            </li>
                                        ))}
                                </ul>

                                <div className="team-section-title">De Bank (R13-18)</div>

                                <ul className="team-list">
                                    {spelerTeam
                                        .filter((renner) => renner.isBank)
                                        .map((renner, i) => (
                                            <li key={i} className="team-list-item team-list-item-bank">
                                                R{renner.ronde}: {renner.renner}
                                            </li>
                                        ))}
                                </ul>

                                {spelerTeam.length === 0 && (
                                    <div className="small-muted">Nog geen renners gekozen.</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}