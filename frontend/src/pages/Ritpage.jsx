// src/pages/RitPage.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRit, triggerScrape, getAdminDrafts } from "../services/api";

// Bepaal de juiste styling met een 'Greedy Search' over alle data
function getTruiStijl(ritData) {
  // Zet letterlijk ALLES wat we van de rit weten om naar kleine letters
  const alles = JSON.stringify(ritData || {}).toLowerCase();

  // Zit het woord 'giro' ergens in de naam, slug, of pcs-link?
  if (alles.includes("giro")) {
    return {
      algemeen: { bg: "#E40071", text: "#FFFFFF", border: "1px solid #E40071", label: "Roze" },
      punten: { bg: "#6A1C7A", text: "#FFFFFF", border: "1px solid #6A1C7A", label: "Paars" },
      berg: { bg: "#0072CE", text: "#FFFFFF", border: "1px solid #0072CE", label: "Blauw" },
      jongeren: { bg: "#FFFFFF", text: "#0f172a", border: "1px solid #cbd5e1", label: "Wit" }
    };
  }

  // Zit het woord 'vuelta' ergens in de data?
  if (alles.includes("vuelta")) {
    return {
      algemeen: { bg: "#D70014", text: "#FFFFFF", border: "1px solid #D70014", label: "Rood" },
      punten: { bg: "#008B47", text: "#FFFFFF", border: "1px solid #008B47", label: "Groen" },
      berg: { bg: "#FFFFFF", text: "#0072CE", border: "2px dashed #0072CE", label: "Bollen (Blauw)" },
      jongeren: { bg: "#FFFFFF", text: "#0f172a", border: "1px solid #cbd5e1", label: "Wit" }
    };
  }

  // Zo niet, dan is het de Tour de France (of een klassieker)
  return {
    algemeen: { bg: "#FCD116", text: "#0f172a", border: "1px solid #FCD116", label: "Geel" },
    punten: { bg: "#009144", text: "#FFFFFF", border: "1px solid #009144", label: "Groen" },
    berg: { bg: "#FFFFFF", text: "#D70014", border: "2px dashed #D70014", label: "Bollen (Rood)" },
    jongeren: { bg: "#FFFFFF", text: "#0f172a", border: "1px solid #cbd5e1", label: "Wit" }
  };
}

