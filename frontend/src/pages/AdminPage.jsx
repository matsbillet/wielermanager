import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AdminPage() {
    const [ritten, setRitten] = useState([]);
    const [renners, setRenners] = useState([]);
    const [newRit, setNewRit] = useState({ rit_nummer: '', naam: '', datum: '' });
    const [newRenner, setNewRenner] = useState({ naam: '', ploeg: '', prijs: '' });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const resRitten = await axios.get('http://localhost:3000/api/admin/ritten');
        const resRenners = await axios.get('http://localhost:3000/api/admin/renners');
        setRitten(resRitten.data);
        setRenners(resRenners.data);
    };

    // --- RITTEN ACTIONS ---
    const addRit = async () => {
        await axios.post('http://localhost:3000/api/admin/ritten/add', newRit);
        setNewRit({ rit_nummer: '', naam: '', datum: '' });
        fetchData();
    };

    const deleteRit = async (id) => {
        if (window.confirm("Zeker weten?")) {
            await axios.delete(`http://localhost:3000/api/admin/ritten/${id}`);
            fetchData();
        }
    };

    // --- RENNERS ACTIONS ---
    const addRenner = async () => {
        await axios.post('http://localhost:3000/api/admin/renners/add', newRenner);
        setNewRenner({ naam: '', ploeg: '', prijs: '' });
        fetchData();
    };

    const deleteRenner = async (id) => {
        if (window.confirm("Renner verwijderen?")) {
            await axios.delete(`http://localhost:3000/api/admin/renners/${id}`);
            fetchData();
        }
    };

    return (
        <div className="admin-container" style={{ padding: '20px' }}>
            <h2>Admin Dashboard</h2>

            {/* RITTEN BEHEER */}
            <section className="panel" style={{ marginBottom: '40px' }}>
                <h3>📅 Ritten Beheer</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <input type="number" placeholder="Nr" value={newRit.rit_nummer} onChange={e => setNewRit({ ...newRit, rit_nummer: e.target.value })} />
                    <input type="text" placeholder="Naam (bijv. Rit 1)" value={newRit.naam} onChange={e => setNewRit({ ...newRit, naam: e.target.value })} />
                    <input type="date" value={newRit.datum} onChange={e => setNewRit({ ...newRit, datum: e.target.value })} />
                    <button onClick={addRit} className="pill-btn">Toevoegen</button>
                </div>
                <table>
                    {ritten.map(rit => (
                        <tr key={rit.id}>
                            <td>Rit {rit.rit_nummer} - {rit.naam}</td>
                            <td><button onClick={() => deleteRit(rit.id)} style={{ color: 'red' }}>🗑️</button></td>
                        </tr>
                    ))}
                </table>
            </section>

            {/* RENNERS BEHEER */}
            <section className="panel">
                <h3>🚴 Renners Beheer</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <input type="text" placeholder="Naam" value={newRenner.naam} onChange={e => setNewRenner({ ...newRenner, naam: e.target.value })} />
                    <input type="text" placeholder="Ploeg" value={newRenner.ploeg} onChange={e => setNewRenner({ ...newRenner, ploeg: e.target.value })} />
                    <input type="number" placeholder="Prijs" value={newRenner.prijs} onChange={e => setNewRenner({ ...newRenner, prijs: e.target.value })} />
                    <button onClick={addRenner} className="pill-btn">Toevoegen</button>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table style={{ width: '100%' }}>
                        {renners.map(r => (
                            <tr key={r.id}>
                                <td>{r.naam} ({r.ploeg})</td>
                                <td>€{r.prijs}</td>
                                <td><button onClick={() => deleteRenner(r.id)} style={{ color: 'red' }}>🗑️</button></td>
                            </tr>
                        ))}
                    </table>
                </div>
            </section>
        </div>
    );
}