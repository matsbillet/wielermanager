import { useState } from 'react';
import { kiesRenner } from '../services/api';

const riders = [
    ['Tadej Pogačar', 'tadej-pogacar', 'UAE Team Emirates', 'SLO', 485, 'P1', '+10 jersey'],
    ['Jonas Vingegaard', 'jonas-vingegaard', 'Visma-Lease a Bike', 'DEN', 445, 'P2', '+10 jersey'],
    ['Remco Evenepoel', 'remco-evenepoel', 'Soudal Quick-Step', 'BEL', 398, 'P3', '+10 jersey'],
    ['Jasper Philipsen', 'jasper-philipsen', 'Alpecin-Deceuninck', 'BEL', 372, 'P8', '+10 jersey'],
    ['Primož Roglič', 'primoz-roglic', 'Red Bull-BORA-hansgrohe', 'SLO', 156, 'DNF', ''],
    ['Mathieu van der Poel', 'mathieu-van-der-poel', 'Alpecin-Deceuninck', 'NED', 289, 'P12', ''],
    ['Wout van Aert', 'wout-van-aert', 'Visma-Lease a Bike', 'BEL', 312, 'P15', ''],
    ['Egan Bernal', 'egan-bernal', 'INEOS Grenadiers', 'COL', 234, 'P18', '']
];

export default function DraftPage() {
    const [loading, setLoading] = useState(false);
    const [melding, setMelding] = useState('');

    async function handleKiesRenner(rennerSlug, naam) {
        try {
            setLoading(true);
            setMelding('');

            const response = await kiesRenner({
                spelerNaam: 'Roel',
                rennerSlug: rennerSlug,
                huidigeBeurt: 1
            });

            setMelding(response.data.bericht || `${naam} gekozen!`);
        } catch (err) {
            setMelding('Fout bij kiezen van renner. Check console.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <section className="banner card draft-board">
                <div className="banner-title">Draft Board</div>
                <div className="banner-sub">Snake Draft - Pro Peloton League</div>
                <div className="draft-order">
                    <div className="draft-slot panel"><strong>You</strong><span className="yellow">Picking now</span></div>
                    <div className="draft-slot panel"><strong>User 2</strong><span className="small-muted">Waiting</span></div>
                    <div className="draft-slot panel"><strong>User 3</strong><span className="small-muted">Waiting</span></div>
                    <div className="draft-slot panel"><strong>User 4</strong><span className="small-muted">Waiting</span></div>
                </div>
            </section>

            <section className="turn-banner">
                <div>
                    <div className="rider-name">It's Your Turn!</div>
                    <p>Select a rider to draft to your team</p>
                </div>
                <button className="pill-btn" disabled={loading}>
                    {loading ? 'Bezig...' : 'Draft actief'}
                </button>
            </section>

            {melding && (
                <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    {melding}
                </div>
            )}

            <div className="section-head"><h2>Available Riders (8)</h2></div>

            <section className="riders-grid">
                {riders.map(([naam, slug, team, land, pts, pos, bonus]) => (
                    <article key={slug} className="rider-card card">
                        <div className="rider-image">🚴</div>
                        <div className="rider-body">
                            <div className="rider-topline">
                                <div className="rider-name">{naam}</div>
                                <div className="rider-country">{land}</div>
                            </div>

                            <div className="rider-team">{team}</div>

                            <div className="rider-meta">
                                <span className="yellow">
                                    <strong>↗ {pts}</strong> <span className="muted">pts</span>
                                </span>
                                <span className="muted">{pos}</span>
                                <span className="yellow">{bonus}</span>
                            </div>

                            <div style={{ marginTop: '1rem' }}>
                                <button
                                    className="pill-btn"
                                    onClick={() => handleKiesRenner(slug, naam)}
                                    disabled={loading}
                                >
                                    Kies {naam}
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}