export default function RitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rit, setRit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scrapping, setScrapping] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [drafts, setDrafts] = useState([]);
  const { wedstrijdNaam } = useParams();

  const spelerKleuren = {
    "casper": "#22d3ee",
    "dries": "#facc15",
    "jonas": "#f87171",
    "roel": "#a855f7"
  };

  const formatName = (slug) => {
    if (!slug) return "";
    return slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // const laadData = async () => {
  //   try {
  //     // Haal beide tegelijk op
  //     const [resRit, resDrafts] = await Promise.all([
  //       getRit(id),
  //       getAdminDrafts()
  //     ]);

  //     setRit(resRit.data);
  //     setDrafts(resDrafts.data || []); // Sla de drafts op

  //     if (resRit.data && !resRit.data.gescrapet && !scrapping) {
  //       const isLocked = localStorage.getItem(`scraping_active_${id}`);
  //       if (!isLocked) {
  //         voerScrapeUit();
  //       }
  //     }
  //   } catch (err) {
  //     console.error("Fout bij laden:", err);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const voerScrapeUit = async () => {
    if (scrapping) return;

    setScrapping(true);
    localStorage.setItem(`scraping_active_${id}`, "true");
    setProgress(5);
    setStatusMsg("Peloton vertrekt voor de uitslag-rit...");

    try {
      triggerScrape(id).catch((err) => {
        if (err.response?.status === 429) {
          console.warn("Backend lock actief, we wachten op de resultaten...");
        }
      });

      const fakeProgress = setInterval(() => {
        setProgress((prev) => (prev < 40 ? prev + 1 : prev));
      }, 400);

      let dataGevonden = false;
      let pogingen = 0;
      const maxPogingen = 25;
      let vorigAantal = 0;

      while (!dataGevonden && pogingen < maxPogingen) {
        pogingen++;
        const refresh = await getRit(id);
        const huidigAantal = refresh.data?.ritresultaten?.length || 0;

        // We kijken of er tenminste één renner is die truipunten heeft (indien van toepassing)
        // Dit zorgt ervoor dat we niet stoppen voordat de trui-update klaar is
        const heeftTruiPunten = refresh.data?.ritresultaten?.some(
          (res) => res.trui_punten > 0,
        );

        if (huidigAantal >= 20 && (heeftTruiPunten || pogingen > 10)) {
          clearInterval(fakeProgress);
          setRit(refresh.data);
          dataGevonden = true;
          setProgress(100);

          const isLaatsteRit =
            refresh.data.rit_nummer === refresh.data.wedstrijden?.aantal_ritten;
          if (isLaatsteRit) {
            setStatusMsg(
              "🏁 Tour voltooid! Volgend jaar wordt voorbereid... 🏆",
            );
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            setStatusMsg("🏁 Finish bereikt! Uitslag volledig geladen.");
          }
        } else {
          vorigAantal = huidigAantal;
          setProgress((prev) => (prev < 90 ? prev + 3 : prev));
          setStatusMsg(
            `Uitslag en truipunten verwerken... (${huidigAantal} renners)`,
          );
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      setTimeout(() => {
        setScrapping(false);
        localStorage.removeItem(`scraping_active_${id}`);
      }, 1500);
    } catch (err) {
      console.error("Kritieke fout:", err);
      setStatusMsg("Er ging iets mis. Herstart de pagina.");
      setScrapping(false);
      localStorage.removeItem(`scraping_active_${id}`);
    }
  };

  useEffect(() => {
    const laadAlles = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const resRit = await getRit(id);
        const ritData = resRit.data;
        setRit(ritData);

        // Gebruik het ID van de wedstrijd die bij de rit hoort
        const wId = ritData.wedstrijd_id || ritData.wedstrijden?.id;

        if (wId) {
          const resDrafts = await getAdminDrafts(wId); // Nu met wedstrijdId
          setDrafts(resDrafts.data || []);
        }

        // 🔥 HIER IS DE FIX: Start de scraper als de rit leeg, niet gescrapet én niet geannuleerd is!
        if (!ritData.gescrapet && !ritData.geannuleerd) {
          const isLocked = localStorage.getItem(`scraping_active_${id}`);

          if (!isLocked) {
            voerScrapeUit();
          }
        }

      } catch (err) {
        console.error("Fout bij laden:", err);
      } finally {
        setLoading(false);
      }
    };
    laadAlles();

    // Zorg ervoor dat we voerScrapeUit kunnen aanroepen zonder linting errors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading)
    return (
      <div style={{ color: "#fff", padding: "40px", textAlign: "center" }}>
        Rit inladen...
      </div>
    );
  if (!rit)
    return (
      <div style={{ color: "#fff", padding: "40px", textAlign: "center" }}>
        Rit niet gevonden.
      </div>
    );

  // We zoeken op meerdere plekken voor de zekerheid (afhankelijk van hoe je backend het precies noemt)
  const koersNaam = rit?.wedstrijden?.naam ||
    rit?.wedstrijden?.slug ||
    rit?.wedstrijd?.naam ||
    "";

  // Handig om even te checken in je F12 console wat hij precies binnenkrijgt!
  console.log("Dynamische koersnaam gedetecteerd:", koersNaam);

  const truiStijlen = getTruiStijl(rit);
  return (
    <div className="rit-container">

      {scrapping && (
        <div className="scrape-overlay">
          <div className="loader-content">
            <div className="bike-animation">
              <span className="bike-emoji">🚴‍♂️💨</span>
            </div>
            {/* Extra trofee animatie als de tour voltooid is */}
            {statusMsg.includes("voltooid") && (
              <div
                style={{
                  fontSize: "2.5rem",
                  marginBottom: "10px",
                  animation: "fadeIn 0.5s",
                }}
              >
                🏆
              </div>
            )}
            <div className="loading-bar-container">
              <div
                className="loading-bar-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="status-text">{statusMsg}</p>
          </div>
        </div>
      )}

      <div
        className={`content-wrapper ${scrapping ? "is-loading" : "fade-in"}`}
      >
        <header className="rit-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h1 style={{ margin: 0 }}>
            Rit {rit.rit_nummer}: <span className="rit-naam">{rit.naam}</span>
          </h1>

          <button
            onClick={() => navigate(`/races/${rit?.wedstrijden?.slug}`)}
            className="back-button"
            style={{ margin: 0 }}
          >
            ⬅ Terug naar rittenoverzicht
          </button>
        </header>

        {rit.gescrapet && (
          <div className="jersey-row">
            {rit.leider_algemeen && (
              <div className="jersey" style={{ backgroundColor: truiStijlen.algemeen.bg, color: truiStijlen.algemeen.text, border: truiStijlen.algemeen.border }}>
                <b>{truiStijlen.algemeen.label}:</b> {formatName(rit.leider_algemeen)}
              </div>
            )}
            {rit.leider_punten && (
              <div className="jersey" style={{ backgroundColor: truiStijlen.punten.bg, color: truiStijlen.punten.text, border: truiStijlen.punten.border }}>
                <b>{truiStijlen.punten.label}:</b> {formatName(rit.leider_punten)}
              </div>
            )}
            {rit.leider_berg && (
              <div className="jersey" style={{ backgroundColor: truiStijlen.berg.bg, color: truiStijlen.berg.text, border: truiStijlen.berg.border }}>
                <b>{truiStijlen.berg.label}:</b> {formatName(rit.leider_berg)}
              </div>
            )}
            {rit.leider_jongeren && (
              <div className="jersey" style={{ backgroundColor: truiStijlen.jongeren.bg, color: truiStijlen.jongeren.text, border: truiStijlen.jongeren.border }}>
                <b>{truiStijlen.jongeren.label}:</b> {formatName(rit.leider_jongeren)}
              </div>
            )}
          </div>
        )}

        <section className="results-section">
          <div className="table-card">
            <h3>Daguitslag</h3>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Renner</th>
                  <th>Punten</th>
                </tr>
              </thead>
              <tbody>
                {rit.ritresultaten?.length > 0 ? (
                  rit.ritresultaten
                    .slice() // Maak een kopie om de originele state niet te muteren
                    .sort((a, b) => {
                      // Sorteer op positie, zet null/0 achteraan
                      const posA = a.positie || 999;
                      const posB = b.positie || 999;
                      return posA - posB;
                    })
                    .map((res, i) => {
                      // Zoek de eigenaar van de renner
                      // RitPage.jsx binnen de .map() van rit.ritresultaten

                      const rennerNaam = res.renners?.naam;
                      const draftGevonden = drafts.find(d => d.renner_id === res.renner_id);
                      const eigenaar = draftGevonden?.spelers?.gebruikers?.naam || null;

                      // Kleureninstellingen
                      const kleurNietGedraft = "#94a3b8"; // Een helderdere grijs (Slate-400) die goed leesbaar is op donker
                      const eigenaarKleur = eigenaar
                        ? (spelerKleuren[eigenaar.toLowerCase()] || "#ffffff")
                        : kleurNietGedraft;

                      return (
                        <tr
                          key={i}
                          style={{
                            // Alleen een subtiele gloed als de renner gedraft is
                            backgroundColor: eigenaar ? `${eigenaarKleur}10` : "transparent",
                            borderBottom: "1px solid #222"
                          }}
                        >
                          <td className="pos-cell" style={{ color: eigenaar ? "#22d3ee" : kleurNietGedraft }}>
                            {res.positie || "-"}
                          </td>

                          <td className="name-cell">
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>

                              {/* Het bolletje: fel bij draft, gedimd/leeg bij geen draft */}
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  backgroundColor: eigenaar ? eigenaarKleur : "transparent",
                                  border: `1px solid ${eigenaarKleur}`,
                                  boxShadow: eigenaar ? `0 0 8px ${eigenaarKleur}` : "none",
                                }}
                              ></span>

                              {/* Renner naam: Wit voor gedraft, zacht wit/grijs voor de rest */}
                              <span style={{
                                color: eigenaar ? "#ffffff" : "#cbd5e1",
                                fontWeight: eigenaar ? "600" : "400",
                                opacity: eigenaar ? 1 : 0.8
                              }}>
                                {res.renners?.naam}
                              </span>

                              {/* Spelersnaam label */}
                              {eigenaar && (
                                <span
                                  style={{
                                    fontSize: "0.75rem",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    backgroundColor: `${eigenaarKleur}20`,
                                    color: eigenaarKleur,
                                    fontWeight: "bold",
                                    marginLeft: "4px"
                                  }}
                                >
                                  {eigenaar}
                                </span>
                              )}

                              {res.trui_punten > 0 && <span style={{ marginLeft: "auto" }}>👕</span>}
                            </div>
                          </td>

                          <td className="points-cell" style={{
                            color: eigenaar ? "#fff" : kleurNietGedraft,
                            opacity: eigenaar ? 1 : 0.7
                          }}>
                            {res.punten + (res.trui_punten || 0)}
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td colSpan="3" className="empty-cell">
                      {scrapping
                        ? "Gegevens aan het laden..."
                        : "Nog geen uitslag verwerkt."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style>{`
                .rit-container { padding: 20px; max-width: 900px; margin: 0 auto; color: #fff; min-height: 100vh; }
                .back-button { background: none; border: 1px solid #444; color: #aaa; padding: 8px 15px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
                .back-button:hover { border-color: #22d3ee; color: #22d3ee; background: rgba(34, 211, 238, 0.1); }
                .rit-naam { color: #22d3ee; }
                .scrape-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #0a0a0a; display: flex; justify-content: center; align-items: center; z-index: 9999; }
                .loader-content { text-align: center; width: 80%; max-width: 450px; }
                .status-text { color: #22d3ee; font-family: monospace; margin-top: 20px; min-height: 20px; font-weight: bold; }
                .bike-animation { font-size: 3.5rem; margin-bottom: 20px; width: 100%; overflow: hidden; position: relative; height: 80px; }
                .bike-emoji { position: absolute; animation: driveRight 2.2s infinite linear; left: -100px; display: inline-block; transform: scaleX(-1); }
                @keyframes driveRight { 0% { left: -20%; opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { left: 110%; opacity: 0; } }
                .loading-bar-container { width: 100%; height: 10px; background: #1a1a1a; border-radius: 20px; overflow: hidden; border: 1px solid #333; }
                .loading-bar-fill { height: 100%; background: linear-gradient(90deg, #22d3ee, #00ff00); transition: width 0.4s ease; }
                .is-loading { opacity: 0.1; pointer-events: none; filter: blur(2px); }
                .fade-in { animation: fadeIn 0.5s forwards; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .jersey-row { display: flex; gap: 10px; margin-bottom: 30px; flex-wrap: wrap; }
                .jersey { padding: 10px 18px; border-radius: 50px; font-size: 14px; color: #000; font-weight: bold; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
                .table-card { background: #161616; border-radius: 12px; padding: 25px; border: 1px solid #222; }
                .results-table { width: 100%; border-collapse: collapse; }
                .results-table th { text-align: left; padding: 15px; border-bottom: 2px solid #22d3ee; color: #888; font-size: 0.8rem; text-transform: uppercase; }
                .results-table td { padding: 15px; border-bottom: 1px solid #222; }
                .pos-cell { color: #22d3ee; font-weight: bold; width: 60px; }
                .points-cell { text-align: right; font-weight: bold; }
                .empty-cell { text-align: center; padding: 40px; color: #444; font-style: italic; }
            `}</style>
    </div>
  );
}