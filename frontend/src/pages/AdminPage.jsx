import React, { useEffect, useState } from 'react';
import {
    addRit,
    deleteAllDrafts,
    deleteAllRenners,
    deleteDraftById,
    deleteRenner,
    deleteRit,
    getAdminDrafts,
    getAdminRenners,
    getAdminRitten,
    getAdminWedstrijden,
    importStartlist,
    scrapeRit
} from '../services/api';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('scraper');
    const [ritten, setRitten] = useState([]);
    const [renners, setRenners] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [wedstrijden, setWedstrijden] = useState([]);
    const [loading, setLoading] = useState(false);

    const [newRit, setNewRit] = useState({ rit_nummer: '', naam: '', datum: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [resRitten, resRenners, resDrafts, resWedstrijden] = await Promise.all([
                getAdminRitten(),
                getAdminRenners(),
                getAdminDrafts(),
                getAdminWedstrijden()
            ]);

            setRitten(resRitten.data || []);
            setRenners(resRenners.data || []);
            setDrafts(resDrafts.data || []);
            setWedstrijden(resWedstrijden.data || []);

            console.log('Data succesvol ververst');
        } catch (err) {
            console.error('Fout bij ophalen data:', err);
            if (err.response?.status === 401) {
                alert('Sessie verlopen of ongeldig token. Log opnieuw in.');
            } else if (err.response?.status === 403) {
                alert('Geen toegang. Alleen admins mogen deze pagina gebruiken.');
            }
        }
    };

    const deleteDraft = async (id) => {
        if (!window.confirm('Weet je zeker dat je deze specifieke draft wilt verwijderen?')) return;

        try {
            setLoading(true);
            await deleteDraftById(id);
            await fetchData();
        } catch (err) {
            console.error('Verwijder fout:', err);
            alert('Kon niet verwijderen: ' + (err.response?.data?.error || 'Server fout'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllRenners = async () => {
        if (!window.confirm('⚠️ WEET JE DIT ZEKER? Je verwijdert alle renners uit de database!')) return;

        setLoading(true);
        try {
            await deleteAllRenners();
            alert('De deelnemerslijst is volledig leeggemaakt.');
            await fetchData();
        } catch (err) {
            console.error(err);
            alert('Fout bij het leegmaken: ' + (err.response?.data?.error || 'Serverfout'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllDrafts = async () => {
        if (!window.confirm('⚠️ WEET JE DIT ZEKER? Dit verwijdert alle gekozen teams van alle gebruikers!')) return;

        setLoading(true);
        try {
            await deleteAllDrafts();
            alert('Alle drafts zijn succesvol verwijderd.');
            await fetchData();
        } catch (err) {
            console.error(err);
            alert('Fout bij het verwijderen van drafts: ' + (err.response?.data?.error || 'Serverfout'));
        } finally {
            setLoading(false);
        }
    };

    const handleScrapeRit = async (ritId, ritNummer) => {
        setLoading(true);
        try {
            const res = await scrapeRit(ritId, ritNummer);
            alert(res.data.message || `Succes! ${res.data.count} renners verwerkt.`);
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Deze etappe is nog niet gereden.');
        } finally {
            setLoading(false);
        }
    };

    const handleImportStartlist = async () => {
        const url = prompt('Plak de URL van de PCS Startlist (bijv. /race/tour-de-france/2026/startlist):');
        if (!url) return;

        setLoading(true);
        try {
            await importStartlist(url);
            alert('Startlijst succesvol geïmporteerd!');
            await fetchData();
        } catch (err) {
            console.error(err);
            alert('Fout: ' + (err.response?.data?.error || 'Server onbereikbaar'));
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async (type, id) => {
        if (!window.confirm('Weet je dit zeker? Dit kan invloed hebben op de draft!')) return;

        try {
            setLoading(true);

            if (type === 'ritten') {
                await deleteRit(id);
            } else if (type === 'renners') {
                await deleteRenner(id);
            }

            await fetchData();
        } catch (err) {
            alert('Verwijderen mislukt. Mogelijk is dit item gekoppeld aan een draft.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRit = async () => {
        try {
            setLoading(true);
            await addRit(newRit);
            setNewRit({ rit_nummer: '', naam: '', datum: '' });
            await fetchData();
        } catch (err) {
            console.error(err);
            alert('Kon rit niet toevoegen: ' + (err.response?.data?.error || 'Serverfout'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-container" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div className="section-head">
                <h1>Admin Dashboard</h1>
                <div className="tab-menu" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button className={`pill-btn ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => setActiveTab('scraper')}>
                        🚀 Scraper
                    </button>
                    <button className={`pill-btn ${activeTab === 'renners' ? 'active' : ''}`} onClick={() => setActiveTab('renners')}>
                        🚴 Renners
                    </button>
                    <button className={`pill-btn ${activeTab === 'ritten' ? 'active' : ''}`} onClick={() => setActiveTab('ritten')}>
                        📅 Ritten
                    </button>
                    <button className={`pill-btn ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>
                        📝 Drafts
                    </button>
                </div>
            </div>

            {loading && <div className="loader">Bezig met verwerken... ⏳</div>}

            {activeTab === 'scraper' && (
                <section className="panel card">
                    <h3>Automatische Rit Scraper</h3>
                    <p className="muted">De scraper zoekt automatisch naar de uitslag op basis van het ritnummer.</p>

                    <div style={{ marginBottom: '20px' }}>
                        <button className="pill-btn" onClick={handleImportStartlist} disabled={loading}>
                            Startlijst importeren
                        </button>
                    </div>

                    <div className="admin-list">
                        {ritten
                            .slice()
                            .sort((a, b) => a.rit_nummer - b.rit_nummer)
                            .map((rit) => (
                                <div
                                    key={rit.id}
                                    className="admin-row panel"
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '10px',
                                        borderBottom: '1px solid #eee'
                                    }}
                                >
                                    <span>
                                        <strong>Rit {rit.rit_nummer}</strong>: {rit.naam || 'Etappe'}
                                    </span>
                                    <div>
                                        <span style={{ marginRight: '15px', color: rit.gescrapet ? 'green' : 'orange' }}>
                                            {rit.gescrapet ? '✅ Gescrapet' : '⏳ Open'}
                                        </span>
                                        <button
                                            className="pill-btn"
                                            onClick={() => handleScrapeRit(rit.id, rit.rit_nummer)}
                                            disabled={loading}
                                        >
                                            {rit.gescrapet ? 'Re-scrape' : 'Scrape Rit'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                </section>
            )}

            {activeTab === 'renners' && (
                <section className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Renners ({renners ? renners.length : 0})</h3>
                        <button
                            className="pill-btn"
                            onClick={handleDeleteAllRenners}
                            style={{ backgroundColor: '#f44336', color: 'white' }}
                        >
                            🗑️ Alle Renners Verwijderen
                        </button>
                    </div>

                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table width="100%">
                            <thead>
                                <tr>
                                    <th>Naam</th>
                                    <th>Ploeg</th>
                                    <th>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renners && renners.length > 0 ? (
                                    renners.map((r) => (
                                        <tr key={r.id}>
                                            <td>{r.naam}</td>
                                            <td>{r.ploeg || '-'}</td>
                                            <td>
                                                <button onClick={() => deleteItem('renners', r.id)}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3">Geen renners gevonden of niet geautoriseerd.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'ritten' && (
                <section className="panel card">
                    <h3>Etappes Beheren</h3>

                    <div className="add-form" style={{ marginBottom: '20px', display: 'flex', gap: '5px' }}>
                        <input
                            type="number"
                            placeholder="Rit nr"
                            value={newRit.rit_nummer}
                            onChange={(e) => setNewRit({ ...newRit, rit_nummer: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Naam (vlak, berg...)"
                            value={newRit.naam}
                            onChange={(e) => setNewRit({ ...newRit, naam: e.target.value })}
                        />
                        <input
                            type="date"
                            value={newRit.datum}
                            onChange={(e) => setNewRit({ ...newRit, datum: e.target.value })}
                        />
                        <button onClick={handleAddRit}>+</button>
                    </div>

                    <table style={{ width: '100%', textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th>Nr</th>
                                <th>Naam</th>
                                <th>Datum</th>
                                <th>Actie</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ritten.map((rit) => (
                                <tr key={rit.id}>
                                    <td>{rit.rit_nummer}</td>
                                    <td>{rit.naam}</td>
                                    <td>{rit.datum}</td>
                                    <td>
                                        <button
                                            onClick={() => deleteItem('ritten', rit.id)}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {activeTab === 'drafts' && (
                <section className="panel card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Actieve Drafts ({drafts.length})</h3>
                        <button
                            className="pill-btn"
                            onClick={handleDeleteAllDrafts}
                            style={{ backgroundColor: '#f44336', color: 'white' }}
                        >
                            🗑️ Alles Leegmaken
                        </button>
                    </div>

                    <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <table style={{ width: '100%', textAlign: 'left' }}>
                            <thead>
                                <tr>
                                    <th>Gebruiker</th>
                                    <th>Renner</th>
                                    <th>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {drafts.length > 0 ? (
                                    drafts.map((d) => (
                                        <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td>{d.speler_id || d.user_id || d.username || 'Onbekend'}</td>
                                            <td>{d.renners?.naam || `ID: ${d.renner_id} (naam niet gevonden)`}</td>
                                            <td>
                                                <button
                                                    onClick={() => deleteDraft(d.id)}
                                                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3">Geen drafts gevonden.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}