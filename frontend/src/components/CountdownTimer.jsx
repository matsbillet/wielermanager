import React, { useState, useEffect } from 'react';

// We voegen 'customSubTitel' toe zodat we de tekst mooi in tweeën kunnen splitsen
const CountdownTimer = ({ customTargetDate, customTitel, customSubTitel }) => {
    const [targetDate, setTargetDate] = useState(customTargetDate || null);
    const [titel, setTitel] = useState(customTitel || "Volgende rit");
    const [subTitel, setSubTitel] = useState(customSubTitel || "");
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        // Als er geen custom datum is, haal dan zelf de volgende rit op (voor op het dashboard)
        if (!customTargetDate) {
            fetch('http://localhost:3000/api/ritten/volgende')
                .then(res => res.json())
                .then(data => {
                    if (data.starttijd) {
                        setTargetDate(data.starttijd);
                        setTitel("Volgende rit");
                        setSubTitel(data.naam); // Dit zet de ritnaam (bijv. Stage 1 | Firenze...) in de grijze tekst
                    }
                })
                .catch(err => console.error("Fout bij ophalen volgende rit:", err));
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

            if (verschil <= 0) {
                setTimeLeft("Gestart!");
                clearInterval(interval);
            } else {
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
    }, [targetDate]);

    if (!targetDate) return null;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            textAlign: 'left' // Lijnt de tekst links uit, net als bij je Snelle Acties
        }}>
            {/* Icoontje links */}
            <div style={{ fontSize: '1.5rem' }}>⏱️</div>

            {/* Tekst in het midden */}
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>{titel}</div>
                {subTitel && (
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, color: '#fff', marginTop: '2px' }}>
                        {subTitel}
                    </div>
                )}
            </div>

            {/* Timer rechts */}
            <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: timeLeft === "Gestart!" ? '#f87171' : '#22d3ee'
            }}>
                {timeLeft}
            </div>
        </div>
    );
};

export default CountdownTimer;