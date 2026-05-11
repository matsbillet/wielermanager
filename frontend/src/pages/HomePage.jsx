import { Link, useNavigate } from "react-router-dom";
import CountdownTimer from "../components/CountdownTimer";
import logo from "../img/fietsimgneon.png";
import heroImg from "../img/mainfoto.jpg";
import UserMenu from "../components/UserMenu";

export default function HomePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

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

        {/* Navigatieknoppen verwijderd */}

        <UserMenu homeStyle />
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
              to={token ? "/dashboard" : "/login"}
            >
              Ga naar
            </Link>
          </div>
        </div>

        <div className="hero-clock card">
          <CountdownTimer />
        </div>
      </section>

      {/* Home info cards verwijderd */}
    </div>
  );
}