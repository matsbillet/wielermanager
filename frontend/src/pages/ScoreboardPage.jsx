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
import {
    getScoreboard,
    getScoreboardVoorSessie,
    getDraftSessiesVoorCompetitie,
} from "../services/api";

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

const capitalize = (text) => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
};

function maakGrafiekData(spelers) {
    if (!spelers.length) return [];

    const geredenRitNummers = [
        ...new Set(
            spelers.flatMap((speler) =>
                (speler.per_rit || [])
                    .filter((rit) => rit.gescrapet)
                    .map((rit) => rit.rit_nummer)
            )
        ),
    ].sort((a, b) => a - b);

    return geredenRitNummers.map((ritNummer) => {
        const punt = { rit: `Rit ${ritNummer}` };

        spelers.forEach((speler) => {
            const totaalTotNu = (speler.per_rit || [])
                .filter(
                    (rit) =>
                        rit.gescrapet &&
                        Number(rit.rit_nummer) <= Number(ritNummer)
                )
                .reduce((som, rit) => som + Number(rit.punten || 0), 0);

            punt[capitalize(speler.speler)] = totaalTotNu;
        });

        return punt;
    });
}

export default function ScoreboardPage() {
    const { competitieId = "1" } = useParams();

    const [spelers, setSpelers] = useState([]);
    const [wedstrijd, setWedstrijd] = useState(null);
    const [topRenners, setTopRenners] = useState([]);
    const [truien, setTruien] = useState(null);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState("");
    const [draftSessies, setDraftSessies] = useState([]);
    const [sessieId, setSessieId] = useState("");
    const [klassementTab, setKlassementTab] = useState("algemeen");

    useEffect(() => {
        async function laadScoreboard() {
            try {
                setLoading(true);
                setMelding("");

                const [sessiesResponse, scoreboardResponse] = await Promise.all([
                    getDraftSessiesVoorCompetitie(competitieId),
                    getScoreboard(competitieId),
                ]);

                const sessies = Array.isArray(sessiesResponse.data)
                    ? sessiesResponse.data
                    : [];

                setDraftSessies(sessies);
                setSessieId(scoreboardResponse.data.sessieId);

                verwerkScoreboardData(scoreboardResponse.data);
            } catch (err) {
                console.error("Fout bij ophalen scoreboard:", err);
                setMelding(
                    err.response?.data?.error ||
                    err.response?.data?.details ||
                    "Kon scoreboard niet laden."
                );
            } finally {
                setLoading(false);
            }
        }

        laadScoreboard();
    }, [competitieId]);

    function verwerkScoreboardData(data) {
        const scoreboardData = data.scoreboard || [];
        const wedstrijdData = data.wedstrijd || null;

        const spelersMetKleur = scoreboardData.map((speler, index) => ({
            ...speler,
            kleur: kleuren[index % kleuren.length],
        }));

        setSpelers(spelersMetKleur);
        setWedstrijd(wedstrijdData);
        setTopRenners(data.topRenners || []);
        setTruien(data.truien || null);
    }

    async function handleSelectSessie(event) {
        const gekozenSessieId = event.target.value;

        try {
            setLoading(true);
            setMelding("");
            setSessieId(gekozenSessieId);

            const response = await getScoreboardVoorSessie(gekozenSessieId);

            verwerkScoreboardData(response.data);
        } catch (err) {
            console.error("Fout bij wisselen scoreboard sessie:", err);
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                "Kon scoreboard voor deze koers niet laden."
            );
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div>Laden van scoreboard...</div>;
    if (melding) return <div>{melding}</div>;

    const grafiekData = maakGrafiekData(spelers);

    const geredenRitNummers = [...new Set(
        spelers.flatMap((speler) =>
            (speler.per_rit || [])
                .filter((rit) => rit.gescrapet)
                .map((rit) => rit.rit_nummer)
        )
    )].sort((a, b) => b - a);

    const laatsteRitNummer =
        geredenRitNummers.length > 0 ? geredenRitNummers[0] : null;

    let getoondeKlassement = [];

    if (klassementTab === "algemeen") {
        getoondeKlassement = [...spelers]
            .sort((a, b) => b.totaal - a.totaal)
            .map((s) => ({ ...s, toonPunten: s.totaal }));
    } else {
        getoondeKlassement = [...spelers]
            .map((s) => {
                const ritData = (s.per_rit || []).find(
                    (r) => r.rit_nummer === laatsteRitNummer
                );
                const dagPunten = ritData ? ritData.punten : 0;
                return { ...s, toonPunten: dagPunten };
            })
            .sort((a, b) => b.toonPunten - a.toonPunten);
    }

    const aantalRitten = Math.max(
        0,
        ...spelers.map((speler) => speler.per_rit?.length || 0)
    );

    const klassement = [...spelers].sort((a, b) => b.totaal - a.totaal);
    const aantalGeredenRitten = geredenRitNummers.length;

    return (
        <div className="scoreboard-page">
            <section className="scoreboard-header">
                <div>
                    <h1>Scoreboard</h1>
                    <p>Overzicht van alle spelers, ritpunten, truienpunten en totaalstand.</p>
                    <p>
                        {wedstrijd
                            ? `Bekeken koers: ${wedstrijd.naam}`
                            : "Geen koers gevonden"}
                    </p>

                    <select
                        className="draft-session-select"
                        value={sessieId}
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
                </div>

                <div className="scoreboard-summary">
                    <span>{spelers.length} spelers</span>
                    <strong>{aantalGeredenRitten} / {aantalRitten} ritten</strong>
                </div>
            </section>

            <section className="card scoreboard-chart-card">
                <div className="section-head">
                    <h2>Puntenverloop per rit</h2>
                </div>

                <div className="scoreboard-chart">
                    <ResponsiveContainer width="100%" height={360}>
                        <LineChart
                            data={grafiekData}
                            margin={{ top: 20, right: 30, left: 40, bottom: 40 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis
                                dataKey="rit"
                                interval={0}
                                angle={-35}
                                textAnchor="end"
                                height={70}
                            />
                            <YAxis width={55} />
                            <Tooltip />
                            <Legend />

                            {spelers.map((speler) => (
                                <Line
                                    key={speler.speler_id}
                                    type="monotone"
                                    dataKey={capitalize(speler.speler)}
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

            <section className="scoreboard-top-grid">
                <div className="card klassement-card">
                    <div
                        className="section-head"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                        }}
                    >
                        <h2>
                            {klassementTab === "algemeen"
                                ? "Algemeen klassement"
                                : `Uitslag Rit ${laatsteRitNummer || "-"}`}
                        </h2>

                        <div
                            style={{
                                display: "flex",
                                backgroundColor: "rgba(0,0,0,0.2)",
                                borderRadius: "8px",
                                padding: "4px",
                            }}
                        >
                            <button
                                onClick={() => setKlassementTab("algemeen")}
                                style={{
                                    padding: "6px 12px",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    fontSize: "0.85rem",
                                    backgroundColor:
                                        klassementTab === "algemeen"
                                            ? "#22d3ee"
                                            : "transparent",
                                    color:
                                        klassementTab === "algemeen"
                                            ? "#0f172a"
                                            : "#94a3b8",
                                    transition: "all 0.2s",
                                }}
                            >
                                Algemeen
                            </button>

                            <button
                                onClick={() => setKlassementTab("dagelijks")}
                                style={{
                                    padding: "6px 12px",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    fontSize: "0.85rem",
                                    backgroundColor:
                                        klassementTab === "dagelijks"
                                            ? "#22d3ee"
                                            : "transparent",
                                    color:
                                        klassementTab === "dagelijks"
                                            ? "#0f172a"
                                            : "#94a3b8",
                                    transition: "all 0.2s",
                                }}
                            >
                                Laatste Rit
                            </button>
                        </div>
                    </div>

                    <div className="klassement-list">
                        {getoondeKlassement.map((speler, index) => (
                            <div key={speler.speler_id} className="klassement-row">
                                <div className="rank">#{index + 1}</div>

                                <div className="player-info">
                                    <span
                                        className="player-dot"
                                        style={{ backgroundColor: speler.kleur }}
                                    />
                                    <strong>{capitalize(speler.speler)}</strong>
                                </div>

                                <div className="player-total">{speler.toonPunten} pts</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card top-renners-card">
                    <div className="section-head">
                        <h2>Top 10 renners</h2>
                    </div>

                    <div className="klassement-list">
                        {topRenners.map((renner, index) => (
                            <div key={renner.renner_id} className="klassement-row">
                                <div className="rank">#{index + 1}</div>

                                <div className="player-info">
                                    <strong>{renner.renner}</strong>
                                    <span className="small-muted">
                                        {capitalize(renner.eigenaar)}
                                        {renner.isBank ? " · bank" : ""}
                                    </span>
                                </div>

                                <div className="player-total">{renner.totaal} pts</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card truien-card">
                    <div className="section-head">
                        <h2>Truitjes</h2>
                    </div>

                    <div className="truien-list">
                        <div className="trui-row">
                            <span
                                className={`trui-label ${truien?.wedstrijdNaam?.includes("Giro")
                                        ? "roze"
                                        : truien?.wedstrijdNaam?.includes("Vuelta")
                                            ? "rood"
                                            : "geel"
                                    }`}
                            >
                                {truien?.wedstrijdNaam?.includes("Giro")
                                    ? "Roze"
                                    : truien?.wedstrijdNaam?.includes("Vuelta")
                                        ? "Rood"
                                        : "Geel"}
                            </span>

                            <strong>{capitalize(truien?.algemeen) || "-"}</strong>
                        </div>

                        <div className="trui-row">
                            <span className="trui-label punten">Punten</span>
                            <strong>{capitalize(truien?.punten) || "-"}</strong>
                        </div>

                        <div className="trui-row">
                            <span className="trui-label berg">Berg</span>
                            <strong>{capitalize(truien?.berg) || "-"}</strong>
                        </div>

                        <div className="trui-row">
                            <span className="trui-label jongeren">Jongeren</span>
                            <strong>{capitalize(truien?.jongeren) || "-"}</strong>
                        </div>

                        {truien?.rit_nummer && (
                            <p className="small-muted">Na rit {truien.rit_nummer}</p>
                        )}
                    </div>
                </div>
            </section>

            <section className="card ritpunten-card ritpunten-card-full">
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
                                        {capitalize(speler.speler)}
                                    </td>

                                    {Array.from({ length: aantalRitten }, (_, i) => {
                                        const rit = speler.per_rit.find(
                                            (r) => r.rit_nummer === i + 1
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
            </section>
        </div>
    );
}