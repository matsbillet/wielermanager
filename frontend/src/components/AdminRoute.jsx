import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
    const token = localStorage.getItem('token');
    const gebruiker = JSON.parse(localStorage.getItem('gebruiker'));

    if (!token) {
        return <Navigate to="/" replace />;
    }

    if (!gebruiker?.is_admin) {
        return <Navigate to="/scoreboard" replace />;
    }

    return children;
}