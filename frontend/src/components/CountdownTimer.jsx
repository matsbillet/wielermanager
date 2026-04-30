import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ customTargetDate, customTitel, customSubTitel }) => {
    const [targetDate, setTargetDate] = useState(customTargetDate || null);
    const [titel, setTitel] = useState(customTitel || "Volgende rit");
    const [subTitel, setSubTitel] = useState(customSubTitel || "");
    const [timeLeft, setTimeLeft] = useState("");

    const laadVolgendeRit = () => {
        fetch('http://localhost:3000/api/ritten/volgende')
            .then(res => res.json())
            .then(data => {
                if (data.starttijd) {
                    setTargetDate(data.starttijd);
                    setTitel("Volgende rit");
                    setSubTitel(data.naam);
                }
            })
            .catch(err => console.error("Fout bij ophalen volgende rit:", err));
    };

    useEffect(() => {
        if (!customTargetDate) {
            laadVolgendeRit();
        } else {
            setTargetDate(customTargetDate);
            setTitel(customTitel);
            setSubTitel(customSubTitel);
        }
    }, [customTargetDate, customTitel, customSubTitel]);

    useEffect(() => {
        if (!targetDate) return;

        const interval = setInterval(() => {
            const nu = new Date().getTime();
            const start = new Date(targetDate).getTime();
            const verschil = start - nu;

            // De rit duurt zo'n 5 uur (in milliseconden)
            const ritDuurMs = 5 * 60 * 60 * 1000;

            if (verschil <= 0 && verschil > -ritDuurMs) {
                setTimeLeft("Live!");
            }
            else if (verschil <= -ritDuurMs) {
                if (!customTargetDate) {
                    laadVolgendeRit();
                } else {
                    setTimeLeft("Afgelopen");
                    clearInterval(interval);
                }
            }
            else {
                const dagen = Math.floor(verschil / (1000 * 60 * 60 * 24));
                const uren = Math.floor((verschil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minuten = Math.floor((verschil % (1000 * 60 * 60)) / (1000 * 60));
                const seconden = Math.floor((verschil % (1000 * 60)) / 1000);

                if (dagen > 0) {
                    setTimeLeft(`${dagen}d ${uren}u ${minuten}m`);
                } else {
                    setTimeLeft(`${uren}u ${minuten}m ${seconden}s`);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate, customTargetDate]);

    if (!targetDate) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'left'
        }}>
            <div style={{ fontSize: '1.5rem' }}>⏱️</div>

            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>{titel}</div>
                {subTitel && (
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, color: '#fff', marginTop: '2px' }}>
                        {subTitel}
                    </div>
                )}
            </div>

            <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: timeLeft === "Live!" ? '#f87171' : '#22d3ee',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            }}>
                {timeLeft === "Live!" && (
                    <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        backgroundColor: '#f87171',
                        borderRadius: '50%',
                        boxShadow: '0 0 6px #f87171'
                    }}></span>
                )}
                {timeLeft}
            </div>
        </div>
    );
};

export default CountdownTimer;