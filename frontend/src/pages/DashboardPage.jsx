import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getScoreboard, getMijnCompetities } from '../services/api';
import CountdownTimer from '../components/CountdownTimer';

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totaalPunten: 0,
        positie: '-',
        actieveRaces: 0
    });

    // Hier kun je later echte data inladen
    useEffect(() => {
        // Voorbeeld: haal stats op
    }, []);

    return (
        <div className="dashboard-container" style={{ padding: '2rem' }}>
            <div className="section-head">
                <h1>Welkom terug, Manager! 👋</h1>
                <p style={{ opacity: 0.7 }}>Hier is de status van je wieler-imperium.</p>
            </div>

            {/* Top Stats Rij */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '3rem'
            }}>
                <StatCard title="Totaal Punten" value="1.240" icon="🏆" color="#22d3ee" />
                <StatCard title="Ranglijst Positie" value="4e" icon="📊" color="#fbbf24" />
                <StatCard title="Actieve Wedstrijden" value="2" icon="🚴" color="#f87171" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>

                {/* Linkerkant: Snelle Acties & Status */}
                <section>
                    <div className="section-head">
                        <h2>Snelle Acties</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <ActionLink to="/team" title="Mijn Team" desc="Beheer je opstelling" icon="👥" />
                        <ActionLink to="/races" title="Kalender" desc="Bekijk alle ritten" icon="📅" />
                    </div>

                    <div className="card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                        <h3>Laatste Nieuws</h3>
                        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
                            <li style={{ borderBottom: '1px solid #334155', padding: '10px 0' }}>
                                ✅ Giro d'Italia startlijst gesynchroniseerd.
                            </li>
                            <li style={{ padding: '10px 0' }}>
                                🏁 Rit 21 Tour de France verwerkt.
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Rechterkant: Plek voor de Aftelfunctie / Teamgenoot */}
                <aside>
                    <div className="section-head">
                        <h2>Live Status</h2>
                    </div>
                    <div className="card" style={{
                        display: 'flex',
                    }}>
                        <CountdownTimer />
                    </div>
                </aside>

            </div>
        </div>
    );
}

// Sub-component voor de kleine stats kaartjes
function StatCard({ title, value, icon, color }) {
    return (
        <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
            <div style={{ opacity: 0.7, fontSize: '0.9rem' }}>{title}</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{value}</div>
        </div>
    );
}

// Sub-component voor de actie knoppen
function ActionLink({ to, title, desc, icon }) {
    return (
        <Link to={to} className="card action-card" style={{
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1rem',
            transition: 'background 0.2s'
        }}>
            <div style={{ fontSize: '1.5rem' }}>{icon}</div>
            <div>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>{title}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{desc}</div>
            </div>
        </Link>
    );
}