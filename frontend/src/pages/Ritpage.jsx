import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getRit } from '../services/api';

export default function RitPage() {
    const { id } = useParams();
    const [rit, setRit] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function laadRit() {
            try {
                const res = await getRit(id);
                setRit(res.data);
            } catch (err) {
                console.error('Fout bij laden rit:', err);
            } finally {
                setLoading(false);
            }
        }

        laadRit();
    }, [id]);

    if (loading) return <div>Laden...</div>;
    if (!rit) return <div>Rit niet gevonden</div>;

    return (
        <div>
            <Link to="/">← Terug naar scorebord</Link>
            <h1>Rit {rit.rit_nummer}</h1>
            <p>Winnaar: {rit.winnaar}</p>

            <h2>Truiendragers</h2>
            <ul>
                {rit.truien.map((trui) => (
                    <li key={trui.type}>
                        {trui.type}: {trui.naam}
                    </li>
                ))}
            </ul>

            <h2>Uitslag</h2>
            <table>
                <thead>
                    <tr>
                        <th>Pos</th>
                        <th>Renner</th>
                        <th>Ritpunten</th>
                        <th>Truienpunten</th>
                        <th>Totaal</th>
                    </tr>
                </thead>
                <tbody>
                    {rit.resultaten.map((r) => (
                        <tr key={`${r.positie}-${r.naam}`}>
                            <td>{r.positie}</td>
                            <td>{r.naam}</td>
                            <td>{r.rit_punten}</td>
                            <td>{r.truien_punten}</td>
                            <td>{r.rit_punten + r.truien_punten}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h2>Punten per speler</h2>
            <ul>
                {rit.speler_scores.map((s) => (
                    <li key={s.speler}>
                        {s.speler}: {s.punten} pts
                    </li>
                ))}
            </ul>
        </div>
    );
}