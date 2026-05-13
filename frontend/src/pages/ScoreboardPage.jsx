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
    getHallOfFame // <-- NIEUW: deze moest ook nog worden geïmporteerd!
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

    // --- 1. ALLE STATE HOOKS BOVENAAN ---
    const [spelers, setSpelers] = useState([]);
    const [wedstrijd, setWedstrijd] = useState(null);
    const [topRenners, setTopRenners] = useState([]);
    const [truien, setTruien] = useState(null);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState("");
    const [draftSessies, setDraftSessies] = useState([]);
    const [sessieId, setSessieId] = useState("");
    const [klassementTab, setKlassementTab] = useState("algemeen");
    const [hallOfFame, setHallOfFame] = useState([]); // <-- NU NETJES BOVENAAN

    // --- 2. ALLE USEEFFECT HOOKS ---
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

    // Hall of Fame lader (nu veilig vóór de early returns)
    useEffect(() => {
        async function laadHallOfFame() {
            try {
                const res = await getHallOfFame();
                setHallOfFame(res.data || []);
            } catch (e) {
                console.error("Kon Hall of Fame niet laden:", e);
            }
        }
        laadHallOfFame();
    }, []);

    // --- FUNCTIES ---
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

    // --- 3. EARLY RETURNS (Hierna mogen GEEN haken (hooks) meer staan!) ---
    if (loading) return <div>Laden van scoreboard...</div>;
    if (melding) return <div>{melding}</div>;

    // --- 4. RENDER VARIABELEN ---
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

    // --- 5. RENDER JSX ---
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

            <section
                className="scoreboard-top-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "1.5rem",
                    alignItems: "stretch",
                    minHeight: "450px"
                }}
            >
                {/* --- KOLOM 1: Algemeen Klassement --- */}
                <div className="card klassement-card" style={{ display: "flex", flexDirection: "column", padding: "1.5rem", height: "100%", margin: 0 }}>
                    <div
                        className="section-head"
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "1.5rem",
                            borderBottom: "none",
                            paddingBottom: 0
                        }}
                    >
                        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
                            {klassementTab === "algemeen"
                                ? "Algemeen klassement"
                                : `Uitslag laatste rit`}
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
                                    backgroundColor: klassementTab === "algemeen" ? "#22d3ee" : "transparent",
                                    color: klassementTab === "algemeen" ? "#0f172a" : "#94a3b8",
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
                                    backgroundColor: klassementTab === "dagelijks" ? "#22d3ee" : "transparent",
                                    color: klassementTab === "dagelijks" ? "#0f172a" : "#94a3b8",
                                    transition: "all 0.2s",
                                }}
                            >
                                Laatste rit
                            </button>
                        </div>
                    </div>

                    <div className="klassement-list" style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "5px" }}>
                        {getoondeKlassement.map((speler, index) => (
                            <div key={speler.speler_id} className="klassement-row" style={{ display: "flex", alignItems: "center", padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                <div className="rank" style={{ fontWeight: "bold", opacity: 0.5, width: "30px" }}>#{index + 1}</div>

                                <div className="player-info" style={{ flexGrow: 1, display: "flex", alignItems: "center", gap: "10px" }}>
                                    <span
                                        className="player-dot"
                                        style={{ backgroundColor: speler.kleur, width: "10px", height: "10px", borderRadius: "50%", display: "inline-block", boxShadow: `0 0 8px ${speler.kleur}60` }}
                                    />
                                    <strong style={{ fontSize: "1.1rem" }}>{capitalize(speler.speler)}</strong>
                                </div>

                                <div className="player-total" style={{ color: "#22d3ee", fontWeight: "bold", fontSize: "1.1rem" }}>
                                    {speler.toonPunten} <span style={{ fontSize: "0.75rem", fontWeight: "normal", color: "#94a3b8" }}>PTS</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- KOLOM 2: Top 10 Renners (Gefixt Design) --- */}
                <div className="card top-renners-card" style={{ display: "flex", flexDirection: "column", padding: "1.5rem", height: "100%", margin: 0 }}>
                    <div className="section-head" style={{ marginBottom: "1.5rem", borderBottom: "none", paddingBottom: 0 }}>
                        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Top 10 renners</h2>
                    </div>

                    <div className="klassement-list" style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "5px" }}>
                        {topRenners.map((renner, index) => (
                            <div key={renner.renner_id} className="klassement-row" style={{ display: "flex", alignItems: "center", padding: "12px", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>

                                <div className="rank" style={{ display: "flex", justifyContent: "center", alignItems: "center", width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", color: "#22d3ee", fontWeight: "bold", flexShrink: 0 }}>
                                    #{index + 1}
                                </div>

                                <div className="player-info" style={{ flexGrow: 1, marginLeft: "15px", display: "flex", flexDirection: "column", minWidth: 0, alignItems: "flex-start" }}>
                                    <strong style={{ fontSize: "1rem", textTransform: "uppercase", whiteSpace: "normal", wordWrap: "break-word", lineHeight: "1.2" }}>
                                        {renner.renner}
                                    </strong>
                                    <span style={{ fontSize: "0.75rem", color: "#94a3b8", textTransform: "uppercase", marginTop: "4px", fontWeight: "600", letterSpacing: "0.5px" }}>
                                        {capitalize(renner.eigenaar)}
                                        {renner.isBank ? " • BANK" : ""}
                                    </span>
                                </div>

                                <div className="player-total" style={{ color: "#22d3ee", fontWeight: "bold", fontSize: "1.1rem", flexShrink: 0, marginLeft: "10px", textAlign: "right" }}>
                                    {renner.totaal} <span style={{ fontSize: "0.7rem", fontWeight: "normal", color: "#94a3b8" }}>PTS</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- KOLOM 3: Truien + Hall of Fame (Echte Data) --- */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", height: "100%" }}>

                    {/* Truitjes Kaart */}
                    <div className="card truien-card" style={{ padding: "1.5rem", margin: 0 }}>
                        <div className="section-head" style={{ marginBottom: "1.5rem", borderBottom: "none", paddingBottom: 0 }}>
                            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Truitjes</h2>
                        </div>

                        <div className="truien-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div className="trui-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="trui-label" style={{ color: truien?.wedstrijdNaam?.includes("Giro") ? "#E40071" : truien?.wedstrijdNaam?.includes("Vuelta") ? "#D70014" : "#FCD116", fontWeight: "bold", textTransform: "uppercase", fontSize: "0.85rem" }}>
                                    {truien?.wedstrijdNaam?.includes("Giro") ? "Roze" : truien?.wedstrijdNaam?.includes("Vuelta") ? "Rood" : "Geel"}
                                </span>
                                <strong style={{ textTransform: "uppercase", fontSize: "0.9rem", textAlign: "right" }}>{capitalize(truien?.algemeen) || "-"}</strong>
                            </div>

                            <div className="trui-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="trui-label" style={{ color: "#008B47", fontWeight: "bold", textTransform: "uppercase", fontSize: "0.85rem" }}>Punten</span>
                                <strong style={{ textTransform: "uppercase", fontSize: "0.9rem", textAlign: "right" }}>{capitalize(truien?.punten) || "-"}</strong>
                            </div>

                            <div className="trui-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="trui-label" style={{ color: "#3b82f6", fontWeight: "bold", textTransform: "uppercase", fontSize: "0.85rem" }}>Berg</span>
                                <strong style={{ textTransform: "uppercase", fontSize: "0.9rem", textAlign: "right" }}>{capitalize(truien?.berg) || "-"}</strong>
                            </div>

                            <div className="trui-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                <span className="trui-label" style={{ color: "#f8fafc", fontWeight: "bold", textTransform: "uppercase", fontSize: "0.85rem" }}>Jongeren</span>
                                <strong style={{ textTransform: "uppercase", fontSize: "0.9rem", textAlign: "right" }}>{capitalize(truien?.jongeren) || "-"}</strong>
                            </div>

                            {truien?.rit_nummer && (
                                <p className="small-muted" style={{ margin: "5px 0 0 0", fontSize: "0.75rem", fontStyle: "italic" }}>Na rit {truien.rit_nummer}</p>
                            )}
                        </div>
                    </div>

                    {/* Hall of Fame Kaart */}
                    <div className="card hall-of-fame-card" style={{ padding: "1.5rem", margin: 0, display: "flex", flexDirection: "column", flexGrow: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                            <span style={{ fontSize: "1.2rem" }}>🌍</span>
                            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#f59e0b" }}>Hall of Fame</h2>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: "0 0 1rem 0", fontStyle: "italic" }}>Totaal over alle koersen</p>

                        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "5px" }}>
                            {hallOfFame.length > 0 ? (
                                hallOfFame.map((speler, idx) => (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: idx < hallOfFame.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingBottom: "8px" }}>
                                        <span style={{ fontWeight: idx === 0 ? "bold" : "normal", color: idx === 0 ? "#f59e0b" : "#e2e8f0" }}>
                                            {idx + 1}. {capitalize(speler.naam)}
                                        </span>
                                        <span style={{ fontWeight: "bold" }}>
                                            {speler.totaal_punten} <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: "normal" }}>PTS</span>
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>Nog geen data beschikbaar...</div>
                            )}
                        </div>
                    </div>

                </div>
            </section >

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
        </div >
    );
}