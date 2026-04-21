import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getScoreboard, getRitten } from '../services/api';

const SPELER_KLEUREN = {
    Roel: '#e63946',
    Casper: '#2a9d8f',
    Jonas: '#e9c46a',
    Dries: '#457b9d'
};

function bouwGrafiekData(spelers) {
    if (!spelers.length) return [];

    const aantalRitten = spelers[0].per_rit.length;
    const cumulatief = {};

    return Array.from({ length: aantalRitten }, (_, i) => {
        const punt = { rit: `Rit ${i + 1}` };

        for (const speler of spelers) {
            cumulatief[speler.speler] =
                (cumulatief[speler.speler] || 0) + speler.per_rit[i].punten;
            punt[speler.speler] = cumulatief[speler.speler];
        }

        return punt;
    });
}

export default function ScoreboardPage() {
    const [scoreboard, setScoreboard] = useState([]);
    const [ritten, setRitten] = useState([]);
    const [loading, setLoading] = useState(true);

    const wedstrijdId = 'tour-2024';

    useEffect(() => {
        async function laadData() {
            try {
                const [scoreRes, rittenRes] = await Promise.all([
                    getScoreboard(wedstrijdId),
                    getRitten()
                ]);

                setScoreboard(scoreRes.data);
                setRitten(rittenRes.data);
            } catch (err) {
                console.error('Fout bij laden scorebord:', err);
            } finally {
                setLoading(false);
            }
        }

        laadData();
    }, []);

    if (loading) return <div>Laden...</div>;

    const grafiekData = bouwGrafiekData(scoreboard);

    return (
        <div>
            <h1>Scorebord</h1>

            <div>
                {scoreboard.map((speler, index) => (
                    <div key={speler.speler}>
                        #{index + 1} {speler.speler} — {speler.totaal} pts
                    </div>
                ))}
            </div>

            <h2>Verloop per rit</h2>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={grafiekData}>
                    <XAxis dataKey="rit" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {scoreboard.map((speler) => (
                        <Line
                            key={speler.speler}
                            type="monotone"
                            dataKey={speler.speler}
                            stroke={SPELER_KLEUREN[speler.speler] || '#8884d8'}
                            strokeWidth={2}
                            dot={false}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>

            <h2>Ritten</h2>
            <div>
                {ritten.map((rit) => (
                    <Link key={rit.id} to={`/rit/${rit.id}`} style={{ marginRight: '12px' }}>
                        Rit {rit.rit_nummer} {rit.gescrapet ? '' : '(Binnenkort)'}
                    </Link>
                ))}
            </div>
        </div>
    );
}