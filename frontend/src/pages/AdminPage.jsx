import React, { useEffect, useState, useMemo } from 'react';
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

    // Filter state voor de ritten/scraper tab
    const [selectedWedstrijd, setSelectedWedstrijd] = useState('');

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

    // Filter logica voor ritten per wedstrijd
    const gefilterdeRitten = useMemo(() => {
        if (!selectedWedstrijd) return ritten;
        return ritten.filter(rit => Number(rit.wedstrijd_id) === Number(selectedWedstrijd));
    }, [ritten, selectedWedstrijd]);

    const deleteDraft = async (id) => {
        if (!window.confirm('Weet je zeker dat je deze specifieke draft wilt verwijderen?')) return;
        try {
            setLoading(true);
            await deleteDraftById(id);
            await fetchData();
        } catch (err) {
            alert('Kon niet verwijderen.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllRenners = async () => {
        if (!window.confirm('⚠️ WEET JE DIT ZEKER? Je verwijdert alle renners uit de database!')) return;
        setLoading(true);
        try {
            await deleteAllRenners();
            await fetchData();
        } catch (err) {
            alert('Fout bij het leegmaken.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllDrafts = async () => {
        if (!window.confirm('⚠️ WEET JE DIT ZEKER?')) return;
        setLoading(true);
        try {
            await deleteAllDrafts();
            await fetchData();
        } catch (err) {
            alert('Fout bij het verwijderen van drafts.');
        } finally {
            setLoading(false);
        }
    };

    const handleScrapeRit = async (ritId, ritNummer) => {
        setLoading(true);
        try {
            const res = await scrapeRit(ritId, ritNummer);
            alert(res.data.message || `Succes!`);
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Deze etappe is nog niet gereden.');
        } finally {
            setLoading(false);
        }
    };

    const handleImportStartlist = async () => {
        if (!wedstrijden || wedstrijden.length === 0) {
            alert('Geen wedstrijden gevonden.');
            return;
        }
        const wedstrijdenLijst = wedstrijden
            .map((w) => `${w.id}: ${w.naam} ${w.jaar}`)
            .join('\n');

        const wedstrijdId = prompt(`Kies wedstrijd ID:\n\n${wedstrijdenLijst}`);
        if (!wedstrijdId) return;

        const url = prompt(`Plak de PCS Startlist URL:`);
        if (!url) return;

        setLoading(true);
        try {
            await importStartlist(url, Number(wedstrijdId));
            alert('Startlijst succesvol geïmporteerd!');
            await fetchData();
        } catch (err) {
            alert('Fout bij import.');
        } finally {
            setLoading(false);
        }
    };

    const deleteItem = async (type, id) => {
        if (!window.confirm('Weet je dit zeker?')) return;
        try {
            setLoading(true);
            if (type === 'ritten') await deleteRit(id);
            else if (type === 'renners') await deleteRenner(id);
            await fetchData();
        } catch (err) {
            alert('Verwijderen mislukt.');
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
            alert('Kon rit niet toevoegen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-shell admin-page">
            <div className="section-head">
                <h1>Admin Dashboard</h1>
                <div className="tab-menu">
                    <button className={`pill-btn ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => setActiveTab('scraper')}>🚀 Scraper</button>
                    <button className={`pill-btn ${activeTab === 'renners' ? 'active' : ''}`} onClick={() => setActiveTab('renners')}>🚴 Renners</button>
                    <button className={`pill-btn ${activeTab === 'ritten' ? 'active' : ''}`} onClick={() => setActiveTab('ritten')}>📅 Ritten</button>
                    <button className={`pill-btn ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>📝 Drafts</button>
                </div>
            </div>

            {loading && <div className="loading">Bezig met verwerken... ⏳</div>}

            {activeTab === 'scraper' && (
                <section className="panel card">
                    <div className="admin-header-flex">
                        <div>
                            <h3>Automatische Rit Scraper</h3>
                            <p className="small-muted">De uitslag wordt gezocht op basis van het ritnummer.</p>
                        </div>
                        <div className="filter-group">
                            <label style={{ marginRight: '10px', fontSize: '14px' }}>Tour Filter:</label>
                            <select
                                className="admin-select-custom"
                                value={selectedWedstrijd}
                                onChange={(e) => setSelectedWedstrijd(e.target.value)}
                            >
                                <option value="">Alle Wedstrijden</option>
                                {wedstrijden.map(w => (
                                    <option key={w.id} value={w.id}>{w.naam} ({w.jaar})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="admin-list">
                        {gefilterdeRitten
                            .slice()
                            .sort((a, b) => a.rit_nummer - b.rit_nummer)
                            .map((rit) => (
                                <div key={rit.id} className="admin-row list-row-admin">
                                    <span><strong>Rit {rit.rit_nummer}</strong>: {rit.naam || 'Etappe'}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span className={`status-pill ${rit.gescrapet ? 'done' : 'open'}`}>
                                            {rit.gescrapet ? '✅ Gescrapet' : '⏳ Open'}
                                        </span>
                                        <button className="pill-btn" onClick={() => handleScrapeRit(rit.id, rit.rit_nummer)} disabled={loading}>
                                            {rit.gescrapet ? 'Re-scrape' : 'Scrape Rit'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        {gefilterdeRitten.length === 0 && <div className="empty-state">Geen ritten gevonden voor deze tour.</div>}
                    </div>
                </section>
            )}

            {activeTab === 'renners' && (
                <section className="card">
                    <div className="admin-header-flex" style={{ marginBottom: '20px' }}>
                        <h3>Renners ({renners.length})</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="pill-btn" onClick={handleImportStartlist}>Importeer Startlijst</button>
                            <button className="pill-btn" onClick={handleDeleteAllRenners} style={{ background: 'var(--red)', color: 'white' }}>🗑️ Reset Alles</button>
                        </div>
                    </div>

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Renner</th>
                                    <th style={{ textAlign: 'right' }}>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {renners.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: '800', fontSize: '1.1rem' }}>{r.naam}</span>
                                                <span className="small-muted">@{r.slug}</span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                className="admin-delete-icon-btn"
                                                onClick={() => deleteItem('renners', r.id)}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'ritten' && (
                <section className="panel card">
                    <h3>Etappes Beheren</h3>
                    <div className="input-row" style={{ marginBottom: '20px' }}>
                        <input type="number" placeholder="Rit nr" value={newRit.rit_nummer} onChange={(e) => setNewRit({ ...newRit, rit_nummer: e.target.value })} />
                        <input type="text" placeholder="Naam" value={newRit.naam} onChange={(e) => setNewRit({ ...newRit, naam: e.target.value })} />
                        <input type="date" value={newRit.datum} onChange={(e) => setNewRit({ ...newRit, datum: e.target.value })} />
                        <button className="pill-btn" onClick={handleAddRit}>Toevoegen</button>
                    </div>

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Nr</th>
                                    <th>Naam</th>
                                    <th>Datum</th>
                                    <th style={{ textAlign: 'right' }}>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ritten.map((rit) => (
                                    <tr key={rit.id}>
                                        <td>{rit.rit_nummer}</td>
                                        <td>{rit.naam}</td>
                                        <td>{rit.datum}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="admin-delete-icon-btn" onClick={() => deleteItem('ritten', rit.id)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {activeTab === 'drafts' && (
                <section className="panel card">
                    <div className="admin-header-flex" style={{ marginBottom: '20px' }}>
                        <h3>Actieve Drafts ({drafts.length})</h3>
                        <button className="pill-btn" onClick={handleDeleteAllDrafts} style={{ background: 'var(--red)', color: 'white' }}>🗑️ Alles Leegmaken</button>
                    </div>
                    <div className="table-wrap" style={{ maxHeight: '500px' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Gebruiker</th>
                                    <th>Renner</th>
                                    <th style={{ textAlign: 'right' }}>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {drafts.map((d) => (
                                    <tr key={d.id}>
                                        <td>{d.speler_id || d.username || 'Onbekend'}</td>
                                        <td>{d.renners?.naam || `ID: ${d.renner_id}`}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="admin-delete-icon-btn" onClick={() => deleteDraft(d.id)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
}