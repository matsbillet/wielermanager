import { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import {
    getDashboardStats,
    getSessieVoorCompetitie,
    getUitvallers,
    getScoreboard
} from "../services/api";
import CountdownTimer from "../components/CountdownTimer";

export default function DashboardPage() {
    const [stats, setStats] = useState({
        naam: "Manager",
        totaalPunten: 0,
        positie: "-",
        actieveRaces: 0
    });

    const [uitvallers, setUitvallers] = useState([]);
    const [lastStageTruien, setLastStageTruien] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const [isBulletinOpen, setIsBulletinOpen] = useState(false);
    const [slideIndex, setSlideIndex] = useState(0);
    const timerRef = useRef(null);

    useEffect(() => {
        function handleResize() { setIsMobile(window.innerWidth <= 768); }
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        async function laadDashboard() {
            try {
                const [statsRes, scoreboardRes] = await Promise.all([
                    getDashboardStats(),
                    getScoreboard(1)
                ]);

                setStats(statsRes.data);
                setLastStageTruien(scoreboardRes.data?.truien || null);

                const sessieResponse = await getSessieVoorCompetitie(1);
                const wId = sessieResponse.data?.wedstrijd_id || sessieResponse.data?.wedstrijden?.id;

                if (wId) {
                    const uitvallersResponse = await getUitvallers(wId);
                    setUitvallers(uitvallersResponse.data || []);
                }
            } catch (error) {
                console.error("Dashboard laden mislukt:", error);
            } finally {
                setLoading(false);
            }
        }
        laadDashboard();
    }, []);

    const slides = useMemo(() => {
        const items = [];
        const wNaam = (lastStageTruien?.wedstrijdNaam || "").toLowerCase();

        const isGiro = wNaam.includes("giro");
        const isVuelta = wNaam.includes("vuelta");

        if (lastStageTruien) {
            const t = lastStageTruien;
            if (t.algemeen && t.algemeen !== "-") {
                items.push({
                    tag: isGiro ? 'Roze Trui' : isVuelta ? 'Rode Trui' : 'Gele Trui',
                    title: t.algemeen,
                    desc: `Leider in het algemeen klassement na rit ${t.rit_nummer}.`,
                    icon: '👑', color: isGiro ? '#E40071' : isVuelta ? '#D70014' : '#FCD116'
                });
            }
            if (t.punten && t.punten !== "-") {
                items.push({
                    tag: 'Sprintklassement',
                    title: t.punten,
                    desc: 'De man met de snelste benen en de meeste regelmaat.',
                    icon: '⚡', color: isGiro ? '#6A1C7A' : '#008B47'
                });
            }
            if (t.berg && t.berg !== "-") {
                items.push({
                    tag: 'Bergklassement',
                    title: t.berg,
                    desc: 'De beste klimmer van dit moment in het peloton.',
                    icon: '⛰️', color: '#3b82f6'
                });
            }
        }

        uitvallers.forEach((u) => {
            items.push({
                tag: `Medisch Overzicht (${u.status})`,
                title: u.renners?.naam,
                desc: u.eigenaar !== "Niemand"
                    ? `Drama voor Team ${u.eigenaar}! Deze renner verlaat de koers.`
                    : `Heeft de koers verlaten. Gelukkig voor de spelers zat hij in geen enkel team.`,
                icon: '🚑', color: '#ef4444'
            });
        });

        if (items.length === 0) {
            items.push({
                tag: 'Peloton', title: 'Koers is stabiel',
                desc: 'Geen nieuwe uitvallers of klassementen bekend.',
                icon: '🚴', color: '#22d3ee'
            });
        }

        return items;
    }, [uitvallers, lastStageTruien]);

    const resetTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setSlideIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
        }, 5000);
    };

    useEffect(() => {
        resetTimer();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [slides.length]);

    if (loading) return <div style={{ padding: "100px", textAlign: "center", color: "#22d3ee" }}>Peloton komt op gang...</div>;

    return (
        <div className="dashboard-container" style={{ maxWidth: "1280px", margin: "0 auto", padding: isMobile ? "1rem" : "6rem 2rem 2rem" }}>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: "2rem", marginBottom: "4rem" }}>
                <section>
                    <div className="section-head"><h2>Snelle Acties</h2></div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                        <ActionLink to="/teams/1" title="Mijn Team" desc="Bekijk je selectie" icon="👥" />
                        <ActionLink to="/races" title="Kalender" desc="Bekijk alle ritten" icon="📅" />
                    </div>
                </section>
                <aside>
                    <div className="section-head"><h2>Live Status</h2></div>
                    <div className="card" style={{ padding: "1.25rem" }}><CountdownTimer /></div>
                </aside>
            </div>

            <div className="section-head">
                <h1>Welkom terug, {stats.naam}! 👋</h1>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "4rem" }}>
                <StatCard title="Totaal Punten" value={stats.totaalPunten} icon="🏆" color="#22d3ee" />
                <StatCard title="Ranglijst" value={`#${stats.positie}`} icon="📊" color="#fbbf24" />
                <StatCard title="Koersen" value={stats.actieveRaces} icon="🚴" color="#f87171" />
            </div>

            <div style={{ marginBottom: "4rem" }}>
                <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="live-dot"></span> Hoogtepunten
                    </h2>
                    <button onClick={() => setIsBulletinOpen(!isBulletinOpen)} className="toggle-btn">
                        {isBulletinOpen ? "Verberg Lijst ▲" : `Medisch overzicht (${uitvallers.length}) ▼`}
                    </button>
                </div>

                {/* HIGHLIGHTS CAROUSEL (NU MET PIJLTJES BINNENIN) */}
                <div className="highlight-wrapper">
                    <div className="highlight-view">
                        {/* Linker Knop */}
                        <button className="nav-btn left" onClick={() => { setSlideIndex(s => s === 0 ? slides.length - 1 : s - 1); resetTimer(); }}>&#10094;</button>

                        <div className="highlight-track" style={{ transform: `translateX(-${slideIndex * 100}%)` }}>
                            {slides.map((slide, i) => (
                                <div key={i} className="highlight-slide">
                                    <div className="highlight-icon" style={{ backgroundColor: `${slide.color}15`, border: `1px solid ${slide.color}40` }}>
                                        <span style={{ fontSize: "2rem" }}>{slide.icon}</span>
                                    </div>
                                    <div className="highlight-info">
                                        <span className="tag" style={{ color: slide.color }}>{slide.tag}</span>
                                        <h3>{slide.title}</h3>
                                        <p>{slide.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Rechter Knop */}
                        <button className="nav-btn right" onClick={() => { setSlideIndex(s => (s + 1) % slides.length); resetTimer(); }}>&#10095;</button>
                    </div>
                </div>

                <div className="dots">
                    {slides.map((_, i) => <div key={i} className={`dot ${i === slideIndex ? 'active' : ''}`} onClick={() => { setSlideIndex(i); resetTimer(); }} />)}
                </div>

                <div style={{ maxHeight: isBulletinOpen ? "800px" : "0px", overflow: "hidden", transition: "max-height 0.4s ease-in-out", opacity: isBulletinOpen ? 1 : 0, marginTop: "1rem" }}>
                    <div className="card" style={{ padding: "1.25rem", backgroundColor: "rgba(239, 68, 68, 0.03)", border: "1px solid rgba(239, 68, 68, 0.1)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "1rem" }}>
                            {uitvallers.map((u, i) => <UitvallerItem key={i} u={u} />)}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .live-dot { width: 10px; height: 10px; background: #22d3ee; border-radius: 50%; box-shadow: 0 0 8px #22d3ee; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { transform: scale(0.9); opacity: 0.5; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(0.9); opacity: 0.5; } }
                
                .toggle-btn { background: rgba(255,255,255,0.05); border: 1px solid #444; color: #aaa; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: 0.2s; }
                .toggle-btn:hover { border-color: #ef4444; color: #ef4444; }

                .highlight-wrapper { width: 100%; margin-top: 10px; }
                
                /* highlight-view is nu RELATIVE zodat de knoppen erin passen */
                .highlight-view { position: relative; width: 100%; height: 130px; overflow: hidden; background: #161616; border-radius: 12px; border: 1px solid #222; }
                .highlight-track { display: flex; height: 100%; transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1); }
                
                /* Padding verhoogd zodat tekst niet onder de pijlen schuift */
                .highlight-slide { min-width: 100%; display: flex; align-items: center; padding: 0 65px; gap: 20px; box-sizing: border-box; }
                
                .highlight-icon { width: 65px; height: 65px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .highlight-info h3 { margin: 2px 0; font-size: 1.3rem; color: #fff; }
                .highlight-info p { margin: 0; font-size: 0.9rem; color: #666; }
                .tag { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
                
                /* Vernieuwde knoppen IN de zwarte balk */
                .nav-btn { 
                    position: absolute; 
                    top: 0; 
                    height: 100%; 
                    width: 50px; 
                    background: rgba(0,0,0,0.2); 
                    border: none; 
                    color: #555; 
                    font-size: 1.8rem; 
                    cursor: pointer; 
                    transition: 0.3s; 
                    z-index: 10; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .nav-btn.left { left: 0; border-right: 1px solid rgba(255,255,255,0.05); }
                .nav-btn.right { right: 0; border-left: 1px solid rgba(255,255,255,0.05); }
                .nav-btn:hover { color: #fff; background: rgba(0,0,0,0.6); }

                .dots { display: flex; justify-content: center; gap: 6px; margin-top: 15px; }
                .dot { width: 6px; height: 6px; background: #333; border-radius: 50%; cursor: pointer; transition: 0.3s; }
                .dot.active { background: #22d3ee; transform: scale(1.3); }

                /* Responsiveness voor mobiel */
                @media (max-width: 768px) {
                    .nav-btn { display: none; }
                    .highlight-slide { padding: 0 20px; }
                }
            `}</style>
        </div>
    );
}

function StatCard({ title, value, icon, color }) {
    return (
        <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: "1.5rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{icon}</div>
            <div style={{ opacity: 0.7, fontSize: "0.8rem", textTransform: "uppercase" }}>{title}</div>
            <div style={{ fontSize: "1.8rem", fontWeight: "bold" }}>{value}</div>
        </div>
    );
}

function UitvallerItem({ u }) {
    return (
        <div style={{ padding: "0.75rem", backgroundColor: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
                <div style={{ fontWeight: "bold" }}>{u.renners?.naam}</div>
                <div style={{ fontSize: "0.75rem", color: "#666" }}>Team: {u.eigenaar || "Geen"}</div>
            </div>
            <span style={{ backgroundColor: "#ef4444", color: "#fff", padding: "3px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: "bold" }}>{u.status}</span>
        </div>
    );
}

function ActionLink({ to, title, desc, icon }) {
    return (
        <Link to={to} className="card action-card" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "1rem", padding: "1rem" }}>
            <div style={{ fontSize: "1.5rem" }}>{icon}</div>
            <div>
                <div style={{ fontWeight: "bold", color: "#fff" }}>{title}</div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>{desc}</div>
            </div>
        </Link>
    );
}