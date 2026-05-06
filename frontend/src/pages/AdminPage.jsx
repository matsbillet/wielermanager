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
    scrapeRit, importVolledigeWedstrijd,
    syncStartlijst,
    importKlassiekerAlsRit
} from '../services/api';
import { runRaceLifecycle } from "../services/api";

function normaliseer(text = "") {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ø/g, "o")
        .replace(/æ/g, "ae")
        .replace(/œ/g, "oe")
        .replace(/ß/g, "ss")
        .replace(/đ/g, "d")
        .replace(/ł/g, "l");
}

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('scraper');
    const [ritten, setRitten] = useState([]);
    const [renners, setRenners] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [wedstrijden, setWedstrijden] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pcsTourUrl, setPcsTourUrl] = useState('');

    // Filter state voor de ritten/scraper tab
    const [selectedWedstrijd, setSelectedWedstrijd] = useState('');

    const [newRit, setNewRit] = useState({ rit_nummer: '', naam: '', datum: '' });

    const [zoekTerm, setZoekTerm] = useState("");

    const [klassiekerUrl, setKlassiekerUrl] = useState('');

    const gefilterdeRenners = useMemo(() => {
        if (!zoekTerm) return renners;
        const term = normaliseer(zoekTerm);
        return renners.filter((r) =>
            normaliseer(r.naam).includes(term) ||
            (r.team && normaliseer(r.team).includes(term)) // Controleert ook op teamnaam!
        );
    }, [renners, zoekTerm]);

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
    //Wedstrijden scrape functie
    const handleFullImport = async () => {
        if (!pcsTourUrl) return alert("Plak eerst een PCS URL");

        // Check of de URL wel van ProCyclingStats is
        if (!pcsTourUrl.includes('procyclingstats.com')) {
            return alert("Dit lijkt geen geldige PCS link te zijn.");
        }
        setLoading(true);
        try {
            const res = await importVolledigeWedstrijd(pcsTourUrl);

            // Gebruik de message die de backend teruggeeft
            alert(res.data.message || "Import succesvol!");

            setPcsTourUrl(''); // Maak het veld leeg
            await fetchData(); // Ververs de lijst met wedstrijden en ritten

        } catch (err) {
            console.error("Super Import Error:", err);
            alert("Fout bij volledige import: " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    async function handleSyncStartlijst(wedstrijdId) {
        try {
            setLoading(true);
            const response = await syncStartlijst(wedstrijdId);

            alert(response.data.message || "Startlijst gesynchroniseerd");

            await fetchData(); // refresh admin lijst
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.error || "Sync mislukt");
        } finally {
            setLoading(false);
        }
    }
    // verwijderen wedstrijden

    const handleDelete = async (id) => {
        if (!window.confirm("Weet je zeker dat je deze wedstrijd wilt verwijderen?")) return;

        // Haal het token op (meestal opgeslagen bij login)
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`http://localhost:3000/api/admin/wedstrijd/${id}`, {
                method: 'DELETE',
                headers: {
                    // Zorg dat je token meestuurt zodat de backend weet wie je bent
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                alert("Wedstrijd verwijderd!");
                setWedstrijden(prev => prev.filter(w => w.id !== id));
            } else {
                // Dit is waar je nu de "Geen geldig token" melding ziet
                alert("Fout bij verwijderen: " + (data.error || data.message || "Onbekende fout"));
            }
        } catch (err) {
            console.error("Netwerkfout:", err);
            alert("Kan geen verbinding maken met de server.");
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

    async function handleRaceLifecycle() {
        try {
            setLoading(true);

            const response = await runRaceLifecycle();
            console.log("Lifecycle resultaat:", response.data);

            const resultaten = response.data.resultaten || [];

            if (resultaten.length === 0) {
                alert("Geen actieve draftsessies gevonden.");
                return;
            }

            const tekst = resultaten
                .map((r) => {
                    if (r.actie === "nieuwe_draft_aangemaakt") {
                        return `✅ ${r.vorigeWedstrijd} → ${r.nieuweWedstrijd}`;
                    }

                    return `⚠️ ${r.actie}: ${r.reden || "geen reden"}`;
                })
                .join("\n");

            alert(tekst);
            await fetchData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.details || "Lifecycle mislukt");
        } finally {
            setLoading(false);
        }
    }

    async function verwijderAlleRenners() {
        const bevestiging = window.confirm("Weet je ZEKER dat je alle renners wilt verwijderen? Dit kan niet ongedaan worden gemaakt!");

        if (!bevestiging) return;

        try {
            setLoading(true);
            await deleteAllRenners(); // Dit is de API call die je bovenaan al had geïmporteerd
            alert("Alle renners zijn succesvol verwijderd!");
            fetchData(); // Herlaad de tabel
        } catch (err) {
            console.error("Fout bij verwijderen:", err);
            alert("Er is iets misgegaan bij het verwijderen van de renners.");
        } finally {
            setLoading(false);
        }
    }

    // --- NIEUWE HANDLER VOOR KLASSIEKER IMPORT ---
    const handleKlassiekerImport = async () => {
        if (!klassiekerUrl) return alert("Plak eerst een PCS URL van de klassieker.");

        if (!klassiekerUrl.includes('procyclingstats.com')) {
            return alert("Dit lijkt geen geldige PCS link te zijn.");
        }

        setLoading(true);
        try {
            // De échte API-aanroep
            const res = await importKlassiekerAlsRit(klassiekerUrl);

            // Succesmelding tonen
            alert(res.data?.message || "Klassieker succesvol toegevoegd en gescrapet!");

            // Veld leegmaken en data verversen
            setKlassiekerUrl('');
            await fetchData();

        } catch (err) {
            console.error("Klassieker Import Error:", err);
            // Specifieke foutmelding uit de backend tonen, anders standaardmelding
            alert("Fout bij importeren klassieker: " + (err.response?.data?.error || err.response?.data?.message || err.message));
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
                    <button className={`pill-btn ${activeTab === 'ritten' ? 'active' : ''}`} onClick={() => setActiveTab('ritten')}>🏆 Wedstrijden</button>
                    <button className={`pill-btn ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => setActiveTab('drafts')}>📝 Drafts</button>
                </div>
            </div>

            {loading && <div className="loading">Bezig met verwerken... ⏳</div>}

            {activeTab === 'scraper' && (
                <section className="panel card">
                    <div style={{ marginBottom: '15px' }}>
                        <button
                            className="pill-btn"
                            onClick={handleRaceLifecycle}
                            style={{ background: '#4CAF50', color: 'white' }}
                        >
                            🔄 Volgende koers + nieuwe draft
                        </button>
                    </div>
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
                <section className="panel card">
                    <div className="admin-header-flex" style={{ marginBottom: '20px' }}>
                        <h3>Alle Renners ({gefilterdeRenners.length}/{renners.length})</h3>

                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                className="draft-search-input"
                                placeholder="Zoek renner of team..."
                                value={zoekTerm}
                                onChange={(e) => setZoekTerm(e.target.value)}
                                style={{ margin: 0, maxWidth: "250px" }}
                            />
                            {/* Knop styling gelijkgetrokken met Drafts tab */}
                            <button className="pill-btn" onClick={verwijderAlleRenners} style={{ background: 'var(--red)', color: 'white' }}>
                                🗑️ Alles Leegmaken
                            </button>
                        </div>
                    </div>

                    <div className="table-wrap" style={{ maxHeight: '500px' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Naam</th>
                                    <th>Team</th>
                                    <th>Prijs</th>
                                    <th style={{ textAlign: 'right' }}>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gefilterdeRenners.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.naam}</td>
                                        <td>{r.team}</td>
                                        <td>{r.prijs}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {/* Zorg dat deleteItem goed wordt aangeroepen */}
                                            <button className="admin-delete-icon-btn" onClick={() => deleteItem('renners', r.id)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {gefilterdeRenners.length === 0 && renners.length > 0 && (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                                Geen renners gevonden voor "{zoekTerm}"
                            </div>
                        )}
                    </div>
                </section>
            )}

            {activeTab === 'ritten' && (
                <section className="panel card">
                    <div className="admin-header-flex">
                        <h3>🏆 Wedstrijden Beheren</h3>
                    </div>

                    <div className="super-import-container">
                        <div className="super-import-header">

                            <div>
                                <h4>wedstrijd Import</h4>
                                <p>Voer de PCS Overview URL in voor een volledige automatische configuratie.</p>
                            </div>
                        </div>

                        <div className="super-import-actions">
                            <input
                                type="text"
                                className="super-import-input"
                                placeholder="https://www.procyclingstats.com/race/..."
                                value={pcsTourUrl}
                                onChange={(e) => setPcsTourUrl(e.target.value)}
                            />
                            <button
                                className="super-import-btn"
                                onClick={handleFullImport}
                                disabled={loading}
                            >
                                {loading ? <span className="spinner"></span> : 'Start Import'}
                            </button>
                        </div>
                    </div>

                    {/* --- NIEUW: Import voor Klassiekers --- */}
                    <div className="super-import-container" style={{ marginBottom: "2rem", borderTop: "1px solid #334155", paddingTop: "2rem" }}>
                        <div className="super-import-header">
                            <div>
                                <h4>Klassieker Toevoegen (Als Rit) (nog backend nodig)</h4>
                                <p>Voer de PCS URL van een eendagskoers in. De scraper haalt automatisch de naam, datum en startlijst op en voegt deze toe aan de voorjaarskalender.</p>
                            </div>
                        </div>

                        <div className="super-import-actions">
                            <input
                                type="text"
                                className="super-import-input"
                                placeholder="https://www.procyclingstats.com/race/ronde-van-vlaanderen/..."
                                value={klassiekerUrl}
                                onChange={(e) => setKlassiekerUrl(e.target.value)}
                            />
                            <button
                                className="super-import-btn"
                                onClick={handleKlassiekerImport}
                                disabled={loading}
                                style={{ backgroundColor: "#22d3ee", color: "#000" }}
                            >
                                {loading ? <span className="spinner"></span> : 'Start Import'}
                            </button>
                        </div>
                    </div>
                    {/* --- EINDE NIEUW BLOK --- */}

                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Naam</th>
                                    <th>Jaar</th>
                                    <th>Type</th>
                                    <th style={{ textAlign: 'right' }}>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wedstrijden.map((w) => (
                                    <tr key={w.id}>
                                        <td><strong>{w.naam}</strong></td>
                                        <td>{w.jaar}</td>
                                        <td>{w.is_eendagskoers ? '🏁 Eendagskoers' : '🚴 Meerdaagse'}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {/* Je kunt hier een deleteWedstrijd functie koppelen */}
                                            <button className="admin-delete-icon-btn" onClick={() => handleDelete(w.id)}>
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

            {
                activeTab === 'drafts' && (
                    <section className="panel card">
                        <div className="admin-header-flex" style={{ marginBottom: '20px' }}>
                            <h3>Actieve Drafts ({drafts.length})</h3>

                            <select
                                className="admin-select-custom"
                                value={selectedWedstrijd}
                                onChange={(e) => setSelectedWedstrijd(e.target.value)}
                                style={{ marginLeft: "1rem" }}
                            >
                                <option value="">Kies wedstrijd</option>
                                {wedstrijden.map((w) => (
                                    <option key={w.id} value={w.id}>
                                        {w.naam} ({w.jaar})
                                    </option>
                                ))}
                            </select>
                            <button className="pill-btn" onClick={handleDeleteAllDrafts} style={{ background: 'var(--red)', color: 'white' }}>🗑️ Alles Leegmaken</button>
                            <div style={{ marginBottom: "1rem" }}>
                                <button
                                    className="pill-btn"
                                    onClick={() => handleSyncStartlijst(selectedWedstrijd)}
                                    disabled={!selectedWedstrijd}
                                >
                                    Sync startlijst voor deze koers
                                </button>
                            </div>
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
                )
            }
        </div >
    );
}