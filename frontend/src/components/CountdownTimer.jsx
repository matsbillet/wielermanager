import React, { useState, useEffect } from 'react';

const CountdownTimer = () => {
    const [volgendeRit, setVolgendeRit] = useState(null);
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        // Haal de volgende rit op van je nieuwe API
        fetch('http://localhost:3000/api/ritten/volgende')
            .then(res => res.json())
            .then(data => setVolgendeRit(data));
    }, []);

    useEffect(() => {
        if (!volgendeRit?.starttijd) return;

        const interval = setInterval(() => {
            const nu = new Date().getTime();
            const start = new Date(volgendeRit.starttijd).getTime();
            const verschil = start - nu;

            if (verschil <= 0) {
                setTimeLeft("De rit is gestart!");
                clearInterval(interval);
            } else {
                const uren = Math.floor((verschil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minuten = Math.floor((verschil % (1000 * 60 * 60)) / (1000 * 60));
                const seconden = Math.floor((verschil % (1000 * 60)) / 1000);
                setTimeLeft(`${uren}u ${minuten}m ${seconden}s`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [volgendeRit]);

    if (!volgendeRit) return null;

    return (
        <div className="countdown-container">
            <h3>Volgende rit: {volgendeRit.naam}</h3>
            <p className="timer">{timeLeft}</p>
        </div>
    );
};

export default CountdownTimer;