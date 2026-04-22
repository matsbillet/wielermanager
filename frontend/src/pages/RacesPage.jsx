import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWedstrijden } from '../services/api';

export default function RacesPage() {
    const [wedstrijden, setWedstrijden] = useState([]);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState('');

    useEffect(() => {
        async function laadWedstrijden() {
            try {
                const response = await getWedstrijden();
                setWedstrijden(response.data);
            } catch (err) {
                console.error('Fout bij ophalen wedstrijden:', err);
                setMelding('Kon wedstrijden niet laden.');
            } finally {
                setLoading(false);
            }
        }

        laadWedstrijden();
    }, []);

    if (loading) return <div>Laden van wedstrijden...</div>;

    return (
        <div>
            <div className="section-head">
                <h2>Races</h2>
            </div>

            {melding && (
                <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    {melding}
                </div>
            )}

            <section className="team-grid">
                {wedstrijden.map((wedstrijd) => (
                    <Link
                        key={wedstrijd.id}
                        to={`/races/${wedstrijd.slug}`}
                        className="card"
                        style={{
                            padding: '1.5rem',
                            textDecoration: 'none',
                            color: 'inherit'
                        }}
                    >
                        <h3 style={{ marginBottom: '0.5rem' }}>{wedstrijd.naam}</h3>
                        <p style={{ marginBottom: '0.5rem', opacity: 0.8 }}>
                            Jaar: {wedstrijd.jaar}
                        </p>
                        <p style={{ opacity: 0.8 }}>
                            Aantal ritten: {wedstrijd.aantal_ritten}
                        </p>
                    </Link>
                ))}
            </section>
        </div>
    );
}