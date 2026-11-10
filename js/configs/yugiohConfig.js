const yugiohConfig = {
    id: "yugioh",
    tcgSlug: "yugioh",
    gameName: "Yu-Gi-Oh! TCG",
    // Yu-Gi-Oh'da her nadirlik (Ultra Rare, Secret Rare...) zaten CSV'de ayrı satır/SKU olarak geliyor,
    // bu yüzden finish (yüzey) mantığına gerek yok.
    hasFinishes: false,
    finishes: [],
    // YGOPRODeck görsellerini sürekli hotlink etmeyin diyor; ayrıca aynı kartın nadirlikleri aynı görseli
    // kullandığından seçim listesinde küçük resim bir şey katmıyor.
    showThumbnails: false
};
