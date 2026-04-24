import { useEffect, useMemo, useState } from 'react';
import { getBeschikbareRenners, getSpelers, kiesRenner, getTeams } from '../services/api';

const MAX_RENNERS_PER_SPELER = 18;

export default function DraftPage() {
    const [riders, setRiders] = useState([]);
    const [spelers, setSpelers] = useState([]);
    const [ladenPagina, setLadenPagina] = useState(true);
    const [loading, setLoading] = useState(false);
    const [melding, setMelding] = useState('');

    const [actieveSpelerIndex, setActieveSpelerIndex] = useState(0);
    const [richting, setRichting] = useState(1); // 1 = vooruit, -1 = achteruit
    const [draftKlaar, setDraftKlaar] = useState(false);
    const [gekozenTeller, setGekozenTeller] = useState({});
    const [teams, setTeams] = useState({});

    useEffect(() => {
        async function laadData() {
            try {
                const [rennersResponse, spelersResponse] = await Promise.all([
                    getBeschikbareRenners(),
                    getSpelers()
                ]);

                const spelersData = Array.isArray(spelersResponse.data)
                    ? spelersResponse.data
                    : [];

                setRiders(Array.isArray(rennersResponse.data) ? rennersResponse.data : []);
                setSpelers(spelersData);

                await laadTeams();

                const tellerInit = {};
                spelersData.forEach((speler) => {
                    tellerInit[speler.id] = speler.aantalGekozen || 0;
                });
                setGekozenTeller(tellerInit);

                const eersteNietVolleIndex = spelersData.findIndex(
                    (speler) => (tellerInit[speler.id] || 0) < MAX_RENNERS_PER_SPELER
                );

                if (eersteNietVolleIndex >= 0) {
                    setActieveSpelerIndex(eersteNietVolleIndex);
                }
            } catch (err) {
                console.error('Fout bij ophalen draft data:', err);
                setMelding('Kon draft data niet laden.');
            } finally {
                setLadenPagina(false);
            }
        }

        laadData();
    }, []);

    const actieveSpeler = spelers[actieveSpelerIndex] || null;

    const alleSpelersKlaar = useMemo(() => {
        if (spelers.length === 0) return false;
        return spelers.every(
            (speler) => (gekozenTeller[speler.id] || 0) >= MAX_RENNERS_PER_SPELER
        );
    }, [spelers, gekozenTeller]);

    const beurtVoorActieveSpeler = actieveSpeler
        ? (gekozenTeller[actieveSpeler.id] || 0) + 1
        : 1;

    useEffect(() => {
        if (alleSpelersKlaar && !draftKlaar) {
            setDraftKlaar(true);
            setMelding('Draft is gedaan, iedereen heeft 18 spelers gekozen.');
        }
    }, [alleSpelersKlaar, draftKlaar]);

    function bepaalVolgendeBeurt(huidigeIndex, huidigeRichting, teller) {
        const aantalSpelers = spelers.length;

        if (aantalSpelers === 0) {
            return { nextIndex: 0, nextRichting: 1 };
        }

        if (aantalSpelers === 1) {
            return { nextIndex: 0, nextRichting: 1 };
        }

        let nextIndex = huidigeIndex;
        let nextRichting = huidigeRichting;

        if (huidigeRichting === 1) {
            if (huidigeIndex === aantalSpelers - 1) {
                nextRichting = -1;
                nextIndex = huidigeIndex;
            } else {
                nextIndex = huidigeIndex + 1;
            }
        } else {
            if (huidigeIndex === 0) {
                nextRichting = 1;
                nextIndex = huidigeIndex;
            } else {
                nextIndex = huidigeIndex - 1;
            }
        }

        let safety = 0;

        while (
            spelers.length > 0 &&
            (teller[spelers[nextIndex].id] || 0) >= MAX_RENNERS_PER_SPELER &&
            safety < 100
        ) {
            safety += 1;

            if (nextRichting === 1) {
                if (nextIndex === aantalSpelers - 1) {
                    nextRichting = -1;
                } else {
                    nextIndex += 1;
                }
            } else {
                if (nextIndex === 0) {
                    nextRichting = 1;
                } else {
                    nextIndex -= 1;
                }
            }
        }

        return { nextIndex, nextRichting };
    }

    async function handleKiesRenner(rennerId, naam) {
        if (!actieveSpeler || draftKlaar) return;

        try {
            setLoading(true);
            setMelding('');

            await kiesRenner({
                spelerId: actieveSpeler.id,
                rennerId,
                huidigeBeurt: beurtVoorActieveSpeler
            });

            await laadTeams();

            setRiders((vorigeRiders) =>
                vorigeRiders.filter((rider) => rider.id !== rennerId)
            );

            setGekozenTeller((vorigeTeller) => {
                const nieuweTeller = {
                    ...vorigeTeller,
                    [actieveSpeler.id]: (vorigeTeller[actieveSpeler.id] || 0) + 1
                };

                const iedereenKlaar = spelers.every(
                    (speler) =>
                        (nieuweTeller[speler.id] || 0) >= MAX_RENNERS_PER_SPELER
                );

                if (iedereenKlaar) {
                    setDraftKlaar(true);
                    setMelding('Draft is gedaan, iedereen heeft 18 spelers gekozen.');
                    return nieuweTeller;
                }

                const { nextIndex, nextRichting } = bepaalVolgendeBeurt(
                    actieveSpelerIndex,
                    richting,
                    nieuweTeller
                );

                setActieveSpelerIndex(nextIndex);
                setRichting(nextRichting);
                setMelding(
                    `${naam} gekozen door ${actieveSpeler.naam}. Volgende beurt: ${spelers[nextIndex]?.naam || 'onbekend'}.`
                );

                return nieuweTeller;
            });
        } catch (err) {
            setMelding(
                err.response?.data?.error ||
                err.response?.data?.details ||
                'Fout bij kiezen van renner.'
            );
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const laadTeams = async () => {
        try {
            // We gebruiken hier sessieId 1 als voorbeeld (pas dit aan indien nodig)
            const response = await getTeams(1); //Momenteel hard coded
            setTeams(response.data);
        } catch (err) {
            console.error('Fout bij laden van teams:', err);
        }
    };

    if (ladenPagina) {
        return <div>Laden van draft data...</div>;
    }

    return (
        <div>
            {/* <section className="banner card draft-board">
                <div className="banner-title">Draft Board</div>
                <div className="banner-sub">Snake Draft - Pro Peloton League</div>

                <div className="draft-order">
                    {spelers.map((speler, index) => {
                        const gekozen = gekozenTeller[speler.id] || 0;
                        const isActief = !draftKlaar && index === actieveSpelerIndex;
                        const volgendeBeurtNummer = Math.min(gekozen + 1, MAX_RENNERS_PER_SPELER);

                        return (
                            <div key={speler.id} className="draft-slot panel">
                                <div>
                                    <strong>{speler.naam}</strong>
                                    <div className="small-muted">
                                        {gekozen}/{MAX_RENNERS_PER_SPELER} gekozen
                                    </div>
                                    {!draftKlaar && gekozen < MAX_RENNERS_PER_SPELER && (
                                        <div className="small-muted">
                                            Volgende beurt: {volgendeBeurtNummer}
                                        </div>
                                    )}
                                </div>

                                <span className={isActief ? 'yellow' : 'small-muted'}>
                                    {draftKlaar
                                        ? 'Klaar'
                                        : isActief
                                            ? `Picking now (beurt ${beurtVoorActieveSpeler})`
                                            : 'Waiting'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </section> */}

            {/* TITEL VAN DE PAGINA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '1rem', marginBottom: '1.25rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Live Draft Board</h1>
                <span style={{ fontSize: '0.75rem', color: '#6b6b67', fontFamily: 'monospace', letterSpacing: '0.02em' }}>Snake Draft — Pro Peloton League</span>
            </div>

            {/* GEÏNTEGREERD OVERZICHT: TEAMS + STATUS */}
            <section style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '10px',
                marginBottom: '3rem',
                background: '#111210',
                borderRadius: '12px',
                padding: '16px'
            }}>
                {spelers.map((speler, index) => {
                    const gekozen = gekozenTeller[speler.id] || 0;
                    const isActief = !draftKlaar && index === actieveSpelerIndex;
                    const isKlaar = gekozen >= MAX_RENNERS_PER_SPELER;
                    const spelerTeam = teams[speler.naam] || [];
                    const volgendeBeurtNummer = Math.min(gekozen + 1, MAX_RENNERS_PER_SPELER);
                    const pct = Math.round((gekozen / MAX_RENNERS_PER_SPELER) * 100);

                    return (
                        <div key={speler.id} style={{
                            background: '#181917',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '0.5px solid #2a2a28',
                            borderLeft: isActief ? '3px solid #00F5D4' : '0.5px solid #2a2a28',
                            transition: 'border-color 0.3s ease'
                        }}>
                            {/* HEADER */}
                            <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid #222221' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{
                                        fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase',
                                        letterSpacing: '0.06em',
                                        color: isActief ? '#00F5D4' : '#f0ede6'
                                    }}>
                                        {speler.naam}
                                    </span>
                                    {isActief && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.7rem', fontFamily: 'monospace', color: '#00F5D4', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                            <span style={{
                                                width: '6px', height: '6px', borderRadius: '50%', background: '#00F5D4',
                                                animation: 'livePulse 1.4s ease-in-out infinite'
                                            }} />
                                            Picking now
                                        </span>
                                    )}
                                    {!isActief && !isKlaar && (
                                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#44443f', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Waiting</span>
                                    )}
                                    {isKlaar && (
                                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#23dc87', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Klaar</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#6b6b67', fontFamily: 'monospace' }}>{gekozen} / {MAX_RENNERS_PER_SPELER} renners</span>
                                    {!draftKlaar && !isKlaar && (
                                        <span style={{ fontSize: '0.7rem', color: '#00F5D4', fontFamily: 'monospace' }}>Next: R{volgendeBeurtNummer}</span>
                                    )}
                                </div>
                            </div>

                            {/* PROGRESS BAR */}
                            <div style={{ height: '2px', background: '#222221', margin: '0 14px 10px' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: '#00F5D4', borderRadius: '1px', transition: 'width 0.4s ease' }} />
                            </div>

                            {/* RIDER LIST */}
                            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#6b6b67', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 14px 4px' }}>Basis (R1–12)</div>
                            <ul style={{ listStyle: 'none', padding: '0 14px', margin: '0 0 6px' }}>
                                {spelerTeam.filter(r => !r.isBank).map((r, i) => (
                                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid #1e1e1c' }}>
                                        <span style={{ fontSize: '0.8rem', color: isActief ? '#00F5D4' : '#b8b5ae', fontWeight: 500, letterSpacing: '0.02em' }}>{r.renner}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#44443f', fontFamily: 'monospace' }}>R{r.ronde}</span>
                                    </li>
                                ))}
                            </ul>

                            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#6b6b67', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 14px 4px' }}>De bank (R13–18)</div>
                            <ul style={{ listStyle: 'none', padding: '0 14px', margin: '0 0 12px' }}>
                                {spelerTeam.filter(r => r.isBank).map((r, i) => (
                                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.75rem', color: '#6b6b67', fontStyle: 'italic' }}>
                                        <span>{r.renner}</span>
                                        <span style={{ fontFamily: 'monospace' }}>R{r.ronde}</span>
                                    </li>
                                ))}
                                {spelerTeam.filter(r => r.isBank).length === 0 && (
                                    <li style={{ fontSize: '0.75rem', color: '#2a2a28', padding: '3px 0' }}>—</li>
                                )}
                            </ul>
                        </div>
                    );
                })}
            </section>

            <section className="turn-banner">
                <div>
                    <div className="rider-name">
                        {draftKlaar
                            ? 'Draft voltooid'
                            : `${actieveSpeler?.naam || 'Speler'} is aan de beurt`}
                    </div>
                    <p>
                        {draftKlaar
                            ? 'Iedereen heeft 18 spelers gekozen.'
                            : `Beurt ${beurtVoorActieveSpeler} - Selecteer een renner voor ${actieveSpeler?.naam || 'de actieve speler'}`}
                    </p>
                </div>

                <button className="pill-btn" disabled>
                    {loading ? 'Bezig...' : draftKlaar ? 'Draft klaar' : 'Draft actief'}
                </button>
            </section>

            {melding && (
                <div style={{ marginBottom: '1rem', fontWeight: 'bold' }}>
                    {melding}
                </div>
            )}

            <div className="section-head">
                <h2>Available Riders ({riders.length})</h2>
            </div>

            <section className="riders-grid">
                {riders.map((rider) => (
                    <article key={rider.id} className="rider-card card">
                        <div className="rider-image">🚴</div>

                        <div className="rider-body">
                            <div className="rider-topline">
                                <div className="rider-name">{rider.naam}</div>
                                <div className="rider-country">-</div>
                            </div>

                            <div style={{ marginTop: '1rem' }}>
                                <button
                                    className="pill-btn"
                                    onClick={() => handleKiesRenner(rider.id, rider.naam)}
                                    disabled={loading || draftKlaar || !actieveSpeler}
                                >
                                    {loading ? 'Bezig...' : `Kies ${rider.naam}`}
                                </button>
                            </div>
                        </div>
                    </article>
                ))}
            </section>
            {/* --- TEAM OVERZICHT SECTIE --- */}
            <div className="section-head" style={{ marginTop: '3rem' }}>
                <h2>Gekozen Teams</h2>
            </div>

            <section className="teams-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginTop: '1rem',
                marginBottom: '5rem'
            }}>
                {spelers.map((speler) => {
                    // Haal de renners voor deze specifieke speler uit de teams state
                    const spelerTeam = teams[speler.naam] || [];

                    return (
                        <div key={speler.id} className="card team-card">
                            <div className="panel-header" style={{ padding: '1rem', borderBottom: '1px solid #eee', fontWeight: 'bold', background: '#f9f9f9' }}>
                                Team {speler.naam}
                            </div>
                            <div style={{ padding: '1rem' }}>
                                {/* BASISOPSTELLING (Ronde 1-12) */}
                                <div className="small-muted" style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#666' }}>Basis (R1-12)</div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
                                    {spelerTeam.filter(r => !r.isBank).map((r, i) => (
                                        <li key={i} style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.9rem' }}>
                                            <span className="yellow" style={{ marginRight: '8px' }}>R{r.ronde}</span> {r.renner}
                                        </li>
                                    ))}
                                </ul>

                                {/* DE BANK (Ronde 13-18) */}
                                <div className="small-muted" style={{ marginBottom: '0.5rem', fontWeight: 'bold', color: '#666' }}>De Bank (R13-18)</div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {spelerTeam.filter(r => r.isBank).map((r, i) => (
                                        <li key={i} style={{ padding: '4px 0', color: '#888', fontSize: '0.85rem' }}>
                                            <i>R{r.ronde}: {r.renner}</i>
                                        </li>
                                    ))}
                                </ul>

                                {spelerTeam.length === 0 && (
                                    <div className="small-muted" style={{ marginTop: '0.5rem' }}>Nog geen renners gekozen.</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </section>
        </div>
    );
}