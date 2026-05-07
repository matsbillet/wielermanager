import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getKlassiekersByYear } from "../services/api";
import klassiekerImg from "../img/horst.png";

export default function KlassiekerYearPage() {
  const { jaar } = useParams();
  const [klassiekers, setKlassiekers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [melding, setMelding] = useState("");

  useEffect(() => {
    async function laadKlassiekers() {
      try {
        const response = await getKlassiekersByYear(jaar);
        setKlassiekers(response.data || []);
      } catch (err) {
        console.error("Fout bij ophalen klassiekers:", err);
        setMelding("Kon klassiekers voor dit jaar niet laden.");
      } finally {
        setLoading(false);
      }
    }

    laadKlassiekers();
  }, [jaar]);

  if (loading) {
    return <div className="loading">Laden van klassiekers {jaar}...</div>;
  }

  return (
    <div className="races-container" style={{ padding: "2rem" }}>
      <div className="section-head" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h1 style={{ fontSize: "2.2rem", margin: 0 }}>Klassiekers {jaar}</h1>
          <span style={{ color: "#ccc", fontSize: "1rem" }}>
            {klassiekers.length} klassieker{klassiekers.length === 1 ? "" : "s"}
          </span>
        </div>
        <Link className="section-link" to="/races">
          ← Terug naar koersenoverzicht
        </Link>
      </div>

      {melding && <div className="error-msg">{melding}</div>}

      {klassiekers.length === 0 ? (
        <div style={{ color: "#fff", textAlign: "center", padding: "2rem" }}>
          Geen klassiekers gevonden voor {jaar}.
        </div>
      ) : (
        <section
          className="team-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {klassiekers.map((klassieker) => (
            <Link
              key={klassieker.id}
              to={
                klassieker.rit_id
                  ? `/rit/${klassieker.rit_id}`
                  : `/races/${klassieker.slug}`
              }
              className="race-card card"
              style={{
                textDecoration: "none",
                color: "inherit",
                borderTop: `4px solid #cccccc`,
                overflow: "hidden",
                transition: "transform 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "scale(1.02)")
              }
              onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <div
                className="race-card-image"
                style={{
                  height: "160px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <img
                  src={klassiekerImg}
                  alt={klassieker.naam}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    backgroundColor: "#cccccc",
                    color: "#000",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    fontWeight: "bold",
                  }}
                >
                  Klassieker
                </div>
              </div>

              <div className="race-card-body" style={{ padding: "1.2rem" }}>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem" }}>
                  {klassieker.naam}
                </h3>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    opacity: 0.7,
                    fontSize: "0.9rem",
                  }}
                >
                  <span>Rit {klassieker.rit_nummer || 1}</span>
                  <span>📅 {klassieker.jaar}</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
