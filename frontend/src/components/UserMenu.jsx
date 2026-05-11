import { useNavigate } from 'react-router-dom';



export default function UserMenu({ homeStyle = false }) {
    const navigate = useNavigate();
    const gebruiker = JSON.parse(localStorage.getItem('gebruiker'));


    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('gebruiker');
        navigate('/login');
    }

    if (!gebruiker) return null;

    return (
        <div className="user-menu">
            <span className="user-name">👤 {gebruiker.naam}</span>
            <button className={homeStyle ? "home-login" : "logout-btn"} onClick={handleLogout}>
                Uitloggen
            </button>
        </div>
    );
}