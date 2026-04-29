import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getSessieVoorCompetitie,
    getSpelersVoorCompetitie,
} from "../services/api";

export default function TeamsPage() {
    const { competitieId = "1" } = useParams();
    const navigate = useNavigate();

    const [spelers, setSpelers] = useState([]);
    const [sessieId, setSessieId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState("");

    useEffect(() => {
        async function laadData() {
            try {
                setLoading(true);

                const sessieResponse = await getSessieVoorCompetitie(competitieId);
                const spelersResponse = await getSpelersVoorCompetitie(competitieId);

                setSessieId(sessieResponse.data.id);
                setSpelers(spelersResponse.data || []);
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

            <section className="teams-grid">
                {spelers.map((speler) => (
                    <button
                        key={speler.id}
                        className="team-card"
                        onClick={() =>
                            navigate(`/teams/${competitieId}/${sessieId}/${speler.id}`)
                        }
                    >
                        <h2>{speler.naam}</h2>
                        <p>Bekijk team</p>
                    </button>
                ))}
            </section>
        </div>
    );
}