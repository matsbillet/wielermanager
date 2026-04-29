import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRittenVanWedstrijd, syncStartlijst } from '../services/api'; // Zorg dat syncStartlijst in je api.js staat

export default function RaceDetailPage() {
    const { slug } = useParams();
    const [wedstrijdData, setWedstrijdData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false); // State voor de knop
    const [melding, setMelding] = useState('');

    useEffect(() => {
        async function laadRitten() {
            try {
                const response = await getRittenVanWedstrijd(slug);
                setWedstrijdData(response.data);
            } catch (err) {
                console.error('Fout bij ophalen ritten:', err);
                setMelding('Kon ritten van deze wedstrijd niet laden.');
            } finally {
                setLoading(false);
            }
        }

        laadRitten();
    }, [slug]);

    // De functie die de scraper aanstuurt via de backend
    async function handleSyncStartlist() {
        if (!wedstrijdData?.wedstrijd?.id) return;

        const bevestig = window.confirm(
            `Wil je de startlijst voor ${wedstrijdData.wedstrijd.naam} ophalen of bijwerken via ProCyclingStats?`
        );
        if (!bevestig) return;

        setSyncing(true);
        setMelding('');
        try {
            // We sturen het ID van de wedstrijd naar de nieuwe backend route
            await syncStartlijst(wedstrijdData.wedstrijd.id);
            setMelding('✅ Startlijst succesvol gesynchroniseerd!');
        } catch (err) {
            console.error('Sync fout:', err);
            setMelding('❌ Fout bij het ophalen van de startlijst. Probeer het later opnieuw.');
        } finally {
            setSyncing(false);
        }
    }

    if (loading) return <div>Laden van ritten...</div>;

    if (!wedstrijdData) {
        return <div>Geen wedstrijdgegevens gevonden.</div>;
    }

    const { wedstrijd, ritten } = wedstrijdData;

    return (
        <div>
            <div className="section-head">
                <h2>{wedstrijd.naam}</h2>
                <Link className="section-link" to="/races">
                    ← Terug naar races
                </Link>
            </div>

            {melding && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: melding.includes('✅') ? 'rgba(34, 211, 238, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderLeft: `4px solid ${melding.includes('✅') ? '#22d3ee' : '#ef4444'}`,
                    borderRadius: '4px'
                }}>
                    {melding}
                </div>
            )}

            <section className="banner card">
                <div className="banner-title">{wedstrijd.naam}</div>
                <div className="banner-sub">
                    Jaar: {wedstrijd.jaar} • {wedstrijd.aantal_ritten} ritten
                </div>

                {/* De nieuwe Sync Knop */}
                <div style={{ marginTop: '1.5rem' }}>
                    <button
                        onClick={handleSyncStartlist}
                        className="pill-btn"
                        disabled={syncing}
                        style={{
                            backgroundColor: syncing ? '#475569' : '#22d3ee',
                            color: '#0f172a',
                            fontWeight: 'bold',
                            cursor: syncing ? 'not-allowed' : 'pointer',
                            opacity: syncing ? 0.7 : 1
                        }}
                    >
                        {syncing ? "⏳ Bezig met ophalen..." : "🔄 Importeer Startlijst van PCS"}
                    </button>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.7 }}>
                        Gebruik deze knop om alle renners in de database te laden zodra de startlijst op PCS bekend is.
                    </p>
                </div>
            </section>

            <div className="section-head">
                <h2>Ritten</h2>
            </div>

            <section className="rit-grid">
                {ritten.map((rit) => (
                    <Link
                        key={rit.id}
                        to={`/rit/${rit.id}`}
                        className={`rit-link ${rit.gescrapet ? '' : 'pending'}`}
                    >
                        Rit {rit.rit_nummer}
                    </Link>
                ))}
            </section>
        </div>
    );
}