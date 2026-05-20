import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getRittenVanWedstrijd,
  syncStartlijst,
  scrapePastRitten,
  resetAllRitten,
  resetRit,
  scrapeEindklassement,
  getEindklassement // Zorg dat deze goed in je api.js staat!
} from "../services/api";

export default function RaceDetailPage() {
  const { slug } = useParams();
  const [wedstrijdData, setWedstrijdData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Aparte loading states voor de knoppen
  const [syncingStartlist, setSyncingStartlist] = useState(false);
  const [scrapingPast, setScrapingPast] = useState(false);
  const [resetingAll, setResetingAll] = useState(false);

  const [melding, setMelding] = useState("");
  const [scrapingEind, setScrapingEind] = useState(false);

  async function laadRitten() {
    try {
      const response = await getRittenVanWedstrijd(slug);
      setWedstrijdData(response.data);
    } catch (err) {
      console.error("Fout bij ophalen ritten:", err);
      setMelding("Kon ritten van deze wedstrijd niet laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    laadRitten();
  }, [slug]);

  // Functie: Startlijst Syncen
  async function handleSyncStartlist() {
    if (!wedstrijdData?.wedstrijd?.id) return;
    const bevestig = window.confirm(
      `Wil je de startlijst voor ${wedstrijdData.wedstrijd.naam} ophalen of bijwerken?`,
    );
    if (!bevestig) return;

    setSyncingStartlist(true);
    setMelding("");
    try {
      await syncStartlijst(wedstrijdData.wedstrijd.id);
      setMelding("✅ Startlijst succesvol gesynchroniseerd!");
    } catch (err) {
      console.error("Sync fout:", err);
      setMelding("❌ Fout bij het ophalen van de startlijst.");
    } finally {
      setSyncingStartlist(false);
    }
  }

  // Functie: Verleden ritten in bulk scrapen
  async function handleScrapePastRitten() {
    if (!wedstrijdData?.wedstrijd?.id) return;
    const bevestig = window.confirm(
      `Wil je alle ritten die al gereden zijn (maar nog niet gescrapet) nu inladen? Dit kan even duren.`,
    );
    if (!bevestig) return;

    setScrapingPast(true);
    setMelding("");
    try {
      const res = await scrapePastRitten(wedstrijdData.wedstrijd.id);
      setMelding(res.data.message || "✅ Ritten succesvol ingehaald!");
      await laadRitten();
    } catch (err) {
      console.error("Scrape fout:", err);
      setMelding("❌ Fout bij het scrapen van de ritten.");
    } finally {
      setScrapingPast(false);
    }
  }

  // Functie: Alle ritten in één keer resetten
  async function handleResetAll() {
    if (!wedstrijdData?.wedstrijd?.id) return;
    const bevestig = window.confirm(
      "⚠️ Weet je dit zeker? ALLE uitslagen van deze wedstrijd worden gewist. Dit is perfect voor de demo.",
    );
    if (!bevestig) return;

    setResetingAll(true);
    setMelding("");
    try {
      await resetAllRitten(wedstrijdData.wedstrijd.id);
      setMelding("✅ Alle ritten zijn gereset. Klaar voor de demo!");
      await laadRitten(); // Ververs de lijst zodat alles op 'pending' springt
    } catch (err) {
      setMelding("❌ Fout bij het resetten van de wedstrijd.");
    } finally {
      setResetingAll(false);
    }
  }

  // Functie: Één specifieke rit resetten (voor testen DNF's etc.)
  async function handleResetRit(ritId, ritNaam) {
    const bevestig = window.confirm(`Weet je zeker dat je ${ritNaam} wilt leegmaken en resetten?`);
    if (!bevestig) return;

    setMelding("");
    try {
      await resetRit(ritId);
      setMelding(`✅ ${ritNaam} succesvol gereset!`);
      await laadRitten(); // Ververs de lijst zodat hij weer op 'pending' springt
    } catch (err) {
      console.error("Fout bij resetten rit:", err);
      setMelding(`❌ Kon ${ritNaam} niet resetten.`);
    }
  }

  if (loading) return <div>Laden van ritten...</div>;
  if (!wedstrijdData) return <div>Geen wedstrijdgegevens gevonden.</div>;

  const { wedstrijd, ritten } = wedstrijdData;

  const gesorteerdeRitten = [...ritten].sort((a, b) => {
    // Sorteer klassiekers op datum
    if (wedstrijd.slug === "voorjaarsklassiekers") {
      return new Date(a.starttijd) - new Date(b.starttijd);
    }
    // Sorteer alle andere koersen (Tour, Giro, etc.) altijd netjes op rit nummer (1 t/m 21)
    return a.rit_nummer - b.rit_nummer;
  });

  async function handleScrapeEindklassement() {
    if (!wedstrijdData?.wedstrijd?.id) return;
    const bevestig = window.confirm(`Eindklassementen ophalen voor ${wedstrijdData.wedstrijd.naam}? Doe dit pas als de wedstrijd volledig afgelopen is.`);
    if (!bevestig) return;

    setScrapingEind(true);
    setMelding("");
    try {
      const res = await scrapeEindklassement(wedstrijdData.wedstrijd.id);
      setMelding(res.data.message || "✅ Eindklassement opgeslagen!");
    } catch (err) {
      setMelding("❌ Fout bij ophalen van eindklassement.");
    } finally {
      setScrapingEind(false);
    }
  }

  const spelerKleuren = {
    "casper": "#22d3ee",
    "dries": "#facc15",
    "jonas": "#f87171",
    "roel": "#a855f7"
  };

  function getTruiStijl(data) {
    const alles = JSON.stringify(data || {}).toLowerCase();
    if (alles.includes("giro")) return {
      algemeen: { bg: "#E40071", text: "#FFFFFF", label: "Roze" },
      punten: { bg: "#6A1C7A", text: "#FFFFFF", label: "Paars" },
      berg: { bg: "#0072CE", text: "#FFFFFF", label: "Blauw" },
      jongeren: { bg: "#FFFFFF", text: "#0f172a", label: "Wit" }
    };
    if (alles.includes("vuelta")) return {
      algemeen: { bg: "#D70014", text: "#FFFFFF", label: "Rood" },
      punten: { bg: "#008B47", text: "#FFFFFF", label: "Groen" },
      berg: { bg: "#0072CE", text: "#0072CE", label: "Bollen (Blauw)" },
      jongeren: { bg: "#FFFFFF", text: "#0f172a", label: "Wit" }
    };
    return {
      algemeen: { bg: "#FCD116", text: "#0f172a", label: "Geel" },
      punten: { bg: "#009144", text: "#FFFFFF", label: "Groen" },
      berg: { bg: "#FFFFFF", text: "#D70014", label: "Bollen (Rood)" },
      jongeren: { bg: "#FFFFFF", text: "#0f172a", label: "Wit" }
    };
  }

  function EindklassementSectie({ wedstrijdId, wedstrijd }) {
    const [data, setData] = useState([]);
    const [laden, setLaden] = useState(true);

    useEffect(() => {
      async function laad() {
        try {
          const res = await getEindklassement(wedstrijdId);
          setData(res.data || []);
        } catch (err) {
          console.error("Fout bij laden eindklassement:", err);
        } finally {
          setLaden(false);
        }
      }
      laad();
    }, [wedstrijdId]);

    const truiStijlen = getTruiStijl(wedstrijd);
    const types = ['algemeen', 'punten', 'berg', 'jongeren'];

    if (laden) return <div>Eindklassement laden...</div>;
    if (data.length === 0) return null;

    return (
      <>
        <div className="section-head" style={{ marginTop: "2rem" }}>
          <h2>🏆 Eindklassement</h2>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem" }}>
          {types.map((type) => {
            const rijen = data.filter(r => r.type === type);
            if (rijen.length === 0) return null;
            const stijl = truiStijlen[type];

            return (
              <div key={type} className="card" style={{ padding: "1.5rem" }}>
                {/* Klassement header in de juiste trui-kleur */}
                <h3 style={{
                  color: stijl.bg,
                  textTransform: "uppercase",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  marginBottom: "1rem",
                  letterSpacing: "1px"
                }}>
                  {stijl.label}
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {rijen.map((rij) => {
                    const eigenaarKleur = rij.eigenaar
                      ? (spelerKleuren[rij.eigenaar] || "#ffffff")
                      : "#94a3b8";

                    return (
                      <div
                        key={rij.positie}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px",
                          borderRadius: "6px",
                          backgroundColor: rij.eigenaar ? `${eigenaarKleur}10` : "transparent",
                          borderBottom: "1px solid rgba(255,255,255,0.05)"
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {/* Positienummer */}
                          <span style={{ opacity: 0.5, width: "20px", fontSize: "0.85rem" }}>
                            #{rij.positie}
                          </span>

                          {/* Kleurbolletje */}
                          <span style={{
                            display: "inline-block",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: rij.eigenaar ? eigenaarKleur : "transparent",
                            border: `1px solid ${eigenaarKleur}`,
                            boxShadow: rij.eigenaar ? `0 0 8px ${eigenaarKleur}` : "none",
                            flexShrink: 0
                          }} />

                          {/* Rennernaam */}
                          <span style={{
                            fontSize: "0.9rem",
                            color: rij.eigenaar ? "#ffffff" : "#cbd5e1",
                            fontWeight: rij.eigenaar ? "600" : "400",
                            opacity: rij.eigenaar ? 1 : 0.8
                          }}>
                            {rij.renners?.naam}
                          </span>

                          {/* Spelerslabel */}
                          {rij.eigenaar && !rij.is_bank && (
                            <span style={{
                              fontSize: "0.75rem",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              backgroundColor: `${eigenaarKleur}20`,
                              color: eigenaarKleur,
                              fontWeight: "bold",
                              textTransform: "uppercase",  // ← toevoegen
                              letterSpacing: "0.5px"       // ← toevoegen voor leesbaarheid
                            }}>
                              {rij.eigenaar}
                            </span>
                          )}
                        </span>

                        {/* Punten in de trui-kleur */}
                        <span style={{ color: stijl.bg, fontWeight: "bold" }}>
                          {rij.punten}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </>
    );
  }

  return (
    // 1. OPGELOST: textAlign is weer "left" zodat de banner en teksten normaal staan
    <div style={{ textAlign: "left" }}>
      <style>{`
        .back-button { 
          background: none; 
          border: 1px solid #444; 
          color: #aaa; 
          padding: 8px 15px; 
          border-radius: 5px; 
          cursor: pointer; 
          display: inline-block;
          font-size: 14px;
          text-decoration: none; 
          transition: all 0.2s ease;
        }
        .back-button:hover { 
          border-color: #22d3ee; 
          color: #22d3ee; 
          background: rgba(34, 211, 238, 0.1); 
        }
      `}</style>

      {/* 2. OPGELOST: Header met titel links en de knop strak rechts op dezelfde lijn */}
      <div className="section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
        <h2 style={{ margin: 0 }}>{wedstrijd.naam}</h2>
        <Link className="back-button" to="/races">
          Terug naar koersenoverzicht ➡
        </Link>
      </div>

      {melding && (
        <div
          style={{
            marginBottom: "1rem",
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "4px",
            backgroundColor: melding.includes("✅")
              ? "rgba(34, 211, 238, 0.1)"
              : "rgba(239, 68, 68, 0.1)",
            borderLeft: `4px solid ${melding.includes("✅") ? "#22d3ee" : "#ef4444"}`,
          }}
        >
          {melding}
        </div>
      )}

      {/* Banner Sectie */}
      <section className="banner card" style={{ marginTop: "1rem", textAlign: "center" }}>
        <div className="banner-title">{wedstrijd.naam}</div>
        <div className="banner-sub">
          Jaar: {wedstrijd.jaar} • {wedstrijd.aantal_ritten} ritten
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
          <div>
            <button
              onClick={handleSyncStartlist}
              className="pill-btn"
              disabled={syncingStartlist || scrapingPast}
              style={{ backgroundColor: syncingStartlist ? "#475569" : "#22d3ee", color: "#0f172a", fontWeight: "bold", cursor: syncingStartlist || scrapingPast ? "not-allowed" : "pointer", opacity: syncingStartlist || scrapingPast ? 0.7 : 1 }}
            >
              {syncingStartlist ? "⏳ Bezig..." : "👥 Importeer Startlijst"}
            </button>
          </div>
          <div>
            <button
              onClick={handleScrapePastRitten}
              className="pill-btn"
              disabled={scrapingPast || syncingStartlist}
              style={{ backgroundColor: scrapingPast ? "#475569" : "#f59e0b", color: "#0f172a", fontWeight: "bold", cursor: scrapingPast || syncingStartlist ? "not-allowed" : "pointer", opacity: scrapingPast || syncingStartlist ? 0.7 : 1 }}
            >
              {scrapingPast ? "⏳ Ritten scrapen..." : "⚡ Haal Gereden Ritten In"}
            </button>
          </div>
          <div>
            <button
              onClick={handleResetAll}
              className="pill-btn"
              disabled={resetingAll || syncingStartlist || scrapingPast}
              style={{ backgroundColor: resetingAll ? "#475569" : "#ef4444", color: "white", fontWeight: "bold", cursor: resetingAll || syncingStartlist || scrapingPast ? "not-allowed" : "pointer", opacity: resetingAll || syncingStartlist || scrapingPast ? 0.7 : 1 }}
            >
              {resetingAll ? "⏳ Wissen..." : "🗑️ Reset Alle Ritten (Demo)"}
            </button>
          </div>
          <div>
            <button
              onClick={handleScrapeEindklassement}
              className="pill-btn"
              disabled={scrapingEind || syncingStartlist || scrapingPast}
              style={{ backgroundColor: scrapingEind ? "#475569" : "#a855f7", color: "white", fontWeight: "bold", cursor: scrapingEind ? "not-allowed" : "pointer", opacity: scrapingEind ? 0.7 : 1 }}
            >
              {scrapingEind ? "⏳ Ophalen..." : "🏆 Haal Eindklassement Op"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: "0.8rem", marginTop: "1rem", opacity: 0.7 }}>
          Gebruik "Importeer Startlijst" om renners in te laden. Gebruik "Haal Gereden Ritten In" om ontbrekende uitslagen van eerdere dagen automatisch op te halen.
        </p>
      </section>

      <div className="section-head" style={{ marginTop: "2rem" }}>
        <h2 style={{ textAlign: "left", margin: 0 }}>Ritten</h2>
      </div>

      {/* 3. OPGELOST: Slimmere grid. Als het klassiekers zijn, maken we de blokken breder (minmax 280px). Anders gebruiken we je standaard CSS voor normale Tours. */}
      <section
        className={wedstrijd.slug === "voorjaarsklassiekers" ? "" : "rit-grid"}
        style={{
          marginTop: "1rem",
          display: wedstrijd.slug === "voorjaarsklassiekers" ? "grid" : undefined,
          gridTemplateColumns: wedstrijd.slug === "voorjaarsklassiekers" ? "repeat(auto-fill, minmax(280px, 1fr))" : undefined,
          gap: "10px"
        }}
      >
        {gesorteerdeRitten.map((rit) => {
          const ritNaamWeergave = wedstrijd.slug === "voorjaarsklassiekers" ? rit.naam : `Rit ${rit.rit_nummer}`;

          return (
            <div key={rit.id} style={{ display: "flex", alignItems: "stretch", gap: "8px" }}>
              <Link
                to={`/rit/${rit.id}`}
                className={`rit-link ${rit.gescrapet ? "" : "pending"}`}
                style={{ flex: 1, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "10px" }}
              >
                {ritNaamWeergave}
              </Link>

              <button
                onClick={() => handleResetRit(rit.id, ritNaamWeergave)}
                title={`${ritNaamWeergave} resetten`}
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  padding: "0 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          );
        })}
      </section>

      {wedstrijd.status === 'finished' && (
        <EindklassementSectie wedstrijdId={wedstrijd.id} wedstrijd={wedstrijd} />
      )}
    </div>
  );
}
