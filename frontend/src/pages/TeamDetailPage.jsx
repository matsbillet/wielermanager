import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import {
    getTeamVanSpeler,
    getBeschikbareRenners,
    vervangRennerVoorStart,
    blessureWissel,
} from "../services/api";

// 1. Importeer de Countdown component
import CountdownTimer from "../components/CountdownTimer";

export default function TeamDetailPage() {
    const { sessieId, spelerId } = useParams();
    const location = useLocation(); // 2. Haal locatie op voor wedstrijdId

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
    const wedstrijdId = location.state?.wedstrijdId || 2; // Fallback naar 1 als er direct genavigeerd wordt

    async function laadData() {
        try {
            setLoading(true);

            const [teamResponse, rennersResponse] = await Promise.all([
                getTeamVanSpeler(sessieId, spelerId),
                getBeschikbareRenners(sessieId),
            ]);

            setTeam(teamResponse.data || []);
            setBeschikbareRenners(rennersResponse.data || []);
        } catch (err) {
            console.error(err);
            setMelding("Kon team niet laden.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        laadData();
    }, [sessieId, spelerId]);

    // 4. Extra useEffect om de deadlines op te halen
    useEffect(() => {
        if (wedstrijdId) {
            fetch(`http://localhost:3000/api/ritten/deadlines/${wedstrijdId}`)
                .then(res => res.json())
                .then(data => setDeadlines(data))
                .catch(err => console.error("Fout bij laden deadlines:", err));
        }
    }, [wedstrijdId]);

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
            <section className="section-head">
                <div>
                    <h1>Team beheren</h1>
                    <p>Bekijk actieve renners, bankrenners en voer wissels uit.</p>
                </div>
            </section>

            {/* 5. PLAATS DE TIMERS HIER, NET ONDER DE HEADER */}
            {deadlines && (
                <div className="card" style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap', padding: '1.5rem' }}>
                    {deadlines.groteStart && (
                        <div style={{ flex: '1', minWidth: '250px' }}>
                            <CountdownTimer
                                customTargetDate={deadlines.groteStart}
                                customTitel="Deadline Basisteam"
                                customSubTitel="Start van Rit 1"
                            />
                        </div>
                    )}

                    {deadlines.volgendeRit && (
                        <div style={{ flex: '1', minWidth: '250px', borderLeft: '1px solid #334155', paddingLeft: '20px' }}>
                            <CountdownTimer
                                customTargetDate={deadlines.volgendeRit.starttijd}
                                customTitel="Deadline Wissel"
                                customSubTitel={deadlines.volgendeRit.naam}
                            />
                        </div>
                    )}
                </div>
            )}

            {melding && <p className="form-message">{melding}</p>}

            <section className="team-columns">
                <div className="card">
                    <h2>Actief team</h2>
                    {actieveRenners.map((renner) => (
                        <div key={renner.draftId} className="team-row">
                            <strong>{renner.naam}</strong>
                            <span>{renner.ploeg}</span>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <h2>Bank</h2>
                    {bankRenners.map((renner) => (
                        <div key={renner.draftId} className="team-row bank">
                            <strong>{renner.naam}</strong>
                            <span>{renner.ploeg}</span>
                        </div>
                    ))}
                </div>
            </section>

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

                    <button type="submit" className="primary-btn">
                        Wissel uitvoeren
                    </button>
                </form>
            </section>
        </div>
    );
}

