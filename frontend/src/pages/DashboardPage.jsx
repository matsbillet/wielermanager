import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    getDashboardStats,
    getSessieVoorCompetitie,
    getUitvallers
} from "../services/api";
import CountdownTimer from "../components/CountdownTimer";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        naam: "Manager",
        totaalPunten: 0,
        positie: "-",
        actieveRaces: 0,
        topTruien: {
            algemeen: { naam: "-", aantal: 0 },
            punten: { naam: "-", aantal: 0 },
            berg: { naam: "-", aantal: 0 },
            jongeren: { naam: "-", aantal: 0 },
        },
    });

    const [uitvallers, setUitvallers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        function handleResize() {
            setIsMobile(window.innerWidth <= 768);
        }

        window.addEventListener("resize", handleResize);
        handleResize();

        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        async function laadDashboard() {
            try {
                // 1. Laad de standaard statistieken
                const response = await getDashboardStats();
                setStats(response.data);

                // 2. Haal de actieve wedstrijd op (om te weten van welke koers we de uitvallers moeten hebben)
                const sessieResponse = await getSessieVoorCompetitie(1);
                const wId = sessieResponse.data?.wedstrijd_id || sessieResponse.data?.wedstrijden?.id;

                // 3. Als er een actieve koers is, haal het medisch bulletin op!
                if (wId) {
                    const uitvallersResponse = await getUitvallers(wId);
                    setUitvallers(uitvallersResponse.data || []);
                }

            } catch (error) {
                console.error("Dashboard laden mislukt:", error);
            } finally {
                setLoading(false);
            }
        }

        laadDashboard();
    }, []);

    if (loading) return <div>Dashboard laden...</div>;

    return (
        <div
            className="dashboard-container"
            style={{
                maxWidth: "1280px",
                margin: "0 auto",
                padding: isMobile ? "1rem" : "6rem 2rem 2rem",
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
                    gap: isMobile ? "2rem" : "2rem",
                    alignItems: "start",
                    marginBottom: isMobile ? "2rem" : "4rem",
                }}
            >
                <section>
                    <div className="section-head">
                        <h2>Snelle Acties</h2>
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                            gap: "1rem",
                        }}
                    >
                        <ActionLink
                            to="/teams/1"
                            title="Mijn Team"
                            desc="Bekijk je team"
                            icon="👥"
                        />

                        <ActionLink
                            to="/races"
                            title="Kalender"
                            desc="Bekijk alle ritten"
                            icon="📅"
                        />
                    </div>
                </section>

                <aside>
                    <div className="section-head">
                        <h2>Live Status</h2>
                    </div>

                    <div
                        className="card"
                        style={{
                            display: "flex",
                            width: "100%",
                            minWidth: 0,
                            padding: "1.25rem",
                            marginBottom: "2rem"
                        }}
                    >
                        <CountdownTimer />
                    </div>
                </aside>
            </div>

            <div
                className="section-head"
                style={{
                    display: isMobile ? "block" : "flex",
                }}
            >
                <h1
                    className="dashboard-welcome"
                    style={{
                        fontSize: isMobile ? "1.5rem" : undefined,
                        lineHeight: 1.2,
                    }}
                >
                    Welkom terug, {stats.naam}! 👋
                </h1>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                    gap: "1.5rem",
                    marginBottom: isMobile ? "2rem" : "4rem",
                }}
            >
                <StatCard
                    title="Totaal Punten"
                    value={stats.totaalPunten}
                    icon="🏆"
                    color="#22d3ee"
                />

                <StatCard
                    title="Ranglijst Positie"
                    value={stats.positie}
                    icon="📊"
                    color="#fbbf24"
                />

                <StatCard
                    title="Actieve Wedstrijden"
                    value={stats.actieveRaces}
                    icon="🚴"
                    color="#f87171"
                />
            </div>

            <div style={{ marginBottom: isMobile ? "2rem" : "4rem" }}>

                {/* =======================================================
                TRUI-STATISTIEKEN (TIJDELIJK IN COMMENTAAR VOOR DE KLANT)
                =======================================================
                <div className="section-head">
                    <h2>Trui-statistieken</h2>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
                        gap: "1rem",
                        marginBottom: "4rem"
                    }}
                >
                    <JerseyCard title="Geel" data={stats.topTruien?.algemeen} color="#fbbf24" emoji="🟡" />
                    <JerseyCard title="Groen" data={stats.topTruien?.punten} color="#22c55e" emoji="🟢" />
                    <JerseyCard title="Bollen" data={stats.topTruien?.berg} color="#ef4444" emoji="🔴" />
                    <JerseyCard title="Wit" data={stats.topTruien?.jongeren} color="#ffffff" emoji="⚪" />
                </div> 
                */}

                {/* NIEUWE POSITIE: MEDISCH BULLETIN */}
                <div className="section-head">
                    <h2>🚑 Medisch Overzicht</h2>
                </div>

                <div
                    className="card"
                    style={{
                        padding: "1.25rem",
                        maxHeight: "350px", // Iets hoger gemaakt nu het over de hele breedte staat
                        overflowY: "auto",
                        backgroundColor: "rgba(239, 68, 68, 0.05)",
                        border: "1px solid rgba(239, 68, 68, 0.2)"
                    }}
                >
                    {uitvallers.length > 0 ? (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", // Twee kolommen op desktop voor beter ruimtegebruik
                            gap: "1rem"
                        }}>
                            {uitvallers.map((u, i) => (
                                <UitvallerItem key={i} u={u} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ opacity: 0.7, textAlign: "center", padding: "2rem 0", fontSize: "1.1rem" }}>
                            Geen uitvallers bekend in de huidige koers.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }) {
    return (
        <div
            className="card"
            style={{
                borderLeft: `4px solid ${color}`,
                padding: "1.5rem",
                minWidth: 0,
            }}
        >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                {icon}
            </div>

            <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                {title}
            </div>

            <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>
                {value}
            </div>
        </div>
    );
}

