const PUNTEN_SCHEMA = {
    1: 100, 2: 80, 3: 65, 4: 55, 5: 45,
    6: 35, 7: 30, 8: 25, 9: 20, 10: 17,
    11: 15, 12: 14, 13: 13, 14: 12, 15: 11,
    16: 10, 17: 9, 18: 8, 19: 7, 20: 6,
    21: 5, 22: 4, 23: 3, 24: 2, 25: 1
};

const PUNTEN_TRUI = 10;
function berekenRitPunten(gescrapteData) {
    const { uitslag, truien } = gescrapteData;
    const puntenMap = new Map();

    // 1. Punten voor de Top 25 berekenen 
    uitslag.forEach(renner => {
        const positie = parseInt(renner.pos);
        let verdiendePunten = PUNTEN_SCHEMA[positie] || 0;

        puntenMap.set(renner.slug, {
            naam: renner.naam,
            dagPunten: verdiendePunten,
            truiPunten: 0,
            totaal: verdiendePunten
        });
    });

    // 2. Punten voor Truidragers berekenen (+10 per trui) 
    // Let op: ook renners buiten de top 25 krijgen deze punten 
    Object.values(truien).forEach(naam => {
        if (!naam || naam === 'Onbekend' || naam === 'Niet gevonden') return;

        // We maken een slug van de naam voor matching (of gebruik de slug als je die hebt)
        const slug = naam.toLowerCase().replace(/ /g, '-');

        if (puntenMap.has(slug)) {
            const stats = puntenMap.get(slug);
            stats.truiPunten += PUNTEN_TRUI;
            stats.totaal += PUNTEN_TRUI;
        } else {
            // Renner buiten top 25 die wel een trui heeft 
            puntenMap.set(slug, {
                naam: naam,
                dagPunten: 0,
                truiPunten: PUNTEN_TRUI,
                totaal: PUNTEN_TRUI
            });
        }
    });

    return Array.from(puntenMap.values());
}

// TEST CASE
const testData = {
    uitslag: [
        { pos: "1", naam: "Romain Bardet", slug: "romain-bardet" },
        { pos: "2", naam: "Frank van den Broek", slug: "frank-van-den-broek" }
    ],
    truien: {
        geel: "Romain Bardet",
        groen: "Frank van den Broek",
        bollen: "Jonas Abrahamsen", // Deze staat niet in de top 2 (onze test uitslag)
        wit: "Frank van den Broek"
    }
};

console.log(berekenRitPunten(testData));