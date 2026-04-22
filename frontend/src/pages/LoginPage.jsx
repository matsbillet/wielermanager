import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginGebruiker, registreerGebruiker } from '../services/api';

export default function LoginPage() {
    const navigate = useNavigate();

    const [isRegister, setIsRegister] = useState(false);
    const [naam, setNaam] = useState('');
    const [email, setEmail] = useState('');
    const [wachtwoord, setWachtwoord] = useState('');
    const [loading, setLoading] = useState(false);
    const [melding, setMelding] = useState('');

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setMelding('');

        try {
            let response;

            if (isRegister) {
                response = await registreerGebruiker({
                    naam,
                    email,
                    wachtwoord
                });
            } else {
                response = await loginGebruiker({
                    naam,
                    wachtwoord
                });
            }

            localStorage.setItem('token', response.data.token);
            localStorage.setItem('gebruiker', JSON.stringify(response.data.gebruiker));

            navigate('/scoreboard');
        } catch (err) {
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                'Er ging iets mis.'
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card card">
                <h1>{isRegister ? 'Account aanmaken' : 'Inloggen'}</h1>
                <p className="auth-subtitle">
                    {isRegister
                        ? 'Maak een account aan om Wielermanager te gebruiken.'
                        : 'Log in om naar je scoreboard te gaan.'}
                </p>

                {melding && <div className="auth-error">{melding}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <label>
                        Naam
                        <input
                            type="text"
                            value={naam}
                            onChange={(e) => setNaam(e.target.value)}
                            required
                        />
                    </label>

                    {isRegister && (
                        <label>
                            E-mail
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </label>
                    )}

                    <label>
                        Wachtwoord
                        <input
                            type="password"
                            value={wachtwoord}
                            onChange={(e) => setWachtwoord(e.target.value)}
                            required
                        />
                    </label>

                    <button className="pill-btn" type="submit" disabled={loading}>
                        {loading
                            ? 'Bezig...'
                            : isRegister
                                ? 'Account aanmaken'
                                : 'Inloggen'}
                    </button>
                </form>

                <button
                    className="auth-switch"
                    onClick={() => {
                        setIsRegister(!isRegister);
                        setMelding('');
                    }}
                    type="button"
                >
                    {isRegister
                        ? 'Heb je al een account? Log in'
                        : 'Nog geen account? Maak er één aan'}
                </button>
            </div>
        </div>
    );
}