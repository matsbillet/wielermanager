import { BrowserRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import UserMenu from "./components/UserMenu";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";

import LoginPage from "./pages/LoginPage";
import ScoreboardPage from "./pages/ScoreboardPage";
import DraftPage from "./pages/DraftPage";
import RitPage from "./pages/RitPage";
import AdminPage from "./pages/AdminPage";
import RacesPage from "./pages/RacesPage";
import RaceDetailPage from "./pages/RaceDetailPage";
import CompetitiesPage from "./pages/CompetitiePage";
import TeamsPage from "./pages/TeamsPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import DashboardPage from './pages/DashboardPage';

import logo from "./img/fietsimgneon.png";

function Layout() {
    const location = useLocation();
    const token = localStorage.getItem("token");
    const gebruiker = JSON.parse(localStorage.getItem("gebruiker"));
    const isLoginPage = location.pathname === "/";

    return (
        <div className="app-shell">
            {!isLoginPage && token && (
                <header className="topbar">
                    <div className="brand">
                        <img src={logo} alt="Wielermanager logo" className="logo" />
                        <span className="brand-text">WIELER MANAGER</span>
                    </div>

                    <nav className="main-nav">
                        <NavLink to="/dashboard">Dashboard</NavLink>
                        <NavLink to="/scoreboard/1">Scorebord</NavLink>
                        <NavLink to="/draft/1">Draft</NavLink>
                        <NavLink to="/teams/1">Teams</NavLink>
                        <NavLink to="/races">Koersen</NavLink>
                        {gebruiker?.is_admin && <NavLink to="/admin">Admin</NavLink>}
                    </nav>

                    <UserMenu />
                </header>
            )}

            <main className="page-shell">
                <Routes>
                    <Route path="/" element={<LoginPage />} />

                    <Route
                        path="/scoreboard/:competitieId"
                        element={
                            <ProtectedRoute>
                                <ScoreboardPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/scoreboard"
                        element={
                            <ProtectedRoute>
                                <ScoreboardPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/draft/:competitieId"
                        element={
                            <ProtectedRoute>
                                <DraftPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* <Route
                        path="/competities"
                        element={
                            <ProtectedRoute>
                                <CompetitiesPage />
                            </ProtectedRoute>
                        }
                    /> */}

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
                            <AdminRoute>
                                <AdminPage />
                            </AdminRoute>
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

                    <Route
                        path="/teams/:competitieId"
                        element={
                            <ProtectedRoute>
                                <TeamsPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teams/:competitieId/:sessieId/:spelerId"
                        element={
                            <ProtectedRoute>
                                <TeamDetailPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <DashboardPage />
                        </ProtectedRoute>
                    } />
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