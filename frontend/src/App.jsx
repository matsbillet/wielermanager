import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import ScoreboardPage from './pages/ScoreboardPage';
import DraftPage from './pages/DraftPage';
import RitPage from './pages/RitPage';
import AdminPage from './pages/AdminPage';

function Layout() {
    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="brand">🚴 Wielermanager</div>
                <nav className="main-nav">
                    <NavLink to="/" end>Scorebord</NavLink>
                    <NavLink to="/draft">Draft</NavLink>
                    <NavLink to="/admin">Admin</NavLink>
                </nav>
            </header>

            <main className="page-shell">
                <Routes>
                    <Route path="/" element={<ScoreboardPage />} />
                    <Route path="/draft" element={<DraftPage />} />
                    <Route path="/rit/:id" element={<RitPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <Layout />
        </BrowserRouter>
    );
}