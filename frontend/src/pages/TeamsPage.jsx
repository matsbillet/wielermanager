import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getSessieVoorCompetitie,
    getSpelersVoorCompetitie,
} from "../services/api";
import CountdownTimer from "../components/CountdownTimer";

export default function TeamsPage() {
    const { competitieId = "1" } = useParams();
    const navigate = useNavigate();

    const [spelers, setSpelers] = useState([]);
    const [sessieId, setSessieId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState("");

    // State voor de deadlines
    const [deadlines, setDeadlines] = useState(null);

    useEffect(() => {
        async function laadData() {
            try {
                setLoading(true);

                // 1. Haal de sessie en spelers op via de competitieId
                const sessieResponse = await getSessieVoorCompetitie(1);
                const spelersResponse = await getSpelersVoorCompetitie(1);

                // Sla de sessieId op zodat we deze in de knoppen kunnen gebruiken
                const sId = sessieResponse.data.id;
                setSessieId(sId);
                setSpelers(spelersResponse.data || []);

                // 2. Haal de wedstrijdId robuust uit de sessie data!
                const wId = sessieResponse.data.wedstrijd_id || sessieResponse.data.wedstrijden?.id;

                // 3. Nu we de wedstrijdId zeker weten, halen we de deadlines op
                if (wId) {
                    const dlResponse = await fetch(`http://localhost:3000/api/ritten/deadlines/${wId}`);
                    const dlData = await dlResponse.json();
                    setDeadlines(dlData);
                }

            } catch (err) {
                console.error(err);
                setMelding("Kon teams niet laden.");
            } finally {
                setLoading(false);
            }
        }

        laadData();
    }, [competitieId]);

    if (loading) return <div>Teams laden...</div>;
    if (melding) return <div>{melding}</div>;

    return (
        <div className="teams-page">
            <section className="section-head">
                <div>
                    <h1>Teams</h1>
                    <p>Kies een speler om zijn team te bekijken en wissels uit te voeren.</p>
                </div>
            </section>

            {/* DEADLINES OP DE OVERZICHTSPAGINA */}
            {deadlines && (
                <div className="card" style={{ display: 'flex', gap: '20px', marginBottom: '25px', flexWrap: 'wrap', padding: '1.5rem' }}>
                    <div style={{ flex: '1', minWidth: '250px' }}>
                        <CountdownTimer
                            customTargetDate={deadlines.groteStart} // Kan undefined zijn
                            customTitel="Deadline Basisteam"
                            customSubTitel="Start van Rit 1"
                        />
                    </div>

                    <div style={{ flex: '1', minWidth: '250px', borderLeft: '1px solid #334155', paddingLeft: '20px' }}>
                        <CountdownTimer
                            customTargetDate={deadlines.volgendeRit?.starttijd} // Gebruik optional chaining (?)
                            customTitel="Deadline Wissel"
                            customSubTitel={deadlines.volgendeRit?.naam}
                        />
                    </div>
                </div>
            )}

            <section className="teams-grid">
                {spelers.map((speler) => (
                    <button
                        key={speler.id}
                        className="team-card"
                        // Geen 'state' bagage meer, we bouwen gewoon de schone URL op
                        onClick={() => navigate(`/teams/${competitieId}/${sessieId}/${speler.id}`)}
                    >
                        <h2>{speler.naam}</h2>
                        <p>Bekijk team</p>
                    </button>
                ))}
            </section>
        </div>
    );
}