import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('scraper');
    const [ritten, setRitten] = useState([]);
    const [renners, setRenners] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Formulieren state
    const [newRit, setNewRit] = useState({ rit_nummer: '', naam: '', datum: '' });
    const [newRenner, setNewRenner] = useState({ naam: '' });
    //state voor de geselecteerde wedstrijden
    const [selectedWedstrijd, setSelectedWedstrijd] = useState(null);
    const [wedstrijden, setWedstrijden] = useState([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Eerst het token ophalen
            const token = localStorage.getItem('token');

            // 2. Dan de config definiëren
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            // 3. Nu pas de data ophalen met de juiste config
            const [resRitten, resRenners, resDrafts, resWedstrijden] = await Promise.all([
                axios.get('http://localhost:3000/api/admin/ritten', config),
                axios.get('http://localhost:3000/api/admin/renners', config),
                axios.get('http://localhost:3000/api/admin/drafts', config),
                axios.get('http://localhost:3000/api/admin/wedstrijden', config)
            ]);

            // 4. States updaten
            setRitten(resRitten.data || []);
            setRenners(resRenners.data || []);
            setDrafts(resDrafts.data || []);
            setWedstrijden(resWedstrijden.data || []);

            console.log("Data succesvol ververst");
        } catch (err) {
            console.error("Fout bij ophalen data:", err);
            if (err.response?.status === 401) {
                alert("Sessie verlopen of ongeldig token. Log opnieuw in.");
            }
        }
    };
    // --- DELETE DRAFT (1 per 1) ---
    const deleteDraft = async (id) => {
        if (!window.confirm("Weet je zeker dat je deze specifieke draft wilt verwijderen?")) return;
        try {
            await axios.delete(`http://localhost:3000/api/admin/drafts/${id}`);
            fetchData();
        } catch (err) {
            console.error("Verwijder fout:", err);
            alert("Kon niet verwijderen: " + (err.response?.data?.error || "Server fout"));
        } finally {
            setLoading(false);
        }
    };

    // --- DELETE ALL RENNERS ---
    const handleDeleteAllRenners = async () => {
        if (!window.confirm("⚠️ WEET JE DIT ZEKER? Je verwijdert alle renners uit de database!")) return;

        setLoading(true);
        try {
            await axios.delete('http://localhost:3000/api/admin/renners-all');
            alert("De deelnemerslijst is volledig leeggemaakt.");
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Fout bij het leegmaken: " + (err.response?.data?.error || "Serverfout"));
        } finally {
            setLoading(false);
        }
    };

    //verwijder alle drafts
    const handleDeleteAllDrafts = async () => {
        if (!window.confirm("⚠️ WEET JE DIT ZEKER? Dit verwijdert alle gekozen teams van alle gebruikers!")) return;

        setLoading(true);
        try {
            await axios.delete('http://localhost:3000/api/admin/drafts-all');
            alert("Alle drafts zijn succesvol verwijderd.");
            fetchData(); // Vernieuw de data
        } catch (err) {
            console.error(err);
            alert("Fout bij het verwijderen van drafts: " + (err.response?.data?.error || "Serverfout"));
        } finally {
            setLoading(false);
        }
    };

    // --- SCRAPER ACTIONS ---
    const handleScrapeRit = async (ritId, ritNummer) => {
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:3000/api/admin/scrape-rit', { ritId, ritNummer });
            alert(res.data.message || `Succes! ${res.data.count} renners verwerkt.`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || "Deze etappe is nog niet gereden.");
        } finally {
            setLoading(false);
        }
    };

    const handleImportStartlist = async () => {
        const url = prompt("Plak de URL van de PCS Startlist (bijv. /race/tour-de-france/2026/startlist):");
        if (!url) return;
        setLoading(true);
        try {
            await axios.post('http://localhost:3000/api/admin/import-startlist', { url });
            alert("Startlijst succesvol geïmporteerd!");
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Fout: " + (err.response?.data?.error || "Server onbereikbaar"));
        } finally {
            setLoading(false);
        }
    };



    // --- DELETE ACTIONS ---
    const deleteItem = async (type, id) => {
        if (!window.confirm("Weet je dit zeker? Dit kan invloed hebben op de draft!")) return;
        try {
            await axios.delete(`http://localhost:3000/api/admin/${type}/${id}`);
            fetchData();
        } catch (err) {
            alert("Verwijderen mislukt. Mogelijk is dit item gekoppeld aan een draft.");
        }
    };

    return (
        <div className="admin-container" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div className="section-head">
                <h1>Admin Dashboard</h1>
                <div className="tab-menu" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button className={`pill-btn ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => setActiveTab('scraper')}>🚀 Scraper</button>
                    <button className={`pill-btn ${activeTab === 'renners' ? 'active' : ''}`} onClick={() => setActiveTab('renners')}>🚴 Renners</button>
                    <button className={`pill-btn ${activeTab === 'ritten' ? 'active' : ''}`} onClick={() => setActiveTab('ritten')}>📅 Ritten</button>
                    <button className={`pill-btn ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>📝 Drafts</button>
                </div>
            </div>

            {loading && <div className="loader">Bezig met verwerken... ⏳</div>}

            {/* TAB 1: SCRAPER BEHEER */}
            {activeTab === 'scraper' && (
                <section className="panel card">
                    <h3>Automatische Rit Scraper</h3>
                    <p className="muted">De scraper zoekt automatisch naar de uitslag op basis van het ritnummer.</p>
                    <div className="admin-list">
                        {ritten.sort((a, b) => a.rit_nummer - b.rit_nummer).map((rit) => (
                            <div key={rit.id} className="admin-row panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee' }}>
                                <span><strong>Rit {rit.rit_nummer}</strong>: {rit.naam || 'Etappe'}</span>
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



            {/* TAB 2: RENNERS */}
            {activeTab === 'renners' && (
                <section className="card">
                    <h3>Renners ({renners ? renners.length : 0})</h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        <table width="100%">
                            <thead>
                                <tr><th>Naam</th><th>Ploeg</th><th>Actie</th></tr>
                            </thead>
                            <tbody>
                                {renners && renners.length > 0 ? (
                                    renners.map(r => (
                                        <tr key={r.id}>
                                            <td>{r.naam}</td>
                                            <td>{r.ploeg || '-'}</td>
                                            <td><button onClick={() => deleteItem('renners', r.id)}>🗑️</button></td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="3">Geen renners gevonden of niet geautoriseerd.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* TAB 3: RITTEN BEHEER */}
            {activeTab === 'ritten' && (
                <section className="panel card">
                    <h3>Etappes Beheren</h3>
                    {/* ... (inhoud ongewijzigd) ... */}
                    <div className="add-form" style={{ marginBottom: '20px', display: 'flex', gap: '5px' }}>
                        <input type="number" placeholder="Rit nr" value={newRit.rit_nummer} onChange={e => setNewRit({ ...newRit, rit_nummer: e.target.value })} />
                        <input type="text" placeholder="Naam (vlak, berg...)" value={newRit.naam} onChange={e => setNewRit({ ...newRit, naam: e.target.value })} />
                        <input type="date" value={newRit.datum} onChange={e => setNewRit({ ...newRit, datum: e.target.value })} />
                        <button onClick={async () => { await axios.post('http://localhost:3000/api/admin/ritten/add', newRit); fetchData(); }}>+</button>
                    </div>
                    <table style={{ width: '100%', textAlign: 'left' }}>
                        <thead><tr><th>Nr</th><th>Naam</th><th>Datum</th><th>Actie</th></tr></thead>
                        <tbody>
                            {ritten.map(rit => (
                                <tr key={rit.id}>
                                    <td>{rit.rit_nummer}</td>
                                    <td>{rit.naam}</td>
                                    <td>{rit.datum}</td>
                                    <td><button onClick={() => deleteItem('ritten', rit.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>🗑️</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            )}

            {/* TAB 4: DRAFTS BEHEER */}
            {activeTab === 'drafts' && (
                <section className="panel card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Actieve Drafts ({drafts.length})</h3>
                        <button
                            className="pill-btn"
                            onClick={() => {
                                if (window.confirm("Alle drafts verwijderen?")) {
                                    axios.delete('http://localhost:3000/api/admin/drafts-all').then(() => fetchData());
                                }
                            }}
                            style={{ backgroundColor: '#f44336', color: 'white' }}
                        >
                            🗑️ Alles Leegmaken
                        </button>
                    </div>
                    {/* TAB 4: DRAFTS BEHEER */}
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
                                {drafts.length > 0 ? drafts.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td>{d.user_id || d.username || 'Onbekend'}</td>
                                        {/* We tonen de naam van de renner als die via een join is meegekomen */}
                                        <td>{d.renners?.naam || `ID: ${d.renner_id}(naam niet gevonden)`}</td>
                                        <td>
                                            <button onClick={() => deleteDraft(d.id)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>🗑️</button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="3">Geen drafts gevonden.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}



        </div >
    );
};