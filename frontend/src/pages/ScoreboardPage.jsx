import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid,
} from "recharts";
import { getScoreboard } from "../services/api";
import CountdownTimer from "../components/CountdownTimer";

const kleuren = [
    "#00e5c7",
    "#ffc400",
    "#ff4d4d",
    "#7c4dff",
    "#4caf50",
    "#ff9800",
    "#03a9f4",
    "#e91e63",
];

function maakGrafiekData(spelers) {
    if (!spelers.length) return [];

    const maxRitten = Math.max(
        ...spelers.map((speler) => speler.per_rit?.length || 0),
    );

    return Array.from({ length: maxRitten }, (_, index) => {
        const ritNummer = index + 1;
        const punt = { rit: `Rit ${ritNummer}` };

        spelers.forEach((speler) => {
            const totaalTotNu = speler.per_rit
                .filter((rit) => rit.rit_nummer <= ritNummer)
                .reduce((som, rit) => som + rit.punten, 0);

            punt[speler.speler] = totaalTotNu;
        });

        return punt;
    });
}

export default function ScoreboardPage() {
    const { competitieId = "1" } = useParams();

    const [spelers, setSpelers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState("");

    useEffect(() => {
        async function laadScoreboard() {
            try {
                setLoading(true);
                setMelding("");

                const response = await getScoreboard(competitieId);

                const spelersMetKleur = response.data.map((speler, index) => ({
                    ...speler,
                    kleur: kleuren[index % kleuren.length],
                }));

                setSpelers(spelersMetKleur);
            } catch (err) {
                console.error("Fout bij ophalen scoreboard:", err);
                setMelding(
                    err.response?.data?.error ||
                    err.response?.data?.details ||
                    "Kon scoreboard niet laden.",
                );
            } finally {
                setLoading(false);
            }
        }

        laadScoreboard();
    }, [competitieId]);

    if (loading) return <div>Laden van scoreboard...</div>;
    if (melding) return <div>{melding}</div>;

    const grafiekData = maakGrafiekData(spelers);
    const klassement = [...spelers].sort((a, b) => b.totaal - a.totaal);
    const aantalRitten = Math.max(
        0,
        ...spelers.map((speler) => speler.per_rit?.length || 0),
    );

    return (
        <div className="scoreboard-page">
            <section className="scoreboard-header">
                <div>
                    <h1>Scoreboard</h1>
                    <CountdownTimer />
                    <p>Overzicht van alle spelers, ritpunten, truienpunten en totaalstand.</p>
                </div>

                <div className="scoreboard-summary">
                    <span>{spelers.length} spelers</span>
                    <strong>{aantalRitten} ritten</strong>
                </div>
            </section>

            <section className="card scoreboard-chart-card">
                <div className="section-head">
                    <h2>Puntenverloop per rit</h2>
                </div>

                <div className="scoreboard-chart">
                    <ResponsiveContainer width="100%" height={360}>
                        <LineChart data={grafiekData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="rit" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {spelers.map((speler) => (
                                <Line
                                    key={speler.speler_id}
                                    type="monotone"
                                    dataKey={speler.speler}
                                    stroke={speler.kleur}
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 7 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="scoreboard-grid">
                <div className="card klassement-card">
                    <div className="section-head">
                        <h2>Algemeen klassement</h2>
                    </div>

                    <div className="klassement-list">
                        {klassement.map((speler, index) => (
                            <div key={speler.speler_id} className="klassement-row">
                                <div className="rank">#{index + 1}</div>

                                <div className="player-info">
                                    <span
                                        className="player-dot"
                                        style={{ backgroundColor: speler.kleur }}
                                    />
                                    <strong>{speler.speler}</strong>
                                </div>

                                <div className="player-total">{speler.totaal} pts</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card ritpunten-card">
                    <div className="section-head">
                        <h2>Punten per rit</h2>
                    </div>

                    <div className="ritpunten-table-wrapper">
                        <table className="ritpunten-table">
                            <thead>
                                <tr>
                                    <th>Speler</th>
                                    {Array.from({ length: aantalRitten }, (_, i) => (
                                        <th key={i}>Rit {i + 1}</th>
                                    ))}
                                    <th>Totaal</th>
                                </tr>
                            </thead>

                            <tbody>
                                {klassement.map((speler) => (
                                    <tr key={speler.speler_id}>
                                        <td>
                                            <span
                                                className="player-dot"
                                                style={{ backgroundColor: speler.kleur }}
                                            />
                                            {speler.speler}
                                        </td>

                                        {Array.from({ length: aantalRitten }, (_, i) => {
                                            const rit = speler.per_rit.find(
                                                (r) => r.rit_nummer === i + 1,
                                            );

                                            if (!rit) return <td key={i}>-</td>;

                                            return (
                                                <td key={i} className="score-cell">
                                                    <strong>{rit.punten}</strong>
                                                    <span className="score-detail">
                                                        {rit.rit_punten} + {rit.truien_punten}
                                                    </span>
                                                </td>
                                            );
                                        })}

                                        <td>
                                            <strong>{speler.totaal}</strong>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}