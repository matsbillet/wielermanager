import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';

const spelers = [
    {
        id: 1,
        naam: 'Dylan',
        kleur: '#00e5c7',
        totaal: 265,
        ritten: [
            { rit: 1, punten: 45 },
            { rit: 2, punten: 60 },
            { rit: 3, punten: 35 },
            { rit: 4, punten: 80 },
            { rit: 5, punten: 45 }
        ]
    },
    {
        id: 2,
        naam: 'Pancho',
        kleur: '#ffc400',
        totaal: 220,
        ritten: [
            { rit: 1, punten: 30 },
            { rit: 2, punten: 70 },
            { rit: 3, punten: 40 },
            { rit: 4, punten: 50 },
            { rit: 5, punten: 30 }
        ]
    },
    {
        id: 3,
        naam: 'Roel',
        kleur: '#ff4d4d',
        totaal: 185,
        ritten: [
            { rit: 1, punten: 20 },
            { rit: 2, punten: 55 },
            { rit: 3, punten: 25 },
            { rit: 4, punten: 40 },
            { rit: 5, punten: 45 }
        ]
    }
];

function maakGrafiekData(spelers) {
    const maxRitten = Math.max(...spelers.map((speler) => speler.ritten.length));

    return Array.from({ length: maxRitten }, (_, index) => {
        const ritNummer = index + 1;
        const punt = { rit: `Rit ${ritNummer}` };

        spelers.forEach((speler) => {
            const totaalTotNu = speler.ritten
                .filter((rit) => rit.rit <= ritNummer)
                .reduce((som, rit) => som + rit.punten, 0);

            punt[speler.naam] = totaalTotNu;
        });

        return punt;
    });
}

export default function ScoreboardPage() {
    const grafiekData = maakGrafiekData(spelers);
    const klassement = [...spelers].sort((a, b) => b.totaal - a.totaal);
    const aantalRitten = Math.max(...spelers.map((speler) => speler.ritten.length));

    return (
        <div className="scoreboard-page">
            <section className="scoreboard-header">
                <div>
                    <h1>Scoreboard</h1>
                    <p>Overzicht van alle spelers, ritpunten en totaalstand.</p>
                </div>

                <div className="scoreboard-summary">
                    <span>{spelers.length} spelers</span>
                    <strong>{aantalRitten} ritten</strong>
                </div>
            </section>

            <section className="card scoreboard-chart-card">
                <div className="section-head">
                    <h2>Puntenverloop per rit</h2>
                </div>

                <div className="scoreboard-chart">
                    <ResponsiveContainer width="100%" height={360}>
                        <LineChart data={grafiekData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="rit" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {spelers.map((speler) => (
                                <Line
                                    key={speler.id}
                                    type="monotone"
                                    dataKey={speler.naam}
                                    stroke={speler.kleur}
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 7 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="scoreboard-grid">
                <div className="card klassement-card">
                    <div className="section-head">
                        <h2>Algemeen klassement</h2>
                    </div>

                    <div className="klassement-list">
                        {klassement.map((speler, index) => (
                            <div key={speler.id} className="klassement-row">
                                <div className="rank">#{index + 1}</div>

                                <div className="player-info">
                                    <span
                                        className="player-dot"
                                        style={{ backgroundColor: speler.kleur }}
                                    />
                                    <strong>{speler.naam}</strong>
                                </div>

                                <div className="player-total">
                                    {speler.totaal} pts
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card ritpunten-card">
                    <div className="section-head">
                        <h2>Punten per rit</h2>
                    </div>

                    <div className="ritpunten-table-wrapper">
                        <table className="ritpunten-table">
                            <thead>
                                <tr>
                                    <th>Speler</th>
                                    {Array.from({ length: aantalRitten }, (_, i) => (
                                        <th key={i}>Rit {i + 1}</th>
                                    ))}
                                    <th>Totaal</th>
                                </tr>
                            </thead>

                            <tbody>
                                {klassement.map((speler) => (
                                    <tr key={speler.id}>
                                        <td>
                                            <span
                                                className="player-dot"
                                                style={{ backgroundColor: speler.kleur }}
                                            />
                                            {speler.naam}
                                        </td>

                                        {Array.from({ length: aantalRitten }, (_, i) => {
                                            const rit = speler.ritten.find(
                                                (r) => r.rit === i + 1
                                            );

                                            return (
                                                <td key={i}>
                                                    {rit ? `${rit.punten}` : '-'}
                                                </td>
                                            );
                                        })}

                                        <td>
                                            <strong>{speler.totaal}</strong>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
}