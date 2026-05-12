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
    importKlassiekerAlsRit,
    previewRaceLifecycle,
    runRaceLifecycle,
    forceAutoSync,
    voegRennerToe
} from '../services/api';

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

    // --- STATES & LOGICA VOOR HANDMATIG RENNER TOEVOEGEN ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        voornaam: "",
        achternaam: "",
    });
    const [loadingToevoegen, setLoadingToevoegen] = useState(false);

    // Genereer automatisch een slug (bijv. "Tadej" + "Pogačar" -> "tadej-pogacar")
    const genereerSlug = (voornaam, achternaam) => {
        if (!voornaam && !achternaam) return "";
        const volledigeNaam = `${voornaam} ${achternaam}`;
        return volledigeNaam
            .toLowerCase()
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '');
    };

    const handleVoegRennerToe = async (e) => {
        e.preventDefault();
        setLoadingToevoegen(true);

        const slug = genereerSlug(formData.voornaam, formData.achternaam);
        const volledigeNaam = `${formData.voornaam} ${formData.achternaam}`.trim();

        try {
            await voegRennerToe({
                naam: volledigeNaam,
                pcs_id: slug,
            });
            alert(`✅ ${volledigeNaam} succesvol toegevoegd!`);
            setIsModalOpen(false);
            setFormData({ voornaam: "", achternaam: "" });
            await fetchData(); // Ververs direct de renners-lijst in de admin
        } catch (error) {
            console.error("Fout bij toevoegen renner:", error);
            alert("❌ Er ging iets mis bij het toevoegen.");
        } finally {
            setLoadingToevoegen(false);
        }
    };
    // --------------------------------------------------------

    const gefilterdeRenners = useMemo(() => {
        if (!zoekTerm) return renners;
        const term = normaliseer(zoekTerm);
        return renners.filter((r) =>
            normaliseer(r.naam).includes(term)
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

    const handleSyncSingleRace = async (id) => {
        if (!window.confirm("Wil je de datums en starttijden van deze wedstrijd opnieuw ophalen en updaten?")) return;

        try {
            // Haal je token op (kijk even hoe je dit normaal in je app doet, vaak is het 'token' of 'jwt')
            const token = localStorage.getItem('token');

            const response = await fetch(`http://localhost:3000/api/admin/sync-wedstrijd/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // <--- DEZE REGEL FIXT HET PROBLEEM
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Er ging iets mis bij het synchroniseren.');
            }

            alert(data.message || '✅ Wedstrijd succesvol gesynchroniseerd!');

        } catch (error) {
            console.error("Fout bij sync:", error);
            alert("Fout bij synchroniseren: " + error.message);
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

            const previewResponse = await previewRaceLifecycle();
            const previewResultaten = previewResponse.data.resultaten || [];

            if (previewResultaten.length === 0) {
                alert("Geen actieve draftsessies gevonden.");
                return;
            }

            const previewTekst = previewResultaten
                .map((r) => {
                    if (r.actie === "preview_volgende_koers") {
                        return `✅ ${r.vorigeWedstrijd} ${r.vorigeJaar || ""} → ${r.nieuweWedstrijd} ${r.nieuweJaar || ""}`;
                    }

                    return `⚠️ ${r.reden || "Geen actie mogelijk."}`;
                })
                .join("\n");

            const heeftVolgendeKoers = previewResultaten.some(
                (r) => r.actie === "preview_volgende_koers"
            );

            if (!heeftVolgendeKoers) {
                alert(previewTekst);
                return;
            }

            const bevestiging = window.prompt(
                `Je staat op het punt om de volgende koers te starten:\n\n${previewTekst}\n\nOude drafts en scores blijven bewaard.\n\nTyp START om te bevestigen.`
            );

            if (bevestiging !== "START") {
                alert("Geannuleerd. Er is niets aangepast.");
                return;
            }

            const response = await runRaceLifecycle();
            const resultaten = response.data.resultaten || [];

            const tekst = resultaten
                .map((r) => {
                    if (r.actie === "nieuwe_draft_aangemaakt") {
                        return `✅ Nieuwe koers gestart: ${r.vorigeWedstrijd} → ${r.nieuweWedstrijd}`;
                    }

                    return `⚠️ ${r.actie}: ${r.reden || "geen reden"}`;
                })
                .join("\n");

            alert(tekst);
            await fetchData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.details || err.response?.data?.error || "Lifecycle mislukt");
        } finally {
            setLoading(false);
        }
    }

    async function verwijderAlleRenners() {
        const bevestiging = window.confirm("Weet je ZEKER dat je alle renners wilt verwijderen? Dit kan niet ongedaan worden gemaakt!");

        if (!bevestiging) return;

        try {
            setLoading(true);
            await deleteAllRenners();
            alert("Alle renners zijn succesvol verwijderd!");
            fetchData();
        } catch (err) {
            console.error("Fout bij verwijderen:", err);
            alert("Er is iets misgegaan bij het verwijderen van de renners.");
        } finally {
            setLoading(false);
        }
    }

    const handleKlassiekerImport = async () => {
        if (!klassiekerUrl) return alert("Plak eerst een PCS URL van de klassieker.");

        if (!klassiekerUrl.includes('procyclingstats.com')) {
            return alert("Dit lijkt geen geldige PCS link te zijn.");
        }

        setLoading(true);
        try {
            const res = await importKlassiekerAlsRit(klassiekerUrl);
            alert(res.data?.message || "Klassieker succesvol toegevoegd en gescrapet!");
            setKlassiekerUrl('');
            await fetchData();

        } catch (err) {
            console.error("Klassieker Import Error:", err);
            alert("Fout bij importeren klassieker: " + (err.response?.data?.error || err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const [forcingSync, setForcingSync] = useState(false);
    const [systeemMelding, setSysteemMelding] = useState("");

    async function handleForceSync() {
        setForcingSync(true);
        setSysteemMelding("⚙️ Automatische motor is gestart op de achtergrond! Check de terminal.");

        try {
            await forceAutoSync();
            setTimeout(() => {
                setForcingSync(false);
                setSysteemMelding("");
            }, 4000);
        } catch (err) {
            console.error(err);
            setSysteemMelding("❌ Fout bij het starten van de sync.");
            setForcingSync(false);
        }
    }

    return (
        <div className="page-shell admin-page">
            <div className="section-head">
                <h1>Admin Dashbord</h1>
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
                    <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #334155' }}>
                        <h3>Systeem Acties (Achtergrond)</h3>
                        <p className="small-muted" style={{ marginBottom: '15px' }}>
                            Forceer de automatische scraper of controleer de status van actieve koersen.
                        </p>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                onClick={handleForceSync}
                                className="pill-btn"
                                disabled={forcingSync}
                                style={{
                                    backgroundColor: forcingSync ? "#475569" : "#10b981",
                                    color: "white",
                                    fontWeight: "bold",
                                    cursor: forcingSync ? "not-allowed" : "pointer",
                                    opacity: forcingSync ? 0.7 : 1,
                                }}
                            >
                                {forcingSync ? "🚀 Aan het scrapen..." : "⚙️ Forceer Auto-Sync"}
                            </button>

                            <button
                                className="pill-btn"
                                onClick={handleRaceLifecycle}
                                disabled={loading}
                                style={{ background: '#3b82f6', color: 'white' }}
                            >
                                ➡️ Preview volgende koers
                            </button>
                        </div>

                        {systeemMelding && (
                            <div style={{
                                marginTop: "15px", padding: "10px", borderRadius: "4px",
                                backgroundColor: systeemMelding.includes("❌") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                                color: systeemMelding.includes("❌") ? "#ef4444" : "#10b981",
                                borderLeft: `4px solid ${systeemMelding.includes("❌") ? "#ef4444" : "#10b981"}`
                            }}>
                                {systeemMelding}
                            </div>
                        )}
                    </div>

                    <div className="admin-header-flex">
                        <div>
                            <h3>Handmatige Rit Scraper</h3>
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
                    {/* AANGEPASTE HEADER VOOR DE RENNERS TAB (ALLES NAAST ELKAAR) */}
                    <div className="admin-header-flex" style={{
                        marginBottom: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'nowrap',
                        gap: '1rem'
                    }}>
                        <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>
                            Alle Renners ({gefilterdeRenners.length}/{renners.length})
                        </h3>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {/* 1. Zoekbalk */}
                            <input
                                type="text"
                                className="draft-search-input"
                                placeholder="Zoek renner..."
                                value={zoekTerm}
                                onChange={(e) => setZoekTerm(e.target.value)}
                                style={{ margin: 0, width: "220px", padding: "10px 15px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#161616", color: "#fff" }}
                            />

                            {/* 2. Blauwe Knop */}
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="pill-btn"
                                style={{ backgroundColor: "#22d3ee", color: "#0f172a", fontWeight: "bold", border: "none", margin: 0, whiteSpace: 'nowrap' }}
                            >
                                + Handmatig Toevoegen
                            </button>

                            {/* 3. Rode Knop */}
                            <button
                                className="pill-btn"
                                onClick={verwijderAlleRenners}
                                style={{ backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', border: 'none', margin: 0, whiteSpace: 'nowrap' }}
                            >
                                🗑️ Alles Leegmaken
                            </button>
                        </div>
                    </div>

                    <div className="table-wrap" style={{ maxHeight: '500px' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Naam</th>
                                    <th style={{ textAlign: 'right' }}>Actie</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gefilterdeRenners.map((r) => (
                                    <tr key={r.id}>
                                        <td>{r.naam}</td>
                                        <td>{r.prijs}</td>
                                        <td style={{ textAlign: 'right' }}>
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
                                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '15px', alignItems: 'center' }}>

                                            <button
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '34px',
                                                    height: '34px',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    color: '#3b82f6',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease-in-out',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#eff6ff';
                                                    e.currentTarget.querySelector('svg').style.transform = 'rotate(180deg)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                    e.currentTarget.querySelector('svg').style.transform = 'rotate(0deg)';
                                                }}
                                                onClick={() => handleSyncSingleRace(w.id)}
                                                title="Synchroniseer datums en starttijden"
                                            >
                                                <svg
                                                    style={{ transition: 'transform 0.4s ease' }}
                                                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                                >
                                                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                                    <path d="M3 3v5h5" />
                                                </svg>
                                            </button>

                                            <button className="admin-delete-icon-btn" onClick={() => handleDelete(w.id)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {activeTab === 'drafts' && (
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
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="pill-btn" onClick={handleDeleteAllDrafts} style={{ background: 'var(--red)', color: 'white' }}>
                                🗑️ Alles Leegmaken
                            </button>
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
            )}

            {/* DE POP-UP (MODAL) VOOR RENNERS TOEVOEGEN */}
            {isModalOpen && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
                }}>
                    <div className="card" style={{
                        backgroundColor: "#161616", padding: "2rem", borderRadius: "12px", width: "90%", maxWidth: "500px", border: "1px solid #22d3ee"
                    }}>
                        <h2 style={{ marginTop: 0, color: "#22d3ee", marginBottom: "1.5rem" }}>Nieuwe Renner Toevoegen</h2>

                        <form onSubmit={handleVoegRennerToe} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#94a3b8", fontSize: "0.9rem" }}>Voornaam</label>
                                    <input
                                        type="text" required
                                        value={formData.voornaam}
                                        onChange={(e) => setFormData({ ...formData, voornaam: e.target.value })}
                                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#0f172a", color: "#fff" }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#94a3b8", fontSize: "0.9rem" }}>Achternaam</label>
                                    <input
                                        type="text" required
                                        value={formData.achternaam}
                                        onChange={(e) => setFormData({ ...formData, achternaam: e.target.value })}
                                        style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#0f172a", color: "#fff" }}
                                    />
                                </div>
                            </div>
                            <p style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic", margin: 0 }}>
                                Automatische Slug: <strong style={{ color: "#22d3ee" }}>{genereerSlug(formData.voornaam, formData.achternaam) || "..."}</strong>
                            </p>

                            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ flex: 1, padding: "12px", background: "none", border: "1px solid #333", color: "#fff", borderRadius: "8px", cursor: "pointer" }}
                                >
                                    Annuleren
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingToevoegen}
                                    style={{ flex: 1, padding: "12px", backgroundColor: "#22d3ee", border: "none", color: "#0f172a", fontWeight: "bold", borderRadius: "8px", cursor: loadingToevoegen ? "not-allowed" : "pointer" }}
                                >
                                    {loadingToevoegen ? "Bezig..." : "Opslaan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}