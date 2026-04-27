import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWedstrijden } from '../services/api';

/* 🔥 JUISTE imports */
import giroImg from '../img/amandine-veyron-AH7hRkXMF0E-unsplash.jpg';
import tourImg from '../img/chris-karidis-nnzkZNYWHaU-unsplash.jpg';
import vueltaImg from '../img/dimitry-b-uDl5opHop7E-unsplash.jpg';

const raceImages = {
    'giro-ditalia': giroImg,
    'giro-italia': giroImg,

    'tour-de-france': tourImg,
    'tourdefrance': tourImg,

    'vuelta-a-espana': vueltaImg,
    'vuelta-espana': vueltaImg
};

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

    if (loading) {
        return <div className="loading">Laden van wedstrijden...</div>;
    }

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
                {wedstrijden.map((wedstrijd) => {
                    const imageSrc =
                        raceImages[wedstrijd.slug] || giroImg;

                    return (
                        <Link
                            key={wedstrijd.id}
                            to={`/races/${wedstrijd.slug}`}
                            className="race-card card"
                        >
                            <div className="race-card-image">
                                <img src={imageSrc} alt={wedstrijd.naam} />
                            </div>

                            <div className="race-card-body">
                                <h3>{wedstrijd.naam}</h3>
                                <p>Jaar: {wedstrijd.jaar}</p>
                                <p>Aantal ritten: {wedstrijd.aantal_ritten}</p>
                            </div>
                        </Link>
                    );
                })}
            </section>
        </div>
    );
}