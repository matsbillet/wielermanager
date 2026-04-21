/**
 * draftHelper.js
 * Bevat de wiskunde voor de slangvolgorde en bankzitter-status. [cite: 18, 36]
 */

const getSpelerVoorBeurt = (beurtNummer, spelersRanked) => {
    const aantalSpelers = spelersRanked.length;
    const ronde = Math.ceil(beurtNummer / aantalSpelers);
    const indexInRonde = (beurtNummer - 1) % aantalSpelers;

    // Slangvolgorde: Oneven rondes 1->4, Even rondes 4->1 [cite: 18]
    const spelerIndex = (ronde % 2 !== 0)
        ? indexInRonde
        : (aantalSpelers - 1 - indexInRonde);

    return {
        spelerNaam: spelersRanked[spelerIndex],
        ronde: ronde,
        isBank: ronde > 12 // De eerste 12 zijn vast, de laatste 6 zijn bank [cite: 18]
    };
};

module.exports = { getSpelerVoorBeurt };