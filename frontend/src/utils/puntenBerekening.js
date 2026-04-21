export function berekenTotaalPunten(resultaten = []) {
    return resultaten.reduce((totaal, item) => totaal + (item.punten || 0), 0);
}