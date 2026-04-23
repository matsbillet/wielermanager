import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginGebruiker, registreerGebruiker } from '../services/api';

export default function LoginPage() {
    const navigate = useNavigate();

    const [isRegister, setIsRegister] = useState(false);
    const [naam, setNaam] = useState('');
    const [wachtwoord, setWachtwoord] = useState('');
    const [melding, setMelding] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setMelding('');

        try {
            let res;

            if (isRegister) {
                res = await registreerGebruiker({
                    naam,
                    wachtwoord
                });
            } else {
                res = await loginGebruiker({
                    naam,
                    wachtwoord
                });
            }

            localStorage.setItem('token', res.data.token);
            localStorage.setItem('gebruiker', JSON.stringify(res.data.gebruiker));

            navigate('/scoreboard');

        } catch (err) {
            setMelding(err.response?.data?.error || 'Fout bij login');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card card">
                <h1>{isRegister ? 'Account maken' : 'Inloggen'}</h1>

                {melding && <div className="auth-error">{melding}</div>}

                <form onSubmit={handleSubmit} className="auth-form">

                    <label>
                        Gebruikersnaam
                        <input
                            value={naam}
                            onChange={(e) => setNaam(e.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Wachtwoord
                        <input
                            type="password"
                            value={wachtwoord}
                            onChange={(e) => setWachtwoord(e.target.value)}
                            required
                        />
                    </label>

                    <button className="pill-btn" disabled={loading}>
                        {loading ? 'Bezig...' : isRegister ? 'Registreren' : 'Inloggen'}
                    </button>

                </form>

                <button
                    className="auth-switch"
                    onClick={() => {
                        setIsRegister(!isRegister);
                        setMelding('');
                    }}
                >
                    {isRegister
                        ? 'Heb je al een account? Log in'
                        : 'Nog geen account? Registreer'}
                </button>
            </div>
        </div>
    );
}