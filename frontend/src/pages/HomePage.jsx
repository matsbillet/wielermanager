import { Link } from "react-router-dom";
import CountdownTimer from "../components/CountdownTimer";
import logo from "../img/fietsimgneon.png";
import heroImg from "../img/mainfoto.jpg";

const navItems = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Scorebord", to: "/scoreboard/1" },
  { label: "Draft", to: "/draft/1" },
  { label: "Teams", to: "/teams/1" },
  { label: "Koersen", to: "/races" },
];

export default function HomePage() {
  const token = localStorage.getItem("token");

  return (
    <div className="home-page">
      <header className="home-topbar">
        <Link
          to="/"
          className="home-brand"
          aria-label="Wielermanager home"
        >
          <img
            src={logo}
            alt="Wielermanager logo"
            className="home-logo"
          />

          <span>WIELER MANAGER</span>
        </Link>

        <nav
          className="home-nav"
          aria-label="Homepage navigatie"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* RECHTSBOVEN */}
        <Link
          className="home-login"
          to="/login"
        >
          Inloggen
        </Link>
      </header>

      <section
        className="home-hero"
        style={{
          backgroundImage: `linear-gradient(
            90deg,
            rgba(41,55,61,.96) 0%,
            rgba(41,55,61,.78) 42%,
            rgba(41,55,61,.18) 100%
          ), url(${heroImg})`,
        }}
      >
        <div className="hero-content">
          <h1>
            Stel je ploeg samen en strijd
            voor de trui.
          </h1>

          <p>
            Bouw je wielerteam, volg live
            punten en daag je vrienden uit
            in je eigen minicompetitie.
          </p>

          <div className="hero-actions">
            <Link
              className="btn-primary"
              to={token ? "/draft/1" : "/login"}
            >
              Start je ploeg
            </Link>

            <Link
              className="btn-secondary"
              to="/races"
            >
              Ontdek koersen
            </Link>
          </div>
        </div>

        <div className="hero-clock card">
          <CountdownTimer />
        </div>
      </section>

      <section
        className="home-card-grid"
        aria-label="Wielermanager acties"
      >
        <HomeCard
          icon="🚴"
          eyebrow="Maak je selectie"
          title="Kies je kopmannen"
          text="Balanceer budget, vorm en koersprogramma tot de perfecte ploeg."
          to={token ? "/draft/1" : "/login"}
        />

        <HomeCard
          icon="🏆"
          eyebrow="Live klassement"
          title="Volg elke puntensprint"
          text="Bekijk scores, ritwinnaars en truistatistieken in één strak dashboard."
          to="/scoreboard/1"
        />

        <HomeCard
          icon="👥"
          eyebrow="Minicompetities"
          title="Daag je vrienden uit"
          text="Vergelijk teams en claim de eer in jouw minicompetitie."
          to="/teams/1"
        />
      </section>
    </div>
  );
}

function HomeCard({
  icon,
  eyebrow,
  title,
  text,
  to,
}) {
  return (
    <Link
      className="home-info-card"
      to={to}
    >
      <span className="home-card-icon">
        {icon}
      </span>

      <span className="home-card-eyebrow">
        {eyebrow}
      </span>

      <strong>{title}</strong>

      <p>{text}</p>
    </Link>
  );
}