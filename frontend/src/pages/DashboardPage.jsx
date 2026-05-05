import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getDashboardStats } from "../services/api";
import CountdownTimer from "../components/CountdownTimer";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        naam: "Manager",
        totaalPunten: 0,
        positie: "-",
        actieveRaces: 0,
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function laadDashboard() {
            try {
                const response = await getDashboardStats();
                setStats(response.data);
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
        <div className="dashboard-container" style={{ padding: "2rem" }}>
            <div className="section-head">
                <h1>Welkom terug, {stats.naam}! 👋</h1>
                <p style={{ opacity: 0.7 }}>Hier is de status van je wieler-imperium.</p>
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "1.5rem",
                    marginBottom: "3rem",
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

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem" }}>
                <section>
                    <div className="section-head">
                        <h2>Snelle Acties</h2>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <ActionLink to="/teams/1" title="Mijn Team" desc="Bekijk je team" icon="👥" />
                        <ActionLink to="/races" title="Kalender" desc="Bekijk alle ritten" icon="📅" />
                    </div>
                </section>

                <aside>
                    <div className="section-head">
                        <h2>Live Status</h2>
                    </div>

                    <div className="card" style={{ display: "flex" }}>
                        <CountdownTimer />
                    </div>
                </aside>
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, color }) {
    return (
        <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: "1.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{icon}</div>
            <div style={{ opacity: 0.7, fontSize: "0.9rem" }}>{title}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>{value}</div>
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
            }}
        >
            <div style={{ fontSize: "1.5rem" }}>{icon}</div>
            <div>
                <div style={{ fontWeight: "bold", color: "#fff" }}>{title}</div>
                <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>{desc}</div>
            </div>
        </Link>
    );
}