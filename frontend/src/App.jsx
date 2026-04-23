import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import UserMenu from './components/UserMenu';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import ScoreboardPage from './pages/ScoreboardPage';
import DraftPage from './pages/DraftPage';
import RitPage from './pages/RitPage';
import AdminPage from './pages/AdminPage';
import RacesPage from './pages/RacesPage';
import RaceDetailPage from './pages/RaceDetailPage';

function Layout() {
    const location = useLocation();
    const token = localStorage.getItem('token');
    const isLoginPage = location.pathname === '/';

    return (
        <div className="app-shell">
            {!isLoginPage && token && (
                <header className="topbar">
                    <div className="brand">🚴 Wielermanager</div>

                    <nav className="main-nav">
                        <NavLink to="/scoreboard">Scorebord</NavLink>
                        <NavLink to="/draft">Draft</NavLink>
                        <NavLink to="/races">Races</NavLink>
                        <NavLink to="/admin">Admin</NavLink>
                    </nav>

                    <UserMenu />
                </header>
            )}

            <main className="page-shell">
                <Routes>
                    <Route path="/" element={<LoginPage />} />

                    <Route
                        path="/scoreboard"
                        element={
                            <ProtectedRoute>
                                <ScoreboardPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/draft"
                        element={
                            <ProtectedRoute>
                                <DraftPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/rit/:id"
                        element={
                            <ProtectedRoute>
                                <RitPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <AdminPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/races"
                        element={
                            <ProtectedRoute>
                                <RacesPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/races/:slug"
                        element={
                            <ProtectedRoute>
                                <RaceDetailPage />
                            </ProtectedRoute>
                        }
                    />
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