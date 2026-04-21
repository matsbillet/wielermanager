import { Link } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const scoreboard = [
    { speler: 'CyclingFan42', team: 'Team Sky High', totaal: 3124, perRit: [540, 880, 1200, 1640, 2010, 2440, 2780, 3124] },
    { speler: 'You', team: 'Your Team', totaal: 2847, perRit: [490, 820, 1160, 1490, 1850, 2240, 2523, 2847] },
    { speler: 'VeloMaster', team: 'Climbing Kings', totaal: 2789, perRit: [470, 790, 1090, 1420, 1790, 2150, 2470, 2789] },
    { speler: 'SprintLegend', team: 'Speed Demons', totaal: 2654, perRit: [430, 740, 1035, 1350, 1685, 2010, 2340, 2654] },
    { speler: 'GCHunter', team: 'Yellow Jersey Chasers', totaal: 2501, perRit: [410, 700, 955, 1250, 1570, 1900, 2235, 2501] }
];

const mainTeam = [
    { naam: 'Tadej Pogačar', team: 'UAE Team Emirates', land: 'SLO', badge: '♛', badgeClass: 'badge-yellow' },
    { naam: 'Jonas Vingegaard', team: 'Visma-Lease a Bike', land: 'DEN', badge: '△', badgeClass: 'badge-red' },
    { naam: 'Remco Evenepoel', team: 'Soudal Quick-Step', land: 'BEL', badge: '⌕', badgeClass: 'badge-white' },
    { naam: 'Jasper Philipsen', team: 'Alpecin-Deceuninck', land: 'BEL', badge: '⚡', badgeClass: 'badge-green' }
];

const ritten = Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1),
    rit_nummer: index + 1,
    gescrapet: index < 5
}));

const chartData = [1, 2, 3, 4, 5, 6, 7, 8].map((rit, index) => ({
    rit: `Rit ${rit}`,
    ...Object.fromEntries(scoreboard.map((item) => [item.speler, item.perRit[index]]))
}));

const colors = ['#f3c300', '#23dc87', '#61a5ff', '#ff6b6b', '#c084fc'];

export default function ScoreboardPage() {
    return (
        <div>
            <section className="stats-grid">
                <article className="stat-card card highlight"><div className="stat-label">League Rank</div><div className="stat-value">#2</div><div className="stat-sub">of 5</div></article>
                <article className="stat-card card"><div className="stat-label">Total Points</div><div className="stat-value">2847</div><div className="stat-sub green">+124 this stage</div></article>
                <article className="stat-card card"><div className="stat-label">Active Riders</div><div className="stat-value">7</div><div className="stat-sub">of 12 main team</div></article>
                <article className="stat-card card"><div className="stat-label">DNF Riders</div><div className="stat-value">1</div><div className="stat-sub red">1 dropped out</div></article>
            </section>

            <section className="banner card">
                <div className="banner-title">Tour de France</div>
                <div className="banner-sub">Stage 12 of 21</div>
                <div className="live-pill">● LIVE</div>
                <div className="progress-track"><div className="progress-fill" /></div>
            </section>

            <div className="section-head">
                <h2>Your Main Team</h2>
                <Link className="section-link" to="/draft">Manage Team →</Link>
            </div>

            <section className="team-grid">
                {mainTeam.map((rider) => (
                    <article key={rider.naam} className="rider-card card">
                        <div className="rider-image">🚴<div className={`badge ${rider.badgeClass}`}>{rider.badge}</div></div>
                        <div className="rider-body">
                            <div className="rider-topline"><div className="rider-name">{rider.naam}</div><div className="rider-country">{rider.land}</div></div>
                            <div className="rider-team">{rider.team}</div>
                        </div>
                    </article>
                ))}
            </section>

            <div className="section-head">
                <h2>Scoreverloop</h2>
            </div>
            <section className="chart-panel panel">
                <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={chartData}>
                        <XAxis dataKey="rit" stroke="#9aa3b6" />
                        <YAxis stroke="#9aa3b6" />
                        <Tooltip />
                        {scoreboard.map((row, index) => (
                            <Line key={row.speler} type="monotone" dataKey={row.speler} stroke={colors[index]} strokeWidth={3} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </section>

            <div className="section-head">
                <h2>Ritten</h2>
            </div>
            <section className="rit-grid">
                {ritten.map((rit) => (
                    <Link key={rit.id} to={`/rit/${rit.id}`} className={`rit-link ${rit.gescrapet ? '' : 'pending'}`}>
                        Rit {rit.rit_nummer}
                    </Link>
                ))}
            </section>

            <div className="section-head">
                <h2>League Standings</h2>
                <Link className="section-link" to="/admin">View Admin →</Link>
            </div>
            <section className="list-panel panel">
                {scoreboard.map((item, index) => (
                    <div key={item.speler} className={`list-row ${item.speler === 'You' ? 'me' : ''}`}>
                        <div className={`rank ${index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''}`}>{index + 1}</div>
                        <div>
                            <div className="rider-name">{item.speler}</div>
                            <div className="muted">{item.team}</div>
                        </div>
                        <div>
                            <div className="rider-name yellow">{item.totaal}</div>
                            <div className="muted">points</div>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}