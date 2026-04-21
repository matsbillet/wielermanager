import { Link, useParams } from 'react-router-dom';

const uitslag = [
    { positie: 1, naam: 'Tadej Pogačar', punten: 100, trui: '+10', totaal: 110 },
    { positie: 2, naam: 'Jonas Vingegaard', punten: 80, trui: '-', totaal: 80 },
    { positie: 3, naam: 'Remco Evenepoel', punten: 65, trui: '+10', totaal: 75 },
    { positie: 4, naam: 'Jasper Philipsen', punten: 55, trui: '-', totaal: 55 }
];

export default function RitPage() {
    const { id } = useParams();

    return (
        <div>
            <div className="section-head">
                <h2>Rit {id}</h2>
                <Link className="section-link" to="/">← Terug naar scorebord</Link>
            </div>

            <section className="banner card">
                <div className="banner-title">Rit {id} overzicht</div>
                <div className="banner-sub">Top 25, truiendragers en puntenverdeling</div>
                <div className="progress-track"><div className="progress-fill" style={{ width: '100%' }} /></div>
            </section>

            <section className="panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                <div className="section-head" style={{ marginTop: 0 }}><h2>Truiendragers</h2></div>
                <div className="team-grid">
                    <article className="card stat-card"><div className="stat-label">Algemeen</div><div className="rider-name">Tadej Pogačar</div></article>
                    <article className="card stat-card"><div className="stat-label">Sprint</div><div className="rider-name">Jasper Philipsen</div></article>
                    <article className="card stat-card"><div className="stat-label">Berg</div><div className="rider-name">Jonas Vingegaard</div></article>
                    <article className="card stat-card"><div className="stat-label">Jongeren</div><div className="rider-name">Remco Evenepoel</div></article>
                </div>
            </section>

            <section className="panel" style={{ padding: '0 0 1rem', overflowX: 'auto' }}>
                <table className="table">
                    <thead>
                        <tr><th>Pos</th><th>Renner</th><th>Punten</th><th>Truien</th><th>Totaal</th></tr>
                    </thead>
                    <tbody>
                        {uitslag.map((row) => (
                            <tr key={row.positie}>
                                <td>{row.positie}</td>
                                <td>{row.naam}</td>
                                <td>{row.punten}</td>
                                <td>{row.trui}</td>
                                <td><strong>{row.totaal}</strong></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}