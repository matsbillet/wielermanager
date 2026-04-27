// src/pages/RitPage.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getRit, triggerScrape } from '../services/api';

export default function RitPage() {
    const { id } = useParams();
    const [rit, setRit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scrapping, setScrapping] = useState(false);

    // Helper functie om slugs (tadej-pogacar) mooi te maken (Tadej Pogacar)
    const formatName = (slug) => {
        if (!slug) return '';
        return slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const laadData = async () => {
        try {
            const res = await getRit(id);
            setRit(res.data);

            if (res.data && !res.data.gescrapet && !scrapping) {
                voerScrapeUit();
            }
        } catch (err) {
            console.error("Fout bij laden:", err);
        } finally {
            setLoading(false);
        }
    };

    const voerScrapeUit = async () => {
        setScrapping(true);
        try {
            console.log("🚀 Scraper wordt getriggerd voor rit:", id);
            await triggerScrape(id);
            const refresh = await getRit(id);
            setRit(refresh.data);
        } catch (err) {
            console.log("Scrape (nog) niet gelukt.");
        } finally {
            setScrapping(false);
        }
    };

    useEffect(() => {
        laadData();
    }, [id]);

    if (loading) return <div style={{ padding: '20px' }}>Rit laden...</div>;
    if (!rit) return <div style={{ padding: '20px' }}>Rit niet gevonden.</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>Rit {rit.rit_nummer}: {rit.naam}</h2>

            {scrapping && (
                <div style={{ padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '5px', marginBottom: '10px' }}>
                    Bezig met ophalen van live uitslagen... ⏳
                </div>
            )}

            {/* --- SECTIE: TRUIDRAGERS --- */}
            {rit.gescrapet && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                    {rit.leider_algemeen && (
                        <div style={{ background: '#ffeb3b', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', border: '1px solid #d4c400' }}>
                            <strong>🟡 Algemeen:</strong> {formatName(rit.leider_algemeen)}
                        </div>
                    )}
                    {rit.leider_punten && (
                        <div style={{ background: '#4caf50', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', color: 'white' }}>
                            <strong>🟢 Punten:</strong> {formatName(rit.leider_punten)}
                        </div>
                    )}
                    {rit.leider_berg && (
                        <div style={{ background: '#fff', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', border: '2px dashed red' }}>
                            <strong>⚪🔴 Berg:</strong> {formatName(rit.leider_berg)}
                        </div>
                    )}
                    {rit.leider_jongeren && (
                        <div style={{ background: '#fff', padding: '8px 15px', borderRadius: '20px', fontSize: '14px', border: '1px solid #ccc' }}>
                            <strong>⚪ Jong:</strong> {formatName(rit.leider_jongeren)}
                        </div>
                    )}
                </div>
            )}

            {/* --- SECTIE: DE UITSLAG --- */}
            {!rit.gescrapet && !scrapping ? (
                <div className="alert">Deze rit is nog niet gereden of uitslag is nog niet verwerkt.</div>
            ) : (
                <div className="uitslag-container">
                    <h3>Daguitslag</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #333' }}>
                                <th style={{ padding: '10px' }}>Pos</th>
                                <th style={{ padding: '10px' }}>Renner</th>
                                <th style={{ padding: '10px' }}>Punten</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rit.ritresultaten && rit.ritresultaten.length > 0 ? (
                                rit.ritresultaten.map((res, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '10px' }}>{res.positie || '-'}</td>
                                        <td style={{ padding: '10px', fontWeight: '500' }}>{res.renners?.naam}</td>
                                        <td style={{ padding: '10px' }}>
                                            <strong>{res.punten + (res.trui_punten || 0)}</strong>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>
                                        Uitslag wordt verwerkt...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}