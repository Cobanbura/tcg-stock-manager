const pokemonConfig = {
    id: "pokemon",
    tcgSlug: "pokemon", // CSV'deki "tcg:pokemon" etiketinden oyunu otomatik seçmek için
    gameName: "Pokémon TCG",
    hasFinishes: true,
    finishes: ["Regular", "Reverse Holo", "Holo", "Pokeball", "Masterball", "ex", "Full-Art"],
    // SKU'ya eklenen kısa kodlar. Handle (ürün adresi) ise uzun kalır (pokemon-...-reverse-holo),
    // çünkü Shopify mevcut ürünleri handle ile eşler.
    // Burada olmayan bir finish eklerseniz SKU eki adının büyük harfli hali olur (ör. "Full-Art" -> FULL-ART).
    finishCodes: {
        "Regular": "REG",
        "Reverse Holo": "REV",
        "Holo": "HOLO",
        "Pokeball": "POKE",
        "Masterball": "MASTER",
        "ex": "EX",
        "Full-Art": "FA"
    }
};
