import { useEffect, useState } from 'react';
import { getBeschikbareRenners, getSpelers, kiesRenner } from '../services/api';

export default function DraftPage() {
    const [riders, setRiders] = useState([]);
    const [spelers, setSpelers] = useState([]);
    const [ladenPagina, setLadenPagina] = useState(true);
    const [loading, setLoading] = useState(false);
    const [melding, setMelding] = useState('');

    // Tijdelijk nog hardcoded tot jullie draft-status ook uit backend komt
    const huidigeBeurt = 1;
    const actieveSpelerId = 1;

    useEffect(() => {
        async function laadData() {
            try {
                const [rennersResponse, spelersResponse] = await Promise.all([
                    getBeschikbareRenners(),
                    getSpelers()
                ]);

                setRiders(rennersResponse.data);
                setSpelers(spelersResponse.data);
            } catch (err) {
                console.error('Fout bij ophalen draft data:', err);
                setMelding('Kon draft data niet laden.');
            } finally {
                setLadenPagina(false);
            }
        }

        laadData();
    }, []);

    async function handleKiesRenner(rennerId, naam) {
        try {
            setLoading(true);
            setMelding('');

            const response = await kiesRenner({
                spelerId: actieveSpelerId,
                rennerId,
                huidigeBeurt
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

    if (ladenPagina) {
        return <div>Laden van draft data...</div>;
    }

    return (
        <div>
            <section className="banner card draft-board">
                <div className="banner-title">Draft Board</div>
                <div className="banner-sub">Snake Draft - Pro Peloton League</div>

                <div className="draft-order">
                    {spelers.map((speler) => (
                        <div key={speler.id} className="draft-slot panel">
                            <strong>{speler.naam}</strong>
                            <span className={speler.id === actieveSpelerId ? 'yellow' : 'small-muted'}>
                                {speler.id === actieveSpelerId ? 'Picking now' : 'Waiting'}
                            </span>
                        </div>
                    ))}
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