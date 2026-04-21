import { useEffect, useState } from 'react';
import { getBeschikbareRenners, kiesRenner } from '../services/api';

export default function DraftPage() {
    const [riders, setRiders] = useState([]);
    const [ladenRenners, setLadenRenners] = useState(true);
    const [loading, setLoading] = useState(false);
    const [melding, setMelding] = useState('');

    useEffect(() => {
        async function laadRenners() {
            try {
                const response = await getBeschikbareRenners();
                setRiders(response.data);
            } catch (err) {
                console.error('Fout bij ophalen renners:', err);
                setMelding('Kon renners niet laden.');
            } finally {
                setLadenRenners(false);
            }
        }

        laadRenners();
    }, []);

    async function handleKiesRenner(rennerId, naam) {
        try {
            setLoading(true);
            setMelding('');

            const response = await kiesRenner({
                spelerId: 1,
                rennerId,
                huidigeBeurt: 1
            });

            setMelding(response.data.bericht || `${naam} gekozen!`);

            setRiders((vorigeRiders) =>
                vorigeRiders.filter((rider) => rider.id !== rennerId)
            );
        } catch (err) {
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                'Fout bij kiezen van renner.'
            );
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (ladenRenners) {
        return <div>Laden van renners...</div>;
    }

    return (
        <div>
            <section className="banner card draft-board">
                <div className="banner-title">Draft Board</div>
                <div className="banner-sub">Snake Draft - Pro Peloton League</div>
                <div className="draft-order">
                    <div className="draft-slot panel">
                        <strong>You</strong>
                        <span className="yellow">Picking now</span>
                    </div>
                    <div className="draft-slot panel">
                        <strong>User 2</strong>
                        <span className="small-muted">Waiting</span>
                    </div>
                    <div className="draft-slot panel">
                        <strong>User 3</strong>
                        <span className="small-muted">Waiting</span>
                    </div>
                    <div className="draft-slot panel">
                        <strong>User 4</strong>
                        <span className="small-muted">Waiting</span>
                    </div>
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

            <div className="section-head">
                <h2>Available Riders ({riders.length})</h2>
            </div>

            <section className="riders-grid">
                {riders.map((rider) => (
                    <article key={rider.id} className="rider-card card">
                        <div className="rider-image">🚴</div>
                        <div className="rider-body">
                            <div className="rider-topline">
                                <div className="rider-name">{rider.naam}</div>
                                <div className="rider-country">-</div>
                            </div>

                            <div className="rider-team">{rider.ploeg || '-'}</div>

                            <div style={{ marginTop: '1rem' }}>
                                <button
                                    className="pill-btn"
                                    onClick={() => handleKiesRenner(rider.id, rider.naam)}
                                    disabled={loading}
                                >
                                    Kies {rider.naam}
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}