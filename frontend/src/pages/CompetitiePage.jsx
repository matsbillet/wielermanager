import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMijnCompetities, maakCompetitie, joinCompetitie, getWedstrijden } from "../services/api";

export default function CompetitiesPage() {
    const navigate = useNavigate();
    const [mijnCompetities, setMijnCompetities] = useState([]);
    const [wedstrijden, setWedstrijden] = useState([]);
    const [laden, setLaden] = useState(true);
    const [melding, setMelding] = useState("");

    // Formulier states
    const [nieuweNaam, setNieuweNaam] = useState("");
    const [gekozenWedstrijd, setGekozenWedstrijd] = useState("");
    const [joinId, setJoinId] = useState("");

    // Haal de ingelogde gebruiker op (pas dit aan als jij je user anders opslaat!)
    const gebruikerString = localStorage.getItem("gebruiker");
    const gebruiker = gebruikerString ? JSON.parse(gebruikerString) : null;

    useEffect(() => {
        if (!gebruiker) {
            navigate("/login");
            return;
        }
        laadData();
    }, []);

    async function laadData() {
        try {
            setLaden(true);
            const [compRes, wedRes] = await Promise.all([
                getMijnCompetities(gebruiker.id),
                getWedstrijden()
            ]);

            console.log("wedstrijden API response:", wedRes.data);
            setMijnCompetities(compRes.data || []);
            setWedstrijden(wedRes.data || []);
            if (wedRes.data && wedRes.data.length > 0) {
                setGekozenWedstrijd(wedRes.data[0].id); // Zet de eerste als standaard
            }
        } catch (err) {
            console.error(err);
            setMelding("Fout bij ophalen van gegevens.");
        } finally {
            setLaden(false);
        }
    }

    async function handleMaakCompetitie(e) {
        e.preventDefault();
        setMelding("");
        try {
            await maakCompetitie({
                naam: nieuweNaam,
                beheerderId: gebruiker.id,
                wedstrijdId: parseInt(gekozenWedstrijd)
            });
            setMelding("Competitie succesvol aangemaakt!");
            setNieuweNaam("");
            laadData(); // Ververs de lijst
        } catch (err) {
            setMelding(err.response?.data?.error || "Fout bij aanmaken.");
        }
    }

    async function handleJoin(e) {
        e.preventDefault();
        setMelding("");
        try {
            await joinCompetitie({
                gebruikerId: gebruiker.id,
                competitieId: parseInt(joinId)
            });
            setMelding("Succesvol aangesloten bij competitie!");
            setJoinId("");
            laadData(); // Ververs de lijst
        } catch (err) {
            setMelding(err.response?.data?.error || "Fout bij joinen.");
        }
    }

    if (laden) return <div>Laden...</div>;

    return (
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1rem" }}>
            <div className="section-head">
                <h1>Mijn Competities</h1>
            </div>

            {melding && <div className="draft-message">{melding}</div>}

            <section className="teams-grid" style={{ marginBottom: "3rem" }}>
                {mijnCompetities.length === 0 ? (
                    <p>Je zit nog in geen enkele competitie.</p>
                ) : (
                    mijnCompetities.map((comp) => (
                        <div key={comp.id} className="card team-card">
                            <div className="team-card-header">{comp.Naam}</div>
                            <div className="team-card-body">
                                <p><strong>Join Code (ID):</strong> {comp.id}</p>
                                <button
                                    className="pill-btn"
                                    onClick={() => navigate(`/draft/${comp.id}`)}
                                >
                                    Naar Draft Board
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </section>

            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
                {/* MAAK COMPETITIE FORMULIER */}
                <div className="card" style={{ flex: "1", padding: "1.5rem" }}>
                    <h3>Nieuwe Competitie Starten</h3>
                    <form onSubmit={handleMaakCompetitie} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
                        <input
                            type="text"
                            className="draft-search-input"
                            placeholder="Naam (bijv. Vrienden League)"
                            value={nieuweNaam}
                            onChange={(e) => setNieuweNaam(e.target.value)}
                            required
                        />
                        <select
                            className="draft-search-input"
                            value={gekozenWedstrijd || ""}
                            onChange={(e) => setGekozenWedstrijd(Number(e.target.value))}
                        >
                            <option value="" disabled>-- Kies een wedstrijd --</option>
                            {wedstrijden?.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.naam || w.Naam || "Onbekende wedstrijd"}
                                </option>
                            ))}
                        </select>
                        <button type="submit" className="pill-btn">Aanmaken</button>
                    </form>
                </div>

                {/* JOIN COMPETITIE FORMULIER */}
                <div className="card" style={{ flex: "1", padding: "1.5rem" }}>
                    <h3>Doe mee met vrienden</h3>
                    <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1rem" }}>
                        <input
                            type="number"
                            className="draft-search-input"
                            placeholder="Competitie ID (Join Code)"
                            value={joinId}
                            onChange={(e) => setJoinId(e.target.value)}
                            required
                        />
                        <button type="submit" className="pill-btn">Joinen</button>
                    </form>
                </div>
            </div>
        </div>
    );
}