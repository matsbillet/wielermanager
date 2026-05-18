const { supabase } = require("../db/supabase");

const getStand = async (req, res) => {
  try {
    const { data, error } = await supabase.from("spelers").select(`
            naam,
            draft!inner (
                is_bank,
                renners!renner_id (
                    id,
                    naam,
                    ritresultaten (
                        rit_punten
                    ),
                    eindklassement (
                        punten
                    )
                )
            )
        `);

    if (error) throw error;

    // Bereken de stand
    const stand = data
      .map((speler) => {
        let totaalPunten = 0;
        if (speler.draft) {
          speler.draft.forEach((item) => {

            // Sla bank-renners over — die tellen nooit mee
            if (item.is_bank || !item.renners) return;

            // 1. Ritpunten optellen (zoals voorheen)
            if (item.renners.ritresultaten) {
              totaalPunten += item.renners.ritresultaten.reduce(
                (sum, r) => sum + (r.rit_punten || 0),
                0
              );
            }

            // 2. Eindklassement punten optellen (nieuw)
            if (item.renners.eindklassement) {
              totaalPunten += item.renners.eindklassement.reduce(
                (sum, e) => sum + (e.punten || 0),
                0
              );
            }

          });
        }

        return { naam: speler.naam, punten: totaalPunten };
      })
      .sort((a, b) => b.punten - a.punten);

    res.json(stand);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getStand };
