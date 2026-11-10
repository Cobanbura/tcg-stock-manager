# TCG Stock Manager

A modular, lightweight, browser-based Shopify CSV editor and stock modifier designed for Trading Card Game (TCG) sellers.

## 🚀 Features

- ⚡ **100% Client-Side:** Processes data directly in your browser using Vanilla JavaScript. Your inventory data never leaves your computer (fully GitHub Pages compatible).
- 🧩 **Modular Game Configs:** Independent configuration files per TCG engine (`hasFinishes`, finish options, finish SKU codes, thumbnails).
- 🎯 **Delta Export (Change-Only CSV):** Uses the uploaded CSV as a read-only card pool. Exported CSV files only contain cards you actually updated, so products you did not touch are never part of the import.
- ➕ **Add to Existing Stock:** Optionally load your current Shopify product export. Cards already in your store get `store quantity + entered quantity` instead of being overwritten; every other column of those products is passed through unchanged.
- 🔍 **Fast Search:** Type a bare number (`12` or `012` finds `SET-012`), part of a name, or a full code. When several cards match (parallels, rarities) you pick one with the arrow keys; nothing is saved silently.
- 🛡️ **Safety Checks:** Warnings for same-handle/different-SKU matches, duplicate SKUs in your store export, and unsaved entries when closing the tab.
- 🏷️ **Shopify Variant & Metafield Support:** Automatically handles `Title` suffixes, `Handle` modifications, `Variant SKU` codes, and the `custom.yuzey` metafield when finish options are enabled.
- 🧭 **Game Auto-Detection:** Reads the game from the `tcg:<slug>` tag of the loaded CSV.

## 🃏 Supported Games

- [x] Pokémon TCG
- [x] One Piece Card Game
- [x] Riftbound
- [x] Yu-Gi-Oh!
- [ ] Magic: The Gathering *(TBA)*
- [ ] Digimon Card Game *(TBA)*

## 📄 CSV Data & Workflow

1. **Upload the Card Pool CSV:** Drag and drop a Shopify-format product CSV of the set (one row per card with `Handle`, `Title`, `Variant SKU`, tags, ...). This acts as your read-only database.
2. **(Recommended) Upload your Shopify Export:** Load a current product export of your store. Without it, quantities you enter *replace* the store stock on import, and the UI warns you about this.
3. **Search & Select:** Find cards by number, `Variant SKU` or `Title`.
4. **Finish & Stock Configuration:**
   - **Games with finishes (`hasFinishes: true`):** Select a finish (e.g. *Holo*, *Reverse Holo*, *Pokeball*). Updating stock adds the finish to the title, a short code to the SKU (`MEG-128-EN-REV`), a long suffix to the handle (`...-reverse-holo`) and fills the `custom.yuzey` metafield.
   - **Games without finishes (`hasFinishes: false`):** The finish selector is hidden and only the inventory quantity is updated.
5. **Export Clean CSV:** Download a Shopify-compatible CSV containing only the entered cards, named `<game>_stock_entries_YYYYMMDD-HHmm.csv`.

### Importing into Shopify

Shopify identifies products by **Handle**, not by SKU. When importing, tick *"Overwrite existing products that have the same handle"*. Try a file with one or two cards first. Do not change the handles of live products, since matching depends on them.

### Safety warnings

- **Same handle, different SKU:** the handle exists in your store but with another SKU (for example a promo and a regular card sharing a handle). The stock would go to the wrong product, so check it.
- **Duplicate SKUs** in the store export are reported when it is loaded.
- A new product whose SKU already exists under another handle is flagged.

## ⚙️ Configuration

Each game is a small config object in `js/configs/`:

| Field | Purpose |
|---|---|
| `id`, `gameName` | Identifier and display name |
| `tcgSlug` | Matches the `tcg:<slug>` tag for auto-detection |
| `hasFinishes`, `finishes` | Enable and list finish options |
| `finishCodes` | Finish → short SKU code (Pokémon: `REG`, `REV`, `HOLO`, `POKE`, `MASTER`, `EX`, `FA`) |
| `showThumbnails` | Show card images in the candidate list (off for Yu-Gi-Oh!) |

To add a game: create a config, load the script in `index.html`, and add it to the game selector.

## 🗂️ Project Structure

```
index.html              UI
js/coreEditor.js        search, stock merging, CSV read/write
js/configs/*.js         per-game settings
```

## 🛠️ Built With

- HTML5 & Vanilla JavaScript
- Tailwind CSS (via CDN)

## 📝 License

Released under the [MIT License](LICENSE).
