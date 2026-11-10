# Changelog

## 2026-11-10
### Added
- Optional Shopify product export input: stock is added to products that already exist (matched by handle) instead
  of overwriting them. All other columns and image rows of those products are passed through unchanged.
- Warning when a handle exists in the store with a different SKU (for example promo vs regular card).
- Warning for duplicate SKUs in the store export and for new-product SKUs already used by another handle.
- Yu-Gi-Oh! support (`yugiohConfig.js`).
- Pokémon finish SKU codes: Regular `REG`, Reverse Holo `REV`, Holo `HOLO`, Pokeball `POKE`, Masterball `MASTER`,
  ex `EX`, Full-Art `FA` (`finishCodes` in `pokemonConfig.js`). Handles keep the full finish name.
- Search: a bare number (`12`, `012`) finds `SET-012`; promo SKUs (`P-OP05-007-EN`) are parsed correctly.
- Candidate picker when several cards share a code (parallels, rarities); nothing is saved silently.
- Entry list with remove buttons, card and total-quantity counters.
- Export file name with timestamp (`<game>_stock_entries_YYYYMMDD-HHmm.csv`); export disabled with no entries.
- Browser warning before closing the page with unexported entries.
- Game auto-detected from the `tcg:<slug>` tag.

### Changed
- Existing-stock matching uses the product handle (what Shopify uses), not the SKU.
- Output contains only the entered cards; untouched store products are never included.
