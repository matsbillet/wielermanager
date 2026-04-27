import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRittenVanWedstrijd } from '../services/api';
import { getRit } from '../services/api';

export default function RaceDetailPage() {
    const { slug } = useParams();
    const [wedstrijdData, setWedstrijdData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [melding, setMelding] = useState('');

    useEffect(() => {
        async function laadRitten() {
            try {
                const response = await getRittenVanWedstrijd(slug);
                console.log("Data van server:", response.data); // <--- Check je F12 console!
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
                <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    {melding}
                </div>
            )}

            <section className="banner card">
                <div className="banner-title">{wedstrijd.naam}</div>
                <div className="banner-sub">
                    Jaar: {wedstrijd.jaar} • {wedstrijd.aantal_ritten} ritten
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