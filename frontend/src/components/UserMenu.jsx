import { useNavigate } from "react-router-dom";

export default function UserMenu({ homeStyle = false, theme = "dark", toggleTheme }) {
    const navigate = useNavigate();
    const gebruiker = JSON.parse(localStorage.getItem("gebruiker"));

    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("gebruiker");
        navigate("/login");
    }

    if (!gebruiker) return null;

    return (
        <div className="user-menu">


            <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
                {theme === "dark" ? "🌙" : "☀️"}
            </button>

            <span className="user-name">
                👤 {gebruiker.naam.charAt(0).toUpperCase() + gebruiker.naam.slice(1)}
            </span>
            <button
                className={homeStyle ? "home-login" : "logout-btn"}
                onClick={handleLogout}
            >
                Uitloggen
            </button>
        </div>
    );
}