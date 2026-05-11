import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getTeamVanSpeler,
    getBeschikbareRenners,
    vervangRennerVoorStart,
    blessureWissel,
    getSessieVoorCompetitie,
} from "../services/api";

// 1. Importeer de Countdown component
import CountdownTimer from "../components/CountdownTimer";

export default function TeamDetailPage() {
    const { sessieId, spelerId } = useParams();
    const navigate = useNavigate();

    const [team, setTeam] = useState([]);
    const [beschikbareRenners, setBeschikbareRenners] = useState([]);
    const [rennerUitId, setRennerUitId] = useState("");
    const [rennerInId, setRennerInId] = useState("");
    const [ritNummer, setRitNummer] = useState("");
    const [typeWissel, setTypeWissel] = useState("voor_start");
    const [melding, setMelding] = useState("");
    const [loading, setLoading] = useState(true);

    // 3. Nieuwe state voor de deadlines
    const [deadlines, setDeadlines] = useState(null);
    async function laadData() {
        try {
            setLoading(true);

            // FORCEER DE COMPETITIE HIER OOK OP 1:
            const [teamResponse, rennersResponse, sessieResponse] = await Promise.all([
                getTeamVanSpeler(sessieId, spelerId),
                getBeschikbareRenners(sessieId),
                getSessieVoorCompetitie(1) // Altijd competitie 1
            ]);

            setTeam(teamResponse.data || []);
            setBeschikbareRenners(rennersResponse.data || []);

            const wId = sessieResponse.data.wedstrijd_id || sessieResponse.data.wedstrijden?.id;

            console.log("Dashboard zoekt uitvallers voor Wedstrijd ID:", wId);

            if (wId) {
                const dlResponse = await fetch(`http://localhost:3000/api/ritten/deadlines/${wId}`);
                const dlData = await dlResponse.json();
                setDeadlines(dlData);
            }

        } catch (err) {
            console.error(err);
            setMelding("Kon team niet laden.");
        } finally {
            setLoading(false);
        }
    }

    const gebruiker = JSON.parse(localStorage.getItem("gebruiker"));

    const teamEigenaarId = team?.[0]?.gebruikerId;

    const magWisselen =
        gebruiker?.is_admin ||
        Number(gebruiker?.id) === Number(teamEigenaarId);

    // 4. Extra useEffect om de deadlines op te halen
    useEffect(() => {
        laadData();
    }, [sessieId, spelerId]);

    const actieveRenners = useMemo(
        () => team.filter((renner) => !renner.isBank),
        [team]
    );

    const bankRenners = useMemo(
        () => team.filter((renner) => renner.isBank),
        [team]
    );

    async function handleWissel(e) {
        e.preventDefault();
        setMelding("");

        if (!rennerUitId || !rennerInId) {
            setMelding("Kies een renner uit en een renner in.");
            return;
        }

        try {
            if (typeWissel === "voor_start") {
                await vervangRennerVoorStart({
                    sessie_id: Number(sessieId),
                    speler_id: Number(spelerId),
                    renner_uit_id: Number(rennerUitId),
                    renner_in_id: Number(rennerInId),
                });

                setMelding("Renner vervangen voor de start.");
            }

            if (typeWissel === "blessure") {
                if (!ritNummer) {
                    setMelding("Vul de rit in waarna de renner uitvalt.");
                    return;
                }

                await blessureWissel({
                    sessie_id: Number(sessieId),
                    speler_id: Number(spelerId),
                    renner_uit_id: Number(rennerUitId),
                    renner_in_id: Number(rennerInId),
                    rit_nummer: Number(ritNummer),
                });

                setMelding(`Blessurewissel uitgevoerd vanaf rit ${Number(ritNummer) + 1}.`);
            }

            setRennerUitId("");
            setRennerInId("");
            setRitNummer("");
            await laadData();
        } catch (err) {
            console.error(err);
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                "Wissel mislukt."
            );
        }
    }

    if (loading) return <div>Team laden...</div>;


    return (
        <div className="team-detail-page">
            <button
                className="logout-btn"
                onClick={() => navigate("/teams/1")}
                style={{ marginBottom: "1rem" }}
            >
                ← Ga terug
            </button>
            <section className="section-head">
                <div>
                    <h1>Team beheren</h1>
                    <p>Bekijk actieve renners, bankrenners en voer wissels uit.</p>
                </div>
            </section>


            {/* 5. PLAATS DE TIMERS HIER, NET ONDER DE HEADER */}
            {deadlines && (
                <div className="card" style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap', padding: '1.5rem' }}>
                    <div style={{ flex: '1', minWidth: '250px' }}>
                        <CountdownTimer
                            customTargetDate={deadlines.groteStart} // Kan undefined zijn, timer vangt dit op
                            customTitel="Deadline Basisteam"
                            customSubTitel="Start van Rit 1"
                        />
                    </div>

                    <div style={{ flex: '1', minWidth: '250px', borderLeft: '1px solid #334155', paddingLeft: '20px' }}>
                        <CountdownTimer
                            customTargetDate={deadlines.volgendeRit?.starttijd} // Let op het vraagteken (?) voor starttijd! Kan undefined zijn.
                            customTitel="Deadline Wissel"
                            customSubTitel={deadlines.volgendeRit?.naam} // En hier ook een vraagteken.
                        />
                    </div>
                </div>
            )}

            {melding && <p className="form-message">{melding}</p>}

            <section className="team-columns">
                <div className="card">
                    <h2>Actief team</h2>
                    {actieveRenners.map((renner) => {
                        // Bepaal of de renner uitgevallen is
                        const isUitgevallen = renner.status && renner.status !== "active";

                        return (
                            <div key={renner.draftId} className="team-row">
                                <strong style={{ color: isUitgevallen ? "#ef4444" : "inherit" }}>
                                    {renner.naam} {isUitgevallen && `🚑 (${renner.status})`}
                                </strong>
                                <span>{renner.ploeg}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="card">
                    <h2>Bank</h2>
                    {bankRenners.map((renner) => {
                        // Bepaal of de renner uitgevallen is
                        const isUitgevallen = renner.status && renner.status !== "active";

                        return (
                            <div key={renner.draftId} className="team-row bank">
                                <strong style={{ color: isUitgevallen ? "#ef4444" : "inherit" }}>
                                    {renner.naam} {isUitgevallen && `🚑 (${renner.status})`}
                                </strong>
                                <span>{renner.ploeg}</span>
                            </div>
                        );
                    })}
                </div>
            </section>

            {magWisselen && (
                <section className="card wissel-card">
                    {/* De rest van je wissel formulier blijft ongewijzigd */}
                    <h2>Wissel uitvoeren</h2>

                    <form onSubmit={handleWissel} className="wissel-form">
                        <label>
                            Type wissel
                            <select
                                value={typeWissel}
                                onChange={(e) => {
                                    setTypeWissel(e.target.value);
                                    setRennerUitId("");
                                    setRennerInId("");
                                }}
                            >
                                <option value="voor_start">Vervanging voor start</option>
                                <option value="blessure">Blessure na rit</option>
                            </select>
                        </label>

                        <label>
                            Renner uit
                            <select
                                value={rennerUitId}
                                onChange={(e) => setRennerUitId(e.target.value)}
                            >
                                <option value="">Kies renner</option>
                                {actieveRenners.map((renner) => (
                                    <option key={renner.rennerId} value={renner.rennerId}>
                                        {renner.naam}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Renner in
                            <select
                                value={rennerInId}
                                onChange={(e) => setRennerInId(e.target.value)}
                            >
                                <option value="">Kies renner</option>

                                {typeWissel === "voor_start" &&
                                    beschikbareRenners.map((renner) => (
                                        <option key={renner.id} value={renner.id}>
                                            {renner.naam}
                                        </option>
                                    ))}

                                {typeWissel === "blessure" &&
                                    bankRenners.map((renner) => (
                                        <option key={renner.rennerId} value={renner.rennerId}>
                                            {renner.naam}
                                        </option>
                                    ))}
                            </select>
                        </label>

                        {typeWissel === "blessure" && (
                            <label>
                                Uitgevallen na rit
                                <input
                                    type="number"
                                    min="1"
                                    value={ritNummer}
                                    onChange={(e) => setRitNummer(e.target.value)}
                                    placeholder="Bijvoorbeeld 2"
                                />
                            </label>
                        )}

                        <button type="submit" className="btn-primary">
                            Wissel uitvoeren
                        </button>
                    </form>
                </section>
            )}
        </div>
    );
}

