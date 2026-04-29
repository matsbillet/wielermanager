import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getTeamVanSpeler,
    getBeschikbareRenners,
    vervangRennerVoorStart,
    blessureWissel,
} from "../services/api";

export default function TeamDetailPage() {
    const { sessieId, spelerId } = useParams();

    const [team, setTeam] = useState([]);
    const [beschikbareRenners, setBeschikbareRenners] = useState([]);
    const [rennerUitId, setRennerUitId] = useState("");
    const [rennerInId, setRennerInId] = useState("");
    const [ritNummer, setRitNummer] = useState("");
    const [typeWissel, setTypeWissel] = useState("voor_start");
    const [melding, setMelding] = useState("");
    const [loading, setLoading] = useState(true);

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