/**
 * PUNTEN SCHEMA & REGELS
 * Gebaseerd op projectscope v1.0 en correcties van de gebruiker.
 */
const PUNTEN_SCHEMA = {
    1: 100, 2: 80, 3: 65, 4: 55, 5: 45, 6: 35, 7: 30, 8: 25, 9: 20, 10: 17,
    11: 15, 12: 14, 13: 13, 14: 12, 15: 11, 16: 10, 17: 9, 18: 8, 19: 7, 20: 6,
    21: 5, 22: 4, 23: 3, 24: 2, 25: 1
};

const PUNTEN_TRUI = 10; // Alle truien zijn +10 per rit

/**
 * Hoofdfunctie: Berekent wie welke punten krijgt per speler
 * @param {Object} gescrapteData - Data van procyclingstats.js
 * @param {Array} spelerTeams - Data uit de DB (welke renners heeft elke speler en zijn ze 'vast' of 'bank'?)
 */
function berekenSpelerScores(gescrapteData, spelerTeams) {
    const { uitslag, truien } = gescrapteData;

    // 1. Maak een snelle 'lookup' van de rituitslag voor performance
    const ritResultaten = new Map();

    // Verwerk top 25
    uitslag.forEach(r => {
        ritResultaten.set(r.slug, { dagPunten: PUNTEN_SCHEMA[parseInt(r.pos)] || 0, truien: 0 });
    });

    // Verwerk truien (+10 per trui, ook buiten top 25)
    Object.values(truien).forEach(naam => {
        if (!naam || naam === 'Onbekend') return;
        const slug = naam.toLowerCase().replace(/ /g, '-');

        if (ritResultaten.has(slug)) {
            ritResultaten.get(slug).truien += PUNTEN_TRUI;
        } else {
            ritResultaten.set(slug, { dagPunten: 0, truien: PUNTEN_TRUI });
        }
    });

    // 2. Koppel resultaten aan de spelers en filter bankzitters
    return spelerTeams.map(speler => {
        let totaalScoreRit = 0;
        const details = [];

        speler.renners.forEach(renner => {
            const resultaat = ritResultaten.get(renner.slug);

            if (resultaat) {
                // BELANGRIJK: Alleen punten als renner NIET op de bank zit 
                const punten = renner.isBankzitter ? 0 : (resultaat.dagPunten + resultaat.truien);

                if (punten > 0 || renner.isBankzitter) {
                    details.push({
                        naam: renner.naam,
                        isBank: renner.isBankzitter,
                        score: punten
                    });
                    totaalScoreRit += punten;
                }
            }
        });

        return {
            spelerNaam: speler.naam,
            ritTotaal: totaalScoreRit,
            verwerking: details
        };
    });
}

// --- DUMMY DATA OM TE TESTEN (Zolang DB van P3 niet klaar is) ---
const mockSpelerTeams = [
    {
        naam: "Roel",
        renners: [
            { naam: "Romain Bardet", slug: "romain-bardet", isBankzitter: false },
            { naam: "Frank van den Broek", slug: "frank-van-den-broek", isBankzitter: true } // Zit op de bank!
        ]
    }
];

const mockGescrapteData = {
    uitslag: [{ pos: "1", naam: "Romain Bardet", slug: "romain-bardet" }, { pos: "2", naam: "Frank van den Broek", slug: "frank-van-den-broek" }],
    truien: { geel: "Romain Bardet", groen: "Frank van den Broek" }
};

console.log("=== SCORE BEREKENING TEST ===");
console.dir(berekenSpelerScores(mockGescrapteData, mockSpelerTeams), { depth: null });