import { useEffect, useMemo, useState } from 'react';
import { getBeschikbareRenners, getSpelers, kiesRenner } from '../services/api';

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

    if (ladenPagina) {
        return <div>Laden van draft data...</div>;
    }

    return (
        <div>
            <section className="banner card draft-board">
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
        </div>
    );
}