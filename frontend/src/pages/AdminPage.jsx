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

// =====================================================================
// NIEUW COMPONENT: De Professionele Zoekbare Dropdown (Combobox)
// =====================================================================
function ZoekbareRennerSelect({ renners, value, onChange, placeholder, styleClass }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isOpen, setIsOpen] = useState(false);

    // Als de 'value' van buitenaf verandert (bijv. bij het resetten van het formulier), 
    // updaten we ook de zichtbare tekst.
    useEffect(() => {
        if (value) {
            const selected = renners.find(r => r.id === value);
            if (selected) setSearchTerm(selected.naam);
        } else {
            setSearchTerm("");
        }
    }, [value, renners]);

    // Filter de lijst gebaseerd op wat de gebruiker typt
    const filteredRenners = useMemo(() => {
        if (!searchTerm) return renners;
        const term = normaliseer(searchTerm);
        return renners.filter(r => normaliseer(r.naam).includes(term));
    }, [renners, searchTerm]);

    return (
        <div style={{ position: "relative", width: "100%" }}>
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsOpen(true);
                    onChange(""); // Verwijder het ID als de gebruiker de tekst aanpast
                }}
                onFocus={() => setIsOpen(true)}
                onBlur={() => setTimeout(() => setIsOpen(false), 200)} // Korte delay zodat de klik op de lijst registreert
                placeholder={placeholder || "Typ om te zoeken..."}
                className={styleClass}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", backgroundColor: "#0f172a", color: "#fff", border: "1px solid #333" }}
            />
            {isOpen && filteredRenners.length > 0 && (
                <ul style={{
                    position: "absolute", zIndex: 100, top: "100%", left: 0, width: "100%",
                    maxHeight: "250px", overflowY: "auto", backgroundColor: "#1e293b",
                    border: "1px solid #3b82f6", borderRadius: "4px", padding: 0, margin: "4px 0 0 0", listStyle: "none",
                    boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
                }}>
                    {filteredRenners.map(r => (
                        <li
                            key={r.id}
                            // onMouseDown vuurt af vóór onBlur van de input
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setSearchTerm(r.naam);
                                onChange(r.id);
                                setIsOpen(false);
                            }}
                            style={{ padding: "10px", cursor: "pointer", borderBottom: "1px solid #334155" }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = "#334155"}
                            onMouseLeave={(e) => e.target.style.backgroundColor = "transparent"}
                        >
                            {r.naam}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
// =====================================================================

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('scraper');
    const [ritten, setRitten] = useState([]);
    const [renners, setRenners] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [wedstrijden, setWedstrijden] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pcsTourUrl, setPcsTourUrl] = useState('');

    const [selectedWedstrijd, setSelectedWedstrijd] = useState('');
    const [newRit, setNewRit] = useState({ rit_nummer: '', naam: '', datum: '' });
    const [zoekTerm, setZoekTerm] = useState("");
    const [klassiekerUrl, setKlassiekerUrl] = useState('');

    // --- STATES VOOR HANDMATIG RENNER TOEVOEGEN ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ voornaam: "", achternaam: "", wedstrijd_id: "" });
    const [loadingToevoegen, setLoadingToevoegen] = useState(false);

    // --- STATES VOOR HANDMATIGE UITSLAG ---
    const [isManualResultModalOpen, setIsManualResultModalOpen] = useState(false);
    const [manualWedstrijdId, setManualWedstrijdId] = useState('');
    const [manualRitId, setManualRitId] = useState('');
    const [startlijstRenners, setStartlijstRenners] = useState([]);
    const [manualTop25, setManualTop25] = useState(Array(25).fill(''));
    const [manualTruien, setManualTruien] = useState({ algemeen: '', punten: '', berg: '', jongeren: '' });
    const [loadingManual, setLoadingManual] = useState(false);

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

        // Check of er een koers is geselecteerd
        if (!formData.wedstrijd_id) {
            return alert("⚠️ Selecteer een wedstrijd waaraan je deze renner wilt toevoegen!");
        }

        setLoadingToevoegen(true);

        const slug = genereerSlug(formData.voornaam, formData.achternaam);
        const volledigeNaam = `${formData.voornaam} ${formData.achternaam}`.trim();

        try {
            // We sturen nu het wedstrijd_id mee in plaats van team
            await voegRennerToe({
                naam: volledigeNaam,
                slug: slug,
                wedstrijd_id: formData.wedstrijd_id
            });
            alert(`✅ ${volledigeNaam} succesvol toegevoegd aan de koers!`);
            setIsModalOpen(false);
            setFormData({ voornaam: "", achternaam: "", wedstrijd_id: "" });
            await fetchData();
        } catch (error) {
            console.error("Fout bij toevoegen renner:", error);
            // Haal de échte foutmelding uit de backend op:
            const echteFout = error.response?.data?.error || error.response?.data?.message || error.message;
            alert(`❌ Fout bij toevoegen: ${echteFout}`);
        } finally {
            setLoadingToevoegen(false);
        }
    };

    useEffect(() => {
        if (!manualWedstrijdId) {
            setStartlijstRenners([]);
            return;
        }

        const fetchStartlijst = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`http://localhost:3000/api/admin/startlijst/${manualWedstrijdId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    setStartlijstRenners(data.renners || renners);
                } else {
                    setStartlijstRenners(renners);
                }
            } catch (e) {
                setStartlijstRenners(renners);
            }
        };
        fetchStartlijst();
    }, [manualWedstrijdId, renners]);

    const manualRitten = useMemo(() => {
        if (!manualWedstrijdId) return [];
        return ritten.filter(r => Number(r.wedstrijd_id) === Number(manualWedstrijdId)).sort((a, b) => a.rit_nummer - b.rit_nummer);
    }, [ritten, manualWedstrijdId]);

    const handleSaveManualResult = async (e) => {
        e.preventDefault();
        if (!manualRitId) return alert("Selecteer eerst een etappe!");

        setLoadingManual(true);
        const payload = { rit_id: manualRitId, top25: manualTop25, truien: manualTruien };

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3000/api/admin/manual-results`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("✅ Handmatige uitslag succesvol opgeslagen!");
                setIsManualResultModalOpen(false);
                setManualTop25(Array(25).fill(''));
                setManualTruien({ algemeen: '', punten: '', berg: '', jongeren: '' });
                fetchData();
            } else {
                const data = await res.json();
                alert("❌ Fout bij opslaan: " + (data.error || "Onbekend"));
            }
        } catch (e) {
            console.error("Netwerkfout bij handmatige uitslag:", e);
            alert("❌ Kon niet verbinden met de server om de uitslag op te slaan.");
        } finally {
            setLoadingManual(false);
        }
    };

    const gefilterdeRenners = useMemo(() => {
        if (!zoekTerm) return renners;
        const term = normaliseer(zoekTerm);
        return renners.filter((r) => normaliseer(r.naam).includes(term));
    }, [renners, zoekTerm]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [resRitten, resRenners, resDrafts, resWedstrijden] = await Promise.all([
                getAdminRitten(), getAdminRenners(), getAdminDrafts(), getAdminWedstrijden()
            ]);
            setRitten(resRitten.data || []);
            setRenners(resRenners.data || []);
            setDrafts(resDrafts.data || []);
            setWedstrijden(resWedstrijden.data || []);
        } catch (err) {
            console.error('Fout bij ophalen data:', err);
            if (err.response?.status === 401) alert('Sessie verlopen. Log opnieuw in.');
            else if (err.response?.status === 403) alert('Geen toegang. Alleen admins.');
        }
    };

    const handleFullImport = async () => {
        if (!pcsTourUrl) return alert("Plak eerst een PCS URL");
        if (!pcsTourUrl.includes('procyclingstats.com')) return alert("Dit lijkt geen geldige PCS link te zijn.");

        setLoading(true);
        try {
            const res = await importVolledigeWedstrijd(pcsTourUrl);
            alert(res.data.message || "Import succesvol!");
            setPcsTourUrl('');
            await fetchData();
        } catch (err) {
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
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.error || "Sync mislukt");
        } finally {
            setLoading(false);
        }
    }

    const handleDelete = async (id) => {
        if (!window.confirm("Weet je zeker dat je deze wedstrijd wilt verwijderen?")) return;
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`http://localhost:3000/api/admin/wedstrijd/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (response.ok && data.success) {
                alert("Wedstrijd verwijderd!");
                setWedstrijden(prev => prev.filter(w => w.id !== id));
            } else {
                alert("Fout bij verwijderen: " + (data.error || data.message || "Onbekende fout"));
            }
        } catch (err) {
            alert("Kan geen verbinding maken met de server.");
        }
    };

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

    const handleScrapeRit = async (ritId) => {
        setLoading(true);
        try {
            // We roepen nu jouw succesvolle auto-scrape functie aan!
            const res = await scrapeRit(ritId);
            alert(res.data?.message || `Succes! De rit is opnieuw gescrapet.`);
            await fetchData();
        } catch (err) {
            const echteFout = err.response?.data?.error || err.response?.data?.message || 'Er ging iets mis bij het ophalen van de uitslag.';
            alert(`Fout bij scrapen: ${echteFout}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncSingleRace = async (id) => {
        if (!window.confirm("Wil je de datums en starttijden van deze wedstrijd opnieuw ophalen en updaten?")) return;
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3000/api/admin/sync-wedstrijd/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Er ging iets mis bij het synchroniseren.');
            alert(data.message || '✅ Wedstrijd succesvol gesynchroniseerd!');
        } catch (error) {
            alert("Fout bij synchroniseren: " + error.message);
        }
    };

    const handleImportStartlist = async () => {
        if (!wedstrijden || wedstrijden.length === 0) return alert('Geen wedstrijden gevonden.');
        const wedstrijdenLijst = wedstrijden.map((w) => `${w.id}: ${w.naam} ${w.jaar}`).join('\n');
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
                return alert("Geen actieve draftsessies gevonden.");
            }

            const previewTekst = previewResultaten.map((r) => {
                if (r.actie === "preview_volgende_koers") {
                    return `✅ ${r.vorigeWedstrijd} ${r.vorigeJaar || ""} → ${r.nieuweWedstrijd} ${r.nieuweJaar || ""}`;
                }

                return `⚠️ ${r.reden || "Geen actie mogelijk."}`;
            }).join("\n");

            const heeftVolgendeKoers = previewResultaten.some(
                (r) => r.actie === "preview_volgende_koers"
            );

            if (!heeftVolgendeKoers) {
                return alert(previewTekst);
            }

            const aantalBasisInput = window.prompt(
                `Je staat op het punt om de volgende koers te starten:\n\n${previewTekst}\n\nHoeveel BASISRENNERS per speler?\n\nStandaard: 12`,
                "12"
            );

            if (aantalBasisInput === null) {
                return alert("Geannuleerd. Er is niets aangepast.");
            }

            const aantalBankInput = window.prompt(
                `Hoeveel BANKRENNERS per speler?\n\nStandaard: 6`,
                "6"
            );

            if (aantalBankInput === null) {
                return alert("Geannuleerd. Er is niets aangepast.");
            }

            const aantalBasis = Number(aantalBasisInput);
            const aantalBank = Number(aantalBankInput);

            if (!Number.isInteger(aantalBasis) || !Number.isInteger(aantalBank)) {
                return alert("Gebruik alleen hele getallen.");
            }

            if (aantalBasis < 1 || aantalBank < 0) {
                return alert("Basisrenners moet minstens 1 zijn. Bankrenners mag 0 of hoger zijn.");
            }

            const bevestiging = window.prompt(
                `Volgende koers starten met:\n\nBasisrenners: ${aantalBasis}\nBankrenners: ${aantalBank}\nTotaal per speler: ${aantalBasis + aantalBank}\n\nOude drafts en scores blijven bewaard.\n\nTyp START om te bevestigen.`
            );

            if (bevestiging !== "START") {
                return alert("Geannuleerd. Er is niets aangepast.");
            }

            const response = await runRaceLifecycle({
                aantalBasis,
                aantalBank,
            });

            const resultaten = response.data.resultaten || [];

            const tekst = resultaten.map((r) => {
                if (r.actie === "nieuwe_draft_aangemaakt") {
                    return `✅ Nieuwe koers gestart: ${r.vorigeWedstrijd} → ${r.nieuweWedstrijd}`;
                }

                return `⚠️ ${r.actie}: ${r.reden || "geen reden"}`;
            }).join("\n");

            alert(tekst);
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.details || err.response?.data?.error || "Lifecycle mislukt");
        } finally {
            setLoading(false);
        }
    }

    async function testDraftInstellingenPopup() {
        const aantalBasisInput = window.prompt(
            "TEST: Hoeveel BASISRENNERS per speler?",
            "12"
        );

        if (aantalBasisInput === null) return;

        const aantalBankInput = window.prompt(
            "TEST: Hoeveel BANKRENNERS per speler?",
            "6"
        );

        if (aantalBankInput === null) return;

        alert(
            `Test gelukt:\n\nBasisrenners: ${aantalBasisInput}\nBankrenners: ${aantalBankInput}\nTotaal: ${Number(aantalBasisInput) + Number(aantalBankInput)}`
        );
    }

    async function verwijderAlleRenners() {
        if (!window.confirm("Weet je ZEKER dat je alle renners wilt verwijderen? Dit kan niet ongedaan worden gemaakt!")) return;
        try {
            setLoading(true);
            await deleteAllRenners();
            alert("Alle renners zijn succesvol verwijderd!");
            fetchData();
        } catch (err) {
            alert("Er is iets misgegaan bij het verwijderen van de renners.");
        } finally {
            setLoading(false);
        }
    }

    const handleKlassiekerImport = async () => {
        if (!klassiekerUrl) return alert("Plak eerst een PCS URL van de klassieker.");
        if (!klassiekerUrl.includes('procyclingstats.com')) return alert("Dit lijkt geen geldige PCS link te zijn.");

        setLoading(true);
        try {
            const res = await importKlassiekerAlsRit(klassiekerUrl);
            alert(res.data?.message || "Klassieker succesvol toegevoegd en gescrapet!");
            setKlassiekerUrl('');
            await fetchData();
        } catch (err) {
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
            setSysteemMelding("❌ Fout bij het starten van de sync.");
            setForcingSync(false);
        }
    }

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
                    <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #334155' }}>
                        <h3>Systeem Acties</h3>
                        <p className="small-muted" style={{ marginBottom: '15px' }}>
                            Forceer de automatische scraper, controleer koersen of voer handmatig data in.
                        </p>

                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={handleForceSync} className="pill-btn" disabled={forcingSync} style={{ backgroundColor: forcingSync ? "#475569" : "#10b981", color: "white", fontWeight: "bold", cursor: forcingSync ? "not-allowed" : "pointer", opacity: forcingSync ? 0.7 : 1 }}>
                                {forcingSync ? "🚀 Aan het scrapen..." : "⚙️ Forceer Auto-Sync"}
                            </button>

                            <button
                                className="pill-btn"
                                onClick={testDraftInstellingenPopup}
                                style={{ background: "#8b5cf6", color: "white" }}
                            >
                                🧪 Test draft instellingen
                            </button>

                            <button className="pill-btn" onClick={handleRaceLifecycle} disabled={loading} style={{ background: '#3b82f6', color: 'white' }}>
                                ➡️ Preview volgende koers
                            </button>

                            <button
                                onClick={() => setIsManualResultModalOpen(true)}
                                className="pill-btn"
                                style={{ background: '#f59e0b', color: 'white', fontWeight: 'bold' }}
                            >
                                ✏️ Handmatige Uitslag
                            </button>
                        </div>

                        {systeemMelding && (
                            <div style={{ marginTop: "15px", padding: "10px", borderRadius: "4px", backgroundColor: systeemMelding.includes("❌") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)", color: systeemMelding.includes("❌") ? "#ef4444" : "#10b981", borderLeft: `4px solid ${systeemMelding.includes("❌") ? "#ef4444" : "#10b981"}` }}>
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
                            <select className="admin-select-custom" value={selectedWedstrijd} onChange={(e) => setSelectedWedstrijd(e.target.value)}>
                                <option value="">Alle Wedstrijden</option>
                                {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} ({w.jaar})</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="admin-list">
                        {gefilterdeRitten.slice().sort((a, b) => a.rit_nummer - b.rit_nummer).map((rit) => (
                            <div key={rit.id} className="admin-row list-row-admin">
                                <span><strong>Rit {rit.rit_nummer}</strong>: {rit.naam || 'Etappe'}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <span className={`status-pill ${rit.gescrapet ? 'done' : 'open'}`}>{rit.gescrapet ? '✅ Gescrapet' : '⏳ Open'}</span>
                                    <button className="pill-btn" onClick={() => handleScrapeRit(rit.id, rit.rit_nummer)} disabled={loading}>{rit.gescrapet ? 'Re-scrape' : 'Scrape Rit'}</button>
                                </div>
                            </div>
                        ))}
                        {gefilterdeRitten.length === 0 && <div className="empty-state">Geen ritten gevonden voor deze tour.</div>}
                    </div>
                </section>
            )}

            {activeTab === 'renners' && (
                <section className="panel card">
                    <div className="admin-header-flex" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '1rem' }}>
                        <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>Alle Renners ({gefilterdeRenners.length}/{renners.length})</h3>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <input
                                type="text"
                                className="draft-search-input"
                                placeholder="Zoek renner..."
                                value={zoekTerm}
                                onChange={(e) => setZoekTerm(e.target.value)}
                                style={{ margin: 0, width: "220px", padding: "10px 15px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#161616", color: "#fff" }}
                            />
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="pill-btn"
                                style={{ backgroundColor: "#22d3ee", color: "#0f172a", fontWeight: "bold", border: "none", margin: 0, whiteSpace: 'nowrap' }}
                            >
                                + Handmatig Toevoegen
                            </button>
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
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                                                </svg>
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
                            <button className="super-import-btn" onClick={handleFullImport} disabled={loading}>
                                {loading ? <span className="spinner"></span> : 'Start Import'}
                            </button>
                        </div>
                    </div>

                    <div className="super-import-container" style={{ marginBottom: "2rem", borderTop: "1px solid #334155", paddingTop: "2rem" }}>
                        <div className="super-import-header">
                            <div>
                                <h4>Klassieker Toevoegen (Als Rit)</h4>
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
                            <button className="super-import-btn" onClick={handleKlassiekerImport} disabled={loading} style={{ backgroundColor: "#22d3ee", color: "#000" }}>
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
                                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', color: '#3b82f6', cursor: 'pointer', transition: 'all 0.2s ease-in-out' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.querySelector('svg').style.transform = 'rotate(180deg)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.querySelector('svg').style.transform = 'rotate(0deg)'; }}
                                                onClick={() => handleSyncSingleRace(w.id)}
                                                title="Synchroniseer datums en starttijden"
                                            >
                                                <svg style={{ transition: 'transform 0.4s ease' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                        <select className="admin-select-custom" value={selectedWedstrijd} onChange={(e) => setSelectedWedstrijd(e.target.value)} style={{ marginLeft: "1rem" }}>
                            <option value="">Kies wedstrijd</option>
                            {wedstrijden.map((w) => <option key={w.id} value={w.id}>{w.naam} ({w.jaar})</option>)}
                        </select>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button className="pill-btn" onClick={handleDeleteAllDrafts} style={{ background: 'var(--red)', color: 'white' }}>
                                🗑️ Alles Leegmaken
                            </button>
                            <button className="pill-btn" onClick={() => handleSyncStartlijst(selectedWedstrijd)} disabled={!selectedWedstrijd}>
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

            {/* --- DE MODAL VOOR HANDMATIGE UITSLAGEN --- */}
            {isManualResultModalOpen && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                    <div className="card" style={{ backgroundColor: "#161616", padding: "2rem", borderRadius: "12px", width: "95%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", border: "1px solid #f59e0b" }}>
                        <h2 style={{ marginTop: 0, color: "#f59e0b", marginBottom: "1.5rem" }}>✏️ Handmatige Uitslag Invoeren</h2>

                        <form onSubmit={handleSaveManualResult}>
                            <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", color: "#94a3b8", marginBottom: "5px" }}>1. Kies Tour</label>
                                    <select required value={manualWedstrijdId} onChange={(e) => { setManualWedstrijdId(e.target.value); setManualRitId(''); }} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #333", backgroundColor: "#0f172a", color: "#fff" }}>
                                        <option value="">Selecteer Tour...</option>
                                        {wedstrijden.map(w => <option key={w.id} value={w.id}>{w.naam} ({w.jaar})</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", color: "#94a3b8", marginBottom: "5px" }}>2. Kies Etappe</label>
                                    <select required value={manualRitId} onChange={(e) => setManualRitId(e.target.value)} disabled={!manualWedstrijdId} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #333", backgroundColor: "#0f172a", color: "#fff" }}>
                                        <option value="">Selecteer Etappe...</option>
                                        {manualRitten.map(r => <option key={r.id} value={r.id}>Rit {r.rit_nummer}: {r.naam}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ borderBottom: "1px solid #333", margin: "1.5rem 0" }}></div>

                            {/* Top 25 met slimme filter tegen dubbele renners */}
                            <h3 style={{ color: "#fff", marginBottom: "1rem" }}>Top 25 Uitslag</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "2rem" }}>
                                {Array.from({ length: 25 }).map((_, index) => {
                                    // FILTER: Toon alleen renners die nog NIET gekozen zijn in de rest van de Top 25, 
                                    // óf de renner die momenteel al in dit specifieke vakje zit.
                                    const beschikbareRenners = startlijstRenners.filter(r =>
                                        !manualTop25.includes(r.id) || manualTop25[index] === r.id
                                    );

                                    return (
                                        <div key={index} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                            <span style={{ width: "25px", color: "#22d3ee", fontWeight: "bold" }}>{index + 1}.</span>
                                            <ZoekbareRennerSelect
                                                renners={beschikbareRenners}
                                                value={manualTop25[index]}
                                                onChange={(val) => { const newArr = [...manualTop25]; newArr[index] = val; setManualTop25(newArr); }}
                                                placeholder={`Renner ${index + 1}...`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Truien met de nieuwe Zoekbare Dropdowns */}
                            <h3 style={{ color: "#fff", marginBottom: "1rem" }}>Truidragers (na deze rit)</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "2rem" }}>
                                <div>
                                    <label style={{ display: "block", color: "#fbbf24", fontWeight: "bold", marginBottom: "8px" }}>👑 Algemeen (Geel/Roze/Rood)</label>
                                    <ZoekbareRennerSelect renners={startlijstRenners} value={manualTruien.algemeen} onChange={(val) => setManualTruien({ ...manualTruien, algemeen: val })} placeholder="Klassementsleider..." />
                                </div>
                                <div>
                                    <label style={{ display: "block", color: "#22c55e", fontWeight: "bold", marginBottom: "8px" }}>⚡ Punten (Groen/Paars)</label>
                                    <ZoekbareRennerSelect renners={startlijstRenners} value={manualTruien.punten} onChange={(val) => setManualTruien({ ...manualTruien, punten: val })} placeholder="Puntenleider..." />
                                </div>
                                <div>
                                    <label style={{ display: "block", color: "#3b82f6", fontWeight: "bold", marginBottom: "8px" }}>⛰️ Berg (Bollen/Blauw)</label>
                                    <ZoekbareRennerSelect renners={startlijstRenners} value={manualTruien.berg} onChange={(val) => setManualTruien({ ...manualTruien, berg: val })} placeholder="Bergkoning..." />
                                </div>
                                <div>
                                    <label style={{ display: "block", color: "#cbd5e1", fontWeight: "bold", marginBottom: "8px" }}>👶 Jongeren (Wit)</label>
                                    <ZoekbareRennerSelect renners={startlijstRenners} value={manualTruien.jongeren} onChange={(val) => setManualTruien({ ...manualTruien, jongeren: val })} placeholder="Beste jongere..." />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                                <button type="button" onClick={() => setIsManualResultModalOpen(false)} style={{ flex: 1, padding: "12px", background: "none", border: "1px solid #333", color: "#fff", borderRadius: "8px", cursor: "pointer" }}>
                                    Annuleren
                                </button>
                                <button type="submit" disabled={loadingManual} style={{ flex: 1, padding: "12px", backgroundColor: "#f59e0b", border: "none", color: "#fff", fontWeight: "bold", borderRadius: "8px", cursor: "pointer" }}>
                                    {loadingManual ? "Opslaan..." : "Uitslag Opslaan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DE POP-UP VOOR RENNERS TOEVOEGEN */}
            {isModalOpen && (
                <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                    <div className="card" style={{ backgroundColor: "#161616", padding: "2rem", borderRadius: "12px", width: "90%", maxWidth: "500px", border: "1px solid #22d3ee" }}>
                        <h2 style={{ marginTop: 0, color: "#22d3ee", marginBottom: "1.5rem" }}>Nieuwe Renner Toevoegen</h2>
                        <form onSubmit={handleVoegRennerToe} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                            <div style={{ display: "flex", gap: "1rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#94a3b8", fontSize: "0.9rem" }}>Voornaam</label>
                                    <input type="text" required value={formData.voornaam} onChange={(e) => setFormData({ ...formData, voornaam: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#0f172a", color: "#fff" }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: "block", marginBottom: "0.5rem", color: "#94a3b8", fontSize: "0.9rem" }}>Achternaam</label>
                                    <input type="text" required value={formData.achternaam} onChange={(e) => setFormData({ ...formData, achternaam: e.target.value })} style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #333", backgroundColor: "#0f172a", color: "#fff" }} />
                                </div>
                            </div>
                            <div>
                                {/* In je modal return () ergens onderaan: */}
                                <select
                                    value={formData.wedstrijd_id}
                                    onChange={(e) => setFormData({ ...formData, wedstrijd_id: e.target.value })}
                                    required
                                >
                                    <option value="">-- Kies een wedstrijd --</option>
                                    {wedstrijden.map(w => (
                                        <option key={w.id} value={w.id}>{w.naam} ({w.jaar})</option>
                                    ))}
                                </select>
                            </div>
                            <p style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic", margin: 0 }}>
                                Automatische Slug: <strong style={{ color: "#22d3ee" }}>{genereerSlug(formData.voornaam, formData.achternaam) || "..."}</strong>
                            </p>
                            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: "12px", background: "none", border: "1px solid #333", color: "#fff", borderRadius: "8px", cursor: "pointer" }}>
                                    Annuleren
                                </button>
                                <button type="submit" disabled={loadingToevoegen} style={{ flex: 1, padding: "12px", backgroundColor: "#22d3ee", border: "none", color: "#0f172a", fontWeight: "bold", borderRadius: "8px", cursor: loadingToevoegen ? "not-allowed" : "pointer" }}>
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