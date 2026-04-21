const ritten = Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1),
    rit_nummer: index + 1,
    gescrapet: index < 5
}));

export default function AdminPage() {
    return (
        <div>
            <div className="section-head">
                <h2>Admin</h2>
            </div>

            <section className="banner card">
                <div className="banner-title">Admin — scraping beheer</div>
                <div className="banner-sub">Gebruik dit om ritten te scrapen zodra de uitslag beschikbaar is.</div>
            </section>

            <section className="admin-list">
                {ritten.map((rit) => (
                    <div key={rit.id} className="admin-row panel">
                        <div>
                            <div className="rider-name">Rit {rit.rit_nummer}</div>
                            <div className="muted">Status: {rit.gescrapet ? 'gescrapet' : 'wacht op scraping'}</div>
                        </div>
                        <button className="pill-btn" disabled={rit.gescrapet} style={{ opacity: rit.gescrapet ? 0.5 : 1 }}>
                            {rit.gescrapet ? 'Klaar' : 'Scrape'}
                        </button>
                    </div>
                ))}
            </section>
        </div>
    );
}