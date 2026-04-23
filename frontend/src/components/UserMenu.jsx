import { useNavigate } from 'react-router-dom';

export default function UserMenu() {
    const navigate = useNavigate();
    const gebruiker = JSON.parse(localStorage.getItem('gebruiker'));

    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('gebruiker');
        navigate('/');
    }

    if (!gebruiker) return null;

    return (
        <div className="user-menu">
            <span className="user-name">👤 {gebruiker.naam}</span>
            <button className="logout-btn" onClick={handleLogout}>
                Uitloggen
            </button>
        </div>
    );
}