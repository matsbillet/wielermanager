import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRit } from '../services/api';

export default function RitPage() {
    const { id } = useParams();
    const [rit, setRit] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await getRit(id);
                setRit(res.data);
            } catch (err) {
                console.error("Fout bij laden rit:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [id]);

    if (loading) return <div>Laden...</div>;
    if (!rit) return <div>Rit niet gevonden.</div>;

    return (
        <div>
            <h1>{rit.naam}</h1>
            <p>Wedstrijd: {rit.wedstrijden?.naam}</p>

            <h3>Uitslag</h3>
            <div className="uitslag-tabel">
                {/* HET CRUCIALE DEEL: 
                   Check of rit.uitslagen bestaat voordat je .map() doet 
                */}
                {rit.uitslagen && rit.uitslagen.length > 0 ? (
                    <table>
                        <thead>
                            <tr><th>Pos</th><th>Renner</th><th>Punten</th></tr>
                        </thead>
                        <tbody>
                            {rit.uitslagen.map((u) => (
                                <tr key={u.id}>
                                    <td>{u.positie}</td>
                                    <td>{u.renners?.naam}</td>
                                    <td>{u.punten}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p>Er zijn nog geen resultaten voor deze etappe gescrapet.</p>
                )}
            </div>
        </div>
    );
}