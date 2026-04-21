import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPage() {
    const [ritten, setRitten] = useState([]);
    const [loading, setLoading] = useState(true);
    const [urls, setUrls] = useState({}); // Om de URL per rit bij te houden

    // 1. Haal de ritten op uit de database bij het laden van de pagina
    useEffect(() => {
        fetchRitten();
    }, []);

    const fetchRitten = async () => {
        try {
            const response = await axios.get('http://localhost:3000/api/admin/ritten');
            setRitten(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Fout bij ophalen ritten:", error);
            setLoading(false);
        }
    };

    // 2. De functie die de scraper in de backend triggert
    const handleScrape = async (ritId) => {
        const url = urls[ritId];
        if (!url) return alert("Plak eerst een ProCyclingStats URL!");

        try {
            const response = await axios.post('http://localhost:3000/api/admin/scrape-rit', {
                ritId: ritId,
                url: url
            });

            if (response.data.success) {
                alert(`Succes! ${response.data.count} resultaten verwerkt.`);
                fetchRitten(); // Ververs de lijst om de nieuwe status te zien
            }
        } catch (error) {
            alert("Er ging iets mis bij het scrapen: " + error.response?.data?.error);
        }
    };

    const handleUrlChange = (ritId, value) => {
        setUrls(prev => ({ ...prev, [ritId]: value }));
    };

    if (loading) return <div>Laden...</div>;

    return (
        <div>
            <div className="section-head">
                <h2>Admin</h2>
            </div>

            <section className="banner card">
                <div className="banner-title">Admin — scraping beheer</div>
                <div className="banner-sub">Plak de PCS uitslag URL en klik op Scrape.</div>
            </section>

            <section className="admin-list">
                {ritten.map((rit) => (
                    <div key={rit.id} className="admin-row panel" style={{ marginBottom: '10px', padding: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <div className="rider-name">Rit {rit.rit_nummer}</div>
                            <div className="muted" style={{ color: rit.gescrapet ? '#4caf50' : '#ffa000' }}>
                                Status: {rit.gescrapet ? '✅ Voltooid' : '⏳ Wacht op scraping'}
                            </div>
                        </div>

                        {!rit.gescrapet && (
                            <input
                                type="text"
                                placeholder="Plak PCS URL..."
                                className="pill-input" // Zorg dat je deze styling in je CSS hebt
                                style={{ marginRight: '10px', padding: '5px 10px', borderRadius: '20px', border: '1px solid #ccc' }}
                                onChange={(e) => handleUrlChange(rit.id, e.target.value)}
                            />
                        )}

                        <button
                            className="pill-btn"
                            onClick={() => handleScrape(rit.id)}
                            disabled={rit.gescrapet}
                            style={{ opacity: rit.gescrapet ? 0.5 : 1 }}
                        >
                            {rit.gescrapet ? 'Klaar' : 'Scrape'}
                        </button>
                    </div>
                ))}
            </section>
        </div>
    );
}