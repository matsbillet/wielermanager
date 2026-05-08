import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRittenVanWedstrijd, syncStartlijst, scrapePastRitten } from "../services/api"; // Voeg scrapePastRitten toe

export default function RaceDetailPage() {
  const { slug } = useParams();
  const [wedstrijdData, setWedstrijdData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Aparte loading states voor de twee knoppen
  const [syncingStartlist, setSyncingStartlist] = useState(false);
  const [scrapingPast, setScrapingPast] = useState(false);

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
    const bevestig = window.confirm(`Wil je de startlijst voor ${wedstrijdData.wedstrijd.naam} ophalen of bijwerken?`);
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

  // NIEUWE FUNCTIE: Verleden ritten in bulk scrapen
  async function handleScrapePastRitten() {
    if (!wedstrijdData?.wedstrijd?.id) return;
    const bevestig = window.confirm(`Wil je alle ritten die al gereden zijn (maar nog niet gescrapet) nu inladen? Dit kan even duren.`);
    if (!bevestig) return;

    setScrapingPast(true);
    setMelding("");
    try {
      const res = await scrapePastRitten(wedstrijdData.wedstrijd.id);
      setMelding(res.data.message || "✅ Ritten succesvol ingehaald!");
      // Herlaad de ritten om de groene vinkjes/status te updaten
      await laadRitten();
    } catch (err) {
      console.error("Scrape fout:", err);
      setMelding("❌ Fout bij het scrapen van de ritten.");
    } finally {
      setScrapingPast(false);
    }
  }

  if (loading) return <div>Laden van ritten...</div>;
  if (!wedstrijdData) return <div>Geen wedstrijdgegevens gevonden.</div>;

  const { wedstrijd, ritten } = wedstrijdData;

  const gesorteerdeRitten = [...ritten].sort((a, b) => {
    return new Date(a.starttijd) - new Date(b.starttijd);
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
        <div style={{
          marginBottom: "1rem", padding: "1rem", borderRadius: "4px",
          backgroundColor: melding.includes("✅") ? "rgba(34, 211, 238, 0.1)" : "rgba(239, 68, 68, 0.1)",
          borderLeft: `4px solid ${melding.includes("✅") ? "#22d3ee" : "#ef4444"}`
        }}>
          {melding}
        </div>
      )}

      <section className="banner card">
        <div className="banner-title">{wedstrijd.naam}</div>
        <div className="banner-sub">
          Jaar: {wedstrijd.jaar} • {wedstrijd.aantal_ritten} ritten
        </div>

        {/* Knoppen Groep */}
        <div style={{ marginTop: "1.5rem", display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>

          {/* Startlijst Knop */}
          <div>
            <button
              onClick={handleSyncStartlist}
              className="pill-btn"
              disabled={syncingStartlist || scrapingPast}
              style={{
                backgroundColor: syncingStartlist ? "#475569" : "#22d3ee",
                color: "#0f172a", fontWeight: "bold",
                cursor: (syncingStartlist || scrapingPast) ? "not-allowed" : "pointer",
                opacity: (syncingStartlist || scrapingPast) ? 0.7 : 1,
              }}
            >
              {syncingStartlist ? "⏳ Bezig..." : "👥 Importeer Startlijst"}
            </button>
          </div>

          {/* NIEUW: Bulk Scrape Knop */}
          <div>
            <button
              onClick={handleScrapePastRitten}
              className="pill-btn"
              disabled={scrapingPast || syncingStartlist}
              style={{
                backgroundColor: scrapingPast ? "#475569" : "#f59e0b", // Een mooie oranje/amber kleur voor deze actie
                color: "#0f172a", fontWeight: "bold",
                cursor: (scrapingPast || syncingStartlist) ? "not-allowed" : "pointer",
                opacity: (scrapingPast || syncingStartlist) ? 0.7 : 1,
              }}
            >
              {scrapingPast ? "⏳ Ritten scrapen..." : "⚡ Haal Gereden Ritten In"}
            </button>
          </div>

        </div>
        <p style={{ fontSize: "0.8rem", marginTop: "1rem", opacity: 0.7 }}>
          Gebruik "Importeer Startlijst" om renners in te laden. Gebruik "Haal Gereden Ritten In" om ontbrekende uitslagen van eerdere dagen automatisch op te halen.
        </p>
      </section>

      <div className="section-head">
        <h2>Ritten</h2>
      </div>

      <section className="rit-grid">
        {gesorteerdeRitten.map((rit) => (
          <Link
            key={rit.id}
            to={`/rit/${rit.id}`}
            className={`rit-link ${rit.gescrapet ? "" : "pending"}`}
          >
            {wedstrijd.slug === "voorjaarsklassiekers" ? rit.naam : `Rit ${rit.rit_nummer}`}
          </Link>
        ))}
      </section>
    </div>
  );
}