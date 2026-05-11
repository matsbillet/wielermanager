import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getRittenVanWedstrijd,
  syncStartlijst,
  scrapePastRitten,
  resetAllRitten,
  resetRit // Zorg dat deze goed in je api.js staat!
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

  return (
    <div>
      <div className="section-head">
        <h2>{wedstrijd.naam}</h2>
        <Link className="section-link" to="/races">
          ← Terug naar koersenoverzicht
        </Link>
      </div>

      {melding && (
        <div
          style={{
            marginBottom: "1rem",
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

      <section className="banner card">
        <div className="banner-title">{wedstrijd.naam}</div>
        <div className="banner-sub">
          Jaar: {wedstrijd.jaar} • {wedstrijd.aantal_ritten} ritten
        </div>

        {/* Knoppen Groep */}
        <div
          style={{
            marginTop: "1.5rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {/* Startlijst Knop */}
          <div>
            <button
              onClick={handleSyncStartlist}
              className="pill-btn"
              disabled={syncingStartlist || scrapingPast}
              style={{
                backgroundColor: syncingStartlist ? "#475569" : "#22d3ee",
                color: "#0f172a",
                fontWeight: "bold",
                cursor:
                  syncingStartlist || scrapingPast ? "not-allowed" : "pointer",
                opacity: syncingStartlist || scrapingPast ? 0.7 : 1,
              }}
            >
              {syncingStartlist ? "⏳ Bezig..." : "👥 Importeer Startlijst"}
            </button>
          </div>

          {/* Bulk Scrape Knop */}
          <div>
            <button
              onClick={handleScrapePastRitten}
              className="pill-btn"
              disabled={scrapingPast || syncingStartlist}
              style={{
                backgroundColor: scrapingPast ? "#475569" : "#f59e0b",
                color: "#0f172a",
                fontWeight: "bold",
                cursor:
                  scrapingPast || syncingStartlist ? "not-allowed" : "pointer",
                opacity: scrapingPast || syncingStartlist ? 0.7 : 1,
              }}
            >
              {scrapingPast
                ? "⏳ Ritten scrapen..."
                : "⚡ Haal Gereden Ritten In"}
            </button>
          </div>

          {/* RESET KNOP VOOR DEMO */}
          <div>
            <button
              onClick={handleResetAll}
              className="pill-btn"
              disabled={resetingAll || syncingStartlist || scrapingPast}
              style={{
                backgroundColor: resetingAll ? "#475569" : "#ef4444", // Rood
                color: "white",
                fontWeight: "bold",
                cursor:
                  resetingAll || syncingStartlist || scrapingPast
                    ? "not-allowed"
                    : "pointer",
                opacity:
                  resetingAll || syncingStartlist || scrapingPast ? 0.7 : 1,
              }}
            >
              {resetingAll ? "⏳ Wissen..." : "🗑️ Reset Alle Ritten (Demo)"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: "0.8rem", marginTop: "1rem", opacity: 0.7 }}>
          Gebruik "Importeer Startlijst" om renners in te laden. Gebruik "Haal
          Gereden Ritten In" om ontbrekende uitslagen van eerdere dagen
          automatisch op te halen.
        </p>
      </section>

      <div className="section-head">
        <h2>Ritten</h2>
      </div>

      <section className="rit-grid">
        {gesorteerdeRitten.map((rit) => {
          // Bepaal de naam dynamisch, zodat we deze ook in de alert kunnen gebruiken
          const ritNaamWeergave =
            wedstrijd.slug === "voorjaarsklassiekers"
              ? rit.naam
              : `Rit ${rit.rit_nummer}`;

          return (
            <div
              key={rit.id}
              style={{ display: "flex", alignItems: "stretch", gap: "8px" }}
            >
              <Link
                to={`/rit/${rit.id}`}
                className={`rit-link ${rit.gescrapet ? "" : "pending"}`}
                style={{ flex: 1, margin: 0 }}
              >
                {ritNaamWeergave}
              </Link>

              {/* DE NIEUWE VERWIJDER / RESET KNOP */}
              <button
                onClick={() => handleResetRit(rit.id, ritNaamWeergave)}
                title={`${ritNaamWeergave} resetten`}
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "4px",
                  cursor: "pointer",
                  padding: "0 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}