function UitvallerItem({ u }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
                padding: "0.75rem 1rem",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease-in-out",
                border: isOpen ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid transparent"
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    <strong style={{ fontSize: "1.1rem" }}>{u.renners?.naam}</strong>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{
                        backgroundColor: "#ef4444", color: "white",
                        padding: "4px 10px", borderRadius: "4px", fontWeight: "bold", fontSize: "0.9rem"
                    }}>
                        {u.status}
                    </span>
                    <span style={{ fontSize: "0.8rem", opacity: 0.5, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s" }}>
                        ▼
                    </span>
                </div>
            </div>

            {/* SLIDE DOWN GEDEELTE */}
            <div style={{
                maxHeight: isOpen ? "100px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.3s ease-in-out",
                opacity: isOpen ? 1 : 0
            }}>
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "0.95rem", color: "#e2e8f0" }}>
                    <p style={{ margin: "0 0 5px 0" }}>💔 <strong>{u.renners?.naam}</strong> is uitgevallen.</p>
                    <p style={{ margin: 0 }}>
                        Eigenaar: <strong style={{ color: u.eigenaar !== "Niemand" ? "#22d3ee" : "#94a3b8" }}>
                            {u.eigenaar !== "Niemand" ? u.eigenaar : "Geen (Zat in geen enkel team)"}
                        </strong>
                    </p>
                </div>
            </div>
        </div>
    );
}

// Zelfs als je het component 'JerseyCard' hieronder nog in de code hebt staan, 
// doet het geen kwaad. Als de klant het ooit terug wil, werkt het direct weer!
function JerseyCard({ title, data, color, emoji }) {
    return (
        <div
            className="card"
            style={{
                borderLeft: `4px solid ${color}`,
                padding: "1.25rem",
                minWidth: 0,
            }}
        >
            <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
                {emoji}
            </div>

            <div style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                {title}
            </div>

            <div
                style={{
                    fontSize: "1.2rem",
                    fontWeight: "bold",
                    marginTop: "0.25rem",
                }}
            >
                {data?.naam || "-"}
            </div>

            <div style={{ opacity: 0.75, marginTop: "0.35rem" }}>
                {data?.aantal > 0
                    ? `${data.aantal} keer`
                    : "Nog geen winnaar"}
            </div>
        </div>
    );
}

function ActionLink({ to, title, desc, icon }) {
    return (
        <Link
            to={to}
            className="card action-card"
            style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem",
                width: "100%",
                minWidth: 0,
            }}
        >
            <div style={{ fontSize: "1.5rem", flexShrink: 0 }}>
                {icon}
            </div>

            <div style={{ minWidth: 0 }}>
                <div className="action-card-title">
                    {title}
                </div>

                <div className="action-card-desc">
                    {desc}
                </div>
            </div>
        </Link>
    );
}