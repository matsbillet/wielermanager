import { useState, useEffect } from "react";

const CountdownTimer = ({ customTargetDate, customTitel, customSubTitel }) => {
    const [targetDate, setTargetDate] = useState(customTargetDate || null);
    const [titel, setTitel] = useState(customTitel || "Volgende rit");
    const [subTitel, setSubTitel] = useState(customSubTitel || "");
    const [timeLeft, setTimeLeft] = useState("");

    const laadVolgendeRit = () => {

        fetch("http://localhost:3000/api/ritten/volgende")
            .then((res) => res.json())
            .then((data) => {
                if (data.starttijd) {
                    setTargetDate(data.starttijd);
                    setTitel("Volgende rit");
                    setSubTitel(data.naam);
                }
            })
            .catch((err) => console.error("Fout bij ophalen volgende rit:", err));
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
            const ritDuurMs = 5 * 60 * 60 * 1000;

            if (verschil <= 0 && verschil > -ritDuurMs) {
                setTimeLeft("Live!");
            } else if (verschil <= -ritDuurMs) {
                if (!customTargetDate) {
                    laadVolgendeRit();
                } else {
                    setTimeLeft("Afgelopen");
                    clearInterval(interval);
                }
            } else {
                const dagen = Math.floor(verschil / (1000 * 60 * 60 * 24));
                const uren = Math.floor(
                    (verschil % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
                );
                const minuten = Math.floor(
                    (verschil % (1000 * 60 * 60)) / (1000 * 60),
                );
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

    if (!targetDate) {
        return (
            <div className="countdown-timer">
                <div className="countdown-icon">📅</div>

                <div className="countdown-info">
                    <div className="countdown-title">Geen ritten gepland</div>
                    <div className="countdown-subtitle">
                        Wachten op nieuwe kalender...
                    </div>
                </div>

                <div className="countdown-time countdown-time-muted">
                    --:--
                </div>
            </div>
        );
    }

    return (
        <div className="countdown-timer">
            <div className="countdown-icon">⏱️</div>

            <div className="countdown-info">
                <div className="countdown-title">{titel}</div>

                {subTitel && (
                    <div className="countdown-subtitle">
                        {subTitel}
                    </div>
                )}
            </div>

            <div
                className={
                    timeLeft === "Live!"
                        ? "countdown-time countdown-time-live"
                        : "countdown-time"
                }
            >
                {timeLeft === "Live!" && <span className="countdown-live-dot" />}
                {timeLeft}
            </div>
        </div>
    );
};

export default CountdownTimer;