import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { getWedstrijden } from "../services/api";

/* 🔥 Imports */
import giroImg from "../img/amandine-veyron-AH7hRkXMF0E-unsplash.jpg";
import tourImg from "../img/chris-karidis-nnzkZNYWHaU-unsplash.jpg";
import vueltaImg from "../img/dimitry-b-uDl5opHop7E-unsplash.jpg";
import klassiekerImg from "../img/horst.png";

export default function RacesPage() {
  const [wedstrijden, setWedstrijden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [melding, setMelding] = useState("");

  useEffect(() => {
    async function laadWedstrijden() {
      try {
        const response = await getWedstrijden();
        setWedstrijden(response.data);
      } catch (err) {
        console.error("Fout bij ophalen wedstrijden:", err);
        setMelding("Kon wedstrijden niet laden.");
      } finally {
        setLoading(false);
      }
    }
    laadWedstrijden();
  }, []);

  // 1. Sorteer en groepeer de data op jaar
  const groupedRaces = useMemo(() => {
    const groups = wedstrijden.reduce((acc, race) => {
      const year = race.jaar || "Onbekend";
      if (!acc[year]) acc[year] = [];
      acc[year].push(race);
      return acc;
    }, {});
    return groups;
  }, [wedstrijden]);

  const sortedYears = Object.keys(groupedRaces).sort((a, b) => b - a);

  // 2. Helper functie voor kleuren en afbeeldingen
  const getRaceTheme = (slug = "") => {
    const veiligeSlug = slug || "";

    if (veiligeSlug.includes("giro"))
      return { color: "#ff69b4", img: giroImg, label: "Giro" };

    if (veiligeSlug.includes("tour"))
      return { color: "#ffe100", img: tourImg, label: "Tour" };

    if (veiligeSlug.includes("vuelta"))
      return { color: "#ed1c24", img: vueltaImg, label: "Vuelta" };

    return { color: "#cccccc", img: klassiekerImg, label: "Klassieker" };
  };

  const getRaceOrder = (slug = "") => {
    const veiligeSlug = slug?.toLowerCase() || "";
    if (veiligeSlug.includes("giro")) return 0;
    if (veiligeSlug.includes("tour")) return 1;
    if (veiligeSlug.includes("vuelta")) return 2;
    return 3;
  };

  if (loading) return <div className="loading">Laden van wedstrijden...</div>;

  return (
    <div className="races-container" style={{ padding: "2rem" }}>
      <div className="section-head">
        <h1 style={{ fontSize: "2.5rem", marginBottom: "2rem" }}>
          Wielerkalender
        </h1>
      </div>

      {melding && <div className="error-msg">{melding}</div>}

      {sortedYears.map((jaar) => (
        <div
          key={jaar}
          className="year-section"
          style={{ marginBottom: "4rem" }}
        >
          {/* Jaar Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: "bold",
                color: "#fff",
                marginRight: "1rem",
              }}
            >
              {jaar}
            </h2>

            <div
              style={{
                flexGrow: 1,
                height: "2px",
                backgroundColor: "rgba(255,255,255,0.1)",
              }}
            />
          </div>

          <section
            className="team-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {groupedRaces[jaar]
              .slice()
              .sort((a, b) => getRaceOrder(a.slug) - getRaceOrder(b.slug))
              .map((wedstrijd) => {
                const theme = getRaceTheme(wedstrijd.slug);

                return (
                  <Link
                    key={wedstrijd.id}
                    to={wedstrijd.slug ? `/races/${wedstrijd.slug}` : "#"}
                    className="race-card card"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      borderTop: `4px solid ${theme.color}`,
                      overflow: "hidden",
                      transition: "transform 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.transform = "scale(1.02)")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.transform = "scale(1)")
                    }
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
                        src={theme.img}
                        alt={wedstrijd.naam}
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
                          backgroundColor: theme.color,
                          color: "#000",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                        }}
                      >
                        {theme.label}
                      </div>
                    </div>

                    <div
                      className="race-card-body"
                      style={{ padding: "1.2rem" }}
                    >
                      <h3
                        style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem" }}
                      >
                        {wedstrijd.naam}
                      </h3>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          opacity: 0.7,
                          fontSize: "0.9rem",
                        }}
                      >
                        <span>🏁 {wedstrijd.aantal_ritten} etappes</span>
                        <span>📅 {wedstrijd.jaar}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </section>
        </div>
      ))}
    </div>
  );
}
