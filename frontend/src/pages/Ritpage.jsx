// src/pages/RitPage.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRit, triggerScrape } from '../services/api';

export default function RitPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [rit, setRit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scrapping, setScrapping] = useState(false);
    const [statusMsg, setStatusMsg] = useState("");
    const [progress, setProgress] = useState(0);

    const formatName = (slug) => {
        if (!slug) return '';
        return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const laadData = async () => {
        try {
            const res = await getRit(id);
            setRit(res.data);

            if (res.data && !res.data.gescrapet && !scrapping) {
                const isLocked = localStorage.getItem(`scraping_active_${id}`);
                if (!isLocked) {
                    voerScrapeUit();
                }
            }
        } catch (err) {
            console.error("Fout bij laden:", err);
        } finally {
            setLoading(false);
        }
    };

    const voerScrapeUit = async () => {
        if (scrapping) return;

        setScrapping(true);
        localStorage.setItem(`scraping_active_${id}`, "true");
        setProgress(5);
        setStatusMsg("Peloton vertrekt voor de uitslag-rit...");

        try {
            triggerScrape(id).catch(err => {
                if (err.response?.status === 429) {
                    console.warn("Backend lock actief, we wachten op de resultaten...");
                }
            });

            const fakeProgress = setInterval(() => {
                setProgress(prev => (prev < 40 ? prev + 1 : prev));
            }, 400);

            let dataGevonden = false;
            let pogingen = 0;
            const maxPogingen = 25;
            let vorigAantal = 0;

            while (!dataGevonden && pogingen < maxPogingen) {
                pogingen++;
                const refresh = await getRit(id);
                const huidigAantal = refresh.data?.ritresultaten?.length || 0;

                // We kijken of er tenminste één renner is die truipunten heeft (indien van toepassing)
                // Dit zorgt ervoor dat we niet stoppen voordat de trui-update klaar is
                const heeftTruiPunten = refresh.data?.ritresultaten?.some(res => res.trui_punten > 0);

                if (huidigAantal >= 20 && (heeftTruiPunten || pogingen > 10)) {
                    clearInterval(fakeProgress);
                    setRit(refresh.data);
                    dataGevonden = true;
                    setProgress(100);

                    const isLaatsteRit = refresh.data.rit_nummer === refresh.data.wedstrijden?.aantal_ritten;
                    if (isLaatsteRit) {
                        setStatusMsg("🏁 Tour voltooid! Volgend jaar wordt voorbereid... 🏆");
                        await new Promise(r => setTimeout(r, 2000));
                    } else {
                        setStatusMsg("🏁 Finish bereikt! Uitslag volledig geladen.");
                    }
                } else {
                    vorigAantal = huidigAantal;
                    setProgress(prev => (prev < 90 ? prev + 3 : prev));
                    setStatusMsg(`Uitslag en truipunten verwerken... (${huidigAantal} renners)`);
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            setTimeout(() => {
                setScrapping(false);
                localStorage.removeItem(`scraping_active_${id}`);
            }, 1500);

        } catch (err) {
            console.error("Kritieke fout:", err);
            setStatusMsg("Er ging iets mis. Herstart de pagina.");
            setScrapping(false);
            localStorage.removeItem(`scraping_active_${id}`);
        }
    };

    useEffect(() => {
        laadData();
        return () => localStorage.removeItem(`scraping_active_${id}`);
    }, [id]);

    if (loading) return <div style={{ color: '#fff', padding: '40px', textAlign: 'center' }}>Rit inladen...</div>;
    if (!rit) return <div style={{ color: '#fff', padding: '40px', textAlign: 'center' }}>Rit niet gevonden.</div>;

    return (
        <div className="rit-container">
            <button onClick={() => navigate('/races')} className="back-button">
                ⬅ Terug naar Koersen
            </button>

            {scrapping && (
                <div className="scrape-overlay">
                    <div className="loader-content">
                        <div className="bike-animation">
                            <span className="bike-emoji">🚴‍♂️💨</span>
                        </div>
                        {/* Extra trofee animatie als de tour voltooid is */}
                        {statusMsg.includes("voltooid") && (
                            <div style={{ fontSize: '2.5rem', marginBottom: '10px', animation: 'fadeIn 0.5s' }}>🏆</div>
                        )}
                        <div className="loading-bar-container">
                            <div className="loading-bar-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <p className="status-text">{statusMsg}</p>
                    </div>
                </div>
            )}

            <div className={`content-wrapper ${scrapping ? 'is-loading' : 'fade-in'}`}>
                <header className="rit-header">
                    <h1>Rit {rit.rit_nummer}: <span className="rit-naam">{rit.naam}</span></h1>
                </header>

                {rit.gescrapet && (
                    <div className="jersey-row">
                        {rit.leider_algemeen && <div className="jersey yellow"><b>🟡 Algemeen:</b> {formatName(rit.leider_algemeen)}</div>}
                        {rit.leider_punten && <div className="jersey green"><b>🟢 Punten:</b> {formatName(rit.leider_punten)}</div>}
                        {rit.leider_berg && <div className="jersey polka"><b>🔴 Berg:</b> {formatName(rit.leider_berg)}</div>}
                        {rit.leider_jongeren && <div className="jersey white"><b>⚪ Jong:</b> {formatName(rit.leider_jongeren)}</div>}
                    </div>
                )}

                <section className="results-section">
                    <div className="table-card">
                        <h3>Daguitslag</h3>
                        <table className="results-table">
                            <thead>
                                <tr>
                                    <th>Pos</th>
                                    <th>Renner</th>
                                    <th>Punten</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rit.ritresultaten?.length > 0 ? (
                                    rit.ritresultaten.map((res, i) => (
                                        <tr key={i}>
                                            <td className="pos-cell">{res.positie || '-'}</td>
                                            <td className="name-cell">{res.renners?.naam}</td>
                                            <td className="points-cell">{res.punten + (res.trui_punten || 0)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="empty-cell">
                                            {scrapping ? "Gegevens aan het laden..." : "Nog geen uitslag verwerkt."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            <style>{`
                .rit-container { padding: 20px; max-width: 900px; margin: 0 auto; color: #fff; min-height: 100vh; }
                .back-button { background: none; border: 1px solid #444; color: #aaa; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
                .back-button:hover { border-color: #22d3ee; color: #22d3ee; background: rgba(34, 211, 238, 0.1); }
                .rit-naam { color: #22d3ee; }
                .scrape-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0a0a0a; display: flex; justify-content: center; align-items: center; z-index: 9999; }
                .loader-content { text-align: center; width: 80%; max-width: 450px; }
                .status-text { color: #22d3ee; font-family: monospace; margin-top: 20px; min-height: 20px; font-weight: bold; }
                .bike-animation { font-size: 3.5rem; margin-bottom: 20px; width: 100%; overflow: hidden; position: relative; height: 80px; }
                .bike-emoji { position: absolute; animation: driveRight 2.2s infinite linear; left: -100px; display: inline-block; transform: scaleX(-1); }
                @keyframes driveRight { 0% { left: -20%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: 110%; opacity: 0; } }
                .loading-bar-container { width: 100%; height: 10px; background: #1a1a1a; border-radius: 20px; overflow: hidden; border: 1px solid #333; }
                .loading-bar-fill { height: 100%; background: linear-gradient(90deg, #22d3ee, #00ff00); transition: width 0.4s ease; }
                .is-loading { opacity: 0.1; pointer-events: none; filter: blur(2px); }
                .fade-in { animation: fadeIn 0.5s forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .jersey-row { display: flex; gap: 10px; margin-bottom: 30px; flex-wrap: wrap; }
                .jersey { padding: 10px 18px; border-radius: 50px; font-size: 14px; color: #000; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
                .yellow { background: #ffd700; } .green { background: #2e8b57; color: #fff; }
                .polka { background: #fff; border: 2px dashed red; } .white { background: #fff; border: 1px solid #ddd; }
                .table-card { background: #161616; border-radius: 12px; padding: 25px; border: 1px solid #222; }
                .results-table { width: 100%; border-collapse: collapse; }
                .results-table th { text-align: left; padding: 15px; border-bottom: 2px solid #22d3ee; color: #888; font-size: 0.8rem; text-transform: uppercase; }
                .results-table td { padding: 15px; border-bottom: 1px solid #222; }
                .pos-cell { color: #22d3ee; font-weight: bold; width: 60px; }
                .points-cell { text-align: right; font-weight: bold; }
                .empty-cell { text-align: center; padding: 40px; color: #444; font-style: italic; }
            `}</style>
        </div>
    );
}