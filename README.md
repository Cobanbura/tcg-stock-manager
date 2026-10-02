# TCG Stock Manager

A modular, lightweight, browser-based Shopify CSV editor and stock modifier designed for Trading Card Game (TCG) sellers.

## 🚀 Features
- ⚡ **100% Client-Side:** Processes data directly in your browser using Vanilla JavaScript. Your inventory data never leaves your computer (fully GitHub Pages compatible).
- 🧩 **Modular Game Configs:** Independent configuration files per TCG engine (`hasFinishes`, finish options, stock behaviors).
- 🎯 **Delta Export (Change-Only CSV):** Uses the main uploaded CSV as a read-only data pool. Exported CSV files only contain cards you actually updated, allowing multiple finish inputs for the same card without cluttering the output.
- 🏷️️ **Shopify Variant & Metafield Support:** Automatically handles `Title` suffixes, `Handle` modifications, `Variant SKU` codes, and `custom.yuzey` metafield mapping when finish options are enabled.

## 🃏 Supported Games
- [x] Pokémon TCG
- [x] One Piece Card Game
- [x] Riftbound
- [ ] Yu-Gi-Oh! *(TBA)*
- [ ] Magic: The Gathering *(TBA)*
- [ ] Digimon Card Game *(TBA)*

## 📄 CSV Data & Workflow
1. **Upload Reference CSV:** Drag and drop your Shopify inventory export. This acts as your read-only database.
2. **Search & Select:** Find cards instantly using `Variant SKU` or `Title`.
3. **Finish & Stock Configuration:**
   - **For games with Finishes (`hasFinishes: true`):** Allows selecting card finishes (e.g., *Holo*, *Reverse Holo*, *Parallel Rare*). Updating stock generates/updates title tags, SKUs, and `custom.yuzey` metafields.
   - **For games without Finishes (`hasFinishes: false`):** Automatically hides finish selections and updates only the inventory quantity for quick stock entry.
4. **Export Clean CSV:** Download a freshly generated Shopify-compatible CSV containing only the modified entries ready for direct import.

## 🛠️ Built With
- HTML5 & Vanilla JavaScript
- Tailwind CSS (via CDN)
