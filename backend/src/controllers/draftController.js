/**
 * draftController.js
 * Beheert de keuzes en bewaakt de uniekheid van de renners. 
 */
const { getSpelerVoorBeurt } = require('../utils/draftHelper');

// Tijdelijke placeholder voor gekozen renners (tot de DB werkt)
let gekozenRennersSlugs = [];

const voerKeuzeUit = async (req, res) => {
    const { spelerNaam, rennerSlug, huidigeBeurt } = req.body;

    // 1. Check de volgorde: Winnaar vorig jaar kiest als 4de [cite: 18]
    const volgordeVorigJaar = ["Jente", "Piet", "Jan", "Roel"]; // Voorbeeld uitslag [cite: 18]
    const aanDeBeurt = getSpelerVoorBeurt(huidigeBeurt, volgordeVorigJaar);

    // Validatie A: Is de juiste speler aan de beurt? [cite: 29]
    if (spelerNaam !== aanDeBeurt.spelerNaam) {
        return res.status(403).json({ error: `Niet jouw beurt! Het is de beurt aan ${aanDeBeurt.spelerNaam}` });
    }

    // Validatie B: Is de renner uniek (niet al gekozen)? 
    if (gekozenRennersSlugs.includes(rennerSlug)) {
        return res.status(400).json({ error: "Deze renner is al gekozen door iemand anders!" });
    }

    // 2. Keuze verwerken
    gekozenRennersSlugs.push(rennerSlug);

    // Hier komt straks de query voor Persoon 3:
    // await supabase.from('draft').insert({ speler, renner, is_bank: aanDeBeurt.isBank }) [cite: 29]

    res.json({
        bericht: "Keuze succesvol opgeslagen!",
        details: {
            renner: rennerSlug,
            speler: spelerNaam,
            ronde: aanDeBeurt.ronde,
            type: aanDeBeurt.isBank ? "Bankzitter" : "Vaste renner"
        }
    });
};

module.exports = { voerKeuzeUit };