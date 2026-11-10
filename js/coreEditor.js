class TCGStockEditor {
    constructor(csvText, gameConfig) {
        this.config = gameConfig;
        this.rows = [];
        this.headers = [];
        this.metafieldColumn = "product.metafields.custom.yuzey";

        // Shopify'dan dışa aktarılan mevcut ürünler (isteğe bağlı, loadExistingInventory ile yüklenir):
        // { headers, qtyColName, byHandle: Map(handle -> {handle, rows[], variantIndex, qty}), skuToHandles: Map }
        this.existing = null;

        // Giriş kayıtları: anahtar = handle|SKU, değer = { index, finishName, addQty }.
        // CSV satırları (updatedRows) bu kayıtlardan HER SEFERİNDE yeniden türetilir; böylece mevcut stok
        // dosyası girişlerden sonra yüklense bile adetler doğru birleşir ve geri alma kolaylaşır.
        this.entries = new Map();
        this.lastUpdate = null;

        this.parseCSV(csvText);
    }

    // ---------- CSV OKUMA ----------

    // Tırnak içindeki virgül ve satır sonlarını doğru işleyen genel okuyucu. Satır dizisi döndürür.
    parseCSVText(text) {
        text = String(text || "").replace(/^﻿/, ""); // BOM temizle
        const rows = [];
        let row = [];
        let entry = "";
        let insideQuote = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (insideQuote) {
                if (char === '"' && text[i + 1] === '"') {
                    entry += '"';
                    i++;
                } else if (char === '"') {
                    insideQuote = false;
                } else {
                    entry += char;
                }
            } else if (char === '"') {
                insideQuote = true;
            } else if (char === ",") {
                row.push(entry);
                entry = "";
            } else if (char === "\n" || char === "\r") {
                if (char === "\r" && text[i + 1] === "\n") i++;
                row.push(entry);
                entry = "";
                rows.push(row);
                row = [];
            } else {
                entry += char;
            }
        }
        if (entry !== "" || row.length > 0) {
            row.push(entry);
            rows.push(row);
        }
        // Tamamen boş satırları at
        return rows.filter(r => !(r.length === 1 && r[0].trim() === ""));
    }

    // Eski kodla uyum için korundu
    parseCSVLine(text) {
        const rows = this.parseCSVText(text);
        return rows.length ? rows[0] : [""];
    }

    parseCSV(text) {
        const parsed = this.parseCSVText(text);
        if (parsed.length === 0) return;

        this.headers = parsed[0].map(h => h.trim());

        if (this.config.hasFinishes) this.ensureMetafieldColumn();

        for (let i = 1; i < parsed.length; i++) {
            const values = parsed[i];
            let rowObj = {};
            this.headers.forEach((header, index) => {
                rowObj[header] = values[index] !== undefined ? values[index] : "";
            });
            this.rows.push(rowObj);
        }
    }

    ensureMetafieldColumn() {
        if (!this.headers.includes(this.metafieldColumn)) {
            this.headers.push(this.metafieldColumn);
        }
    }

    // Oyun değiştiğinde çağrılır; yuzey sütunu gerektiğinde eklenir (CSV yüklendikten sonra oyun değişse bile kaybolmaz)
    setConfig(config) {
        this.config = config;
        if (config.hasFinishes) this.ensureMetafieldColumn();
    }

    // CSV'deki "tcg:<slug>" etiketinden oyunu bulur (Python'un ürettiği etiket). Bulamazsa null.
    detectTcgSlug() {
        const counts = {};
        for (const row of this.rows.slice(0, 200)) {
            const m = String(row["Tags"] || "").match(/(?:^|,)\s*tcg:([^,\s]+)/i);
            if (m) {
                const slug = m[1].toLowerCase();
                counts[slug] = (counts[slug] || 0) + 1;
            }
        }
        const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        return best ? best[0] : null;
    }

    // Shopify export'u metafield sütunlarını "Dil (product.metafields.custom.dil)" diye adlandırır,
    // json_to_csv ise yalnızca "product.metafields.custom.dil" yazar. İkisini aynı sütun saymak için ortak anahtar.
    colKey(header) {
        const m = String(header).match(/\((product\.metafields\.[^)]+)\)\s*$/);
        return m ? m[1] : String(header).trim();
    }

    // ---------- MEVCUT SHOPIFY STOĞU ----------

    hasExistingInventory() {
        return !!this.existing && this.existing.byHandle.size > 0;
    }

    /**
     * Shopify'dan "Ürünler -> Dışa aktar" ile alınan CSV'yi okur.
     *
     * Shopify ürünleri HANDLE'a göre eşler, bu yüzden eşleştirme handle iledir (SKU ile değil).
     * Handle mağazada varsa o ürünün satırları (görsel satırları dahil) AYNEN çıktıya geçer, yalnızca stok adedi
     * değişir: yeni adet = mağazadaki adet + girilen adet. Başlık, fiyat, durum, etiket, metafield vb. mağazadaki gibi kalır.
     * Handle yoksa ürün yeni sayılır (json_to_csv satırı, draft).
     *
     * Dönüş: { count, qtyColumn, duplicateSkus } (kaç ürün okundu, stok sütunu, birden çok üründe geçen SKU'lar)
     */
    loadExistingInventory(csvText) {
        const parsed = this.parseCSVText(csvText);
        if (parsed.length < 2) return { count: 0, qtyColumn: null, duplicateSkus: [] };

        const headers = parsed[0].map(h => h.trim());
        if (!headers.includes("Handle")) {
            throw new Error("Bu dosyada 'Handle' sütunu yok. Shopify'dan dışa aktarılan ürün CSV'sini seçtiğinizden emin olun.");
        }
        if (!headers.includes("Variant SKU")) {
            throw new Error("Bu dosyada 'Variant SKU' sütunu yok. Shopify'dan dışa aktarılan ürün CSV'sini seçtiğinizden emin olun.");
        }

        // Stok sütunu: "Variant Inventory Qty" (sizin export'unuzdaki) ya da yeni format "Inventory Available: <Konum>"
        const qtyColName = headers.includes("Variant Inventory Qty")
            ? "Variant Inventory Qty"
            : headers.find(h => h.startsWith("Inventory Available"));
        if (!qtyColName) {
            throw new Error("Bu dosyada stok sütunu bulunamadı ('Variant Inventory Qty' veya 'Inventory Available: ...').");
        }

        const byHandle = new Map();
        for (let i = 1; i < parsed.length; i++) {
            const values = parsed[i];
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = values[idx] !== undefined ? values[idx] : ""; });
            const handleKey = obj["Handle"].trim().toLowerCase();
            if (!handleKey) continue;
            if (!byHandle.has(handleKey)) byHandle.set(handleKey, { handle: obj["Handle"].trim(), rows: [] });
            byHandle.get(handleKey).rows.push(obj);
        }

        const skuToHandles = new Map(); // sku(lower) -> { sku, handles:Set }
        for (const [handleKey, rec] of byHandle) {
            let vi = rec.rows.findIndex(r => (r["Variant SKU"] || "").trim() !== "");
            if (vi === -1) vi = 0;
            rec.variantIndex = vi;
            rec.qty = parseInt(rec.rows[vi][qtyColName], 10) || 0;

            for (const r of rec.rows) {
                const sku = (r["Variant SKU"] || "").trim();
                if (!sku) continue;
                const k = sku.toLowerCase();
                if (!skuToHandles.has(k)) skuToHandles.set(k, { sku, handles: new Set() });
                skuToHandles.get(k).handles.add(handleKey);
            }
        }

        const duplicateSkus = [];
        for (const { sku, handles } of skuToHandles.values()) {
            if (handles.size > 1) duplicateSkus.push(sku);
        }

        this.existing = { headers, qtyColName, byHandle, skuToHandles }; // hata olursa eski veri bozulmaz
        return { count: byHandle.size, qtyColumn: qtyColName, duplicateSkus };
    }

    // Bu CSV'deki kaç ürünün mağazada zaten olduğunu sayar (yanlış dosya seçildiyse fark edilsin diye)
    countExistingOverlap() {
        if (!this.existing) return 0;
        const handles = Array.from(this.existing.byHandle.keys());
        let n = 0;
        for (const row of this.rows) {
            const h = (row["Handle"] || "").trim().toLowerCase();
            if (!h) continue;
            if (this.existing.byHandle.has(h)) { n++; continue; }
            // Pokémon'da finish'li handle'lar (-reverse-holo gibi) ana handle'ın devamıdır
            if (this.config.hasFinishes && handles.some(x => x.startsWith(h + "-"))) n++;
        }
        return n;
    }

    // ---------- ARAMA ----------

    // SKU'dan kart numarasını çıkarır. Set kodu (ilk parça) bilerek atlanır; böylece SV3 / OP01 gibi setlerde
    // "3" ya da "01" yanlış kartla eşleşmez.
    //   Önce düz rakamlı parça: "ASC-012-EN" -> 12, "P-OP05-007-EN" -> 7, "OGN-001-298-EN" -> 1, "OGN-001A-298-EN" -> 1 (sonek "a")
    //   Yoksa öneki olan parça: "LOB-EN001-EN" -> 1 (önek "en"), "SV3-TG01-EN" -> 1 (önek "tg")
    _skuNumber(sku) {
        const tokens = String(sku || "").toLowerCase().split("-");
        for (let i = 1; i < tokens.length; i++) {
            const m = tokens[i].match(/^(\d+)([a-z]{0,2})$/);
            if (m) return { prefix: "", num: parseInt(m[1], 10), suffix: m[2] };
        }
        for (let i = 1; i < tokens.length; i++) {
            const m = tokens[i].match(/^([a-z]{1,2})(\d+)([a-z]{0,2})$/);
            if (m) return { prefix: m[1], num: parseInt(m[2], 10), suffix: m[3] };
        }
        return null;
    }

    /**
     * Sıralı arama. Dönüş: [{ index, row, tier }] (tier ne kadar küçükse o kadar iyi eşleşme).
     *  Sadece numara yazıldıysa ("012", "12", "1a"):
     *    tier 0: numara birebir aynı (önek/sonek yok)   -> ASC-012
     *    tier 1: numara aynı, oyun öneki var            -> LOB-EN001
     *    tier 2: numara aynı, sonek farklı (alt versiyon) -> OGN-001A
     *  Aksi halde (kod ya da isim):
     *    tier 3: SKU bu metinle başlıyor ("asc-012")
     *    tier 4: SKU bu metni içeriyor
     *    tier 5: başlık (kart adı) içeriyor; birden çok kelime varsa hepsi geçmeli
     * Numara eşleşmesi varsa yalnızca onlar döner; yoksa metin eşleşmelerine düşülür.
     */
    searchCards(query, limit = 50) {
        const q = String(query || "").trim().toLowerCase();
        if (!q) return [];

        const results = [];
        const numQuery = q.match(/^(\d+)([a-z]{0,2})$/);

        if (numQuery) {
            const qNum = parseInt(numQuery[1], 10);
            const qSuffix = numQuery[2];
            this.rows.forEach((row, index) => {
                const n = this._skuNumber(row["Variant SKU"]);
                if (!n || n.num !== qNum) return;
                let tier;
                if (n.suffix !== qSuffix) tier = 2;
                else tier = n.prefix === "" ? 0 : 1;
                results.push({ index, row, tier });
            });
        }

        if (results.length === 0) {
            const words = q.split(/\s+/).filter(Boolean);
            this.rows.forEach((row, index) => {
                const sku = (row["Variant SKU"] || "").toLowerCase();
                const title = (row["Title"] || "").toLowerCase();
                let tier = -1;
                if (words.length === 1) {
                    if (sku.startsWith(q)) tier = 3;
                    else if (sku.includes(q)) tier = 4;
                    else if (title.includes(q)) tier = 5;
                } else {
                    const hay = `${sku} ${title}`;
                    if (words.every(w => hay.includes(w))) tier = 5;
                }
                if (tier >= 0) results.push({ index, row, tier });
            });
        }

        // Array.sort kararlı: aynı tier içinde CSV sırası (kart numarası sırası) korunur
        results.sort((a, b) => a.tier - b.tier);
        return results.slice(0, limit);
    }

    // Eski kodla uyum için korundu
    findCardByNumber(cardNumber) {
        return this.searchCards(cardNumber);
    }

    // ---------- STOK GİRİŞİ ----------

    // Bir giriş kaydından çıktı satır(lar)ını üretir (finish eki + mağaza ile birleştirme).
    _buildRow(entry) {
        const originalRow = this.rows[entry.index];
        if (!originalRow) return null;
        const newRow = JSON.parse(JSON.stringify(originalRow));

        if (entry.finishName) {
            const finishName = entry.finishName;
            // SKU eki: config'teki kısa kod (REV, POKE...), yoksa adın büyük harfli hali. Handle eki her zaman uzun adla kalır.
            const finishCode = (this.config.finishCodes && this.config.finishCodes[finishName])
                || finishName.toUpperCase().replace(/\s+/g, '-');
            const handleSuffix = finishName.toLowerCase().replace(/\s+/g, '-');

            if (!newRow["Title"].includes(`(${finishName})`)) {
                newRow["Title"] = `${newRow["Title"]} (${finishName})`;
            }
            if (!newRow["Handle"].endsWith(`-${handleSuffix}`)) {
                newRow["Handle"] = `${newRow["Handle"]}-${handleSuffix}`;
            }
            // includes yerine endsWith: set kodunda "EX" gibi parçalar yanlış eşleşmesin
            if (newRow["Variant SKU"] && !newRow["Variant SKU"].toUpperCase().endsWith(`-${finishCode}`)) {
                newRow["Variant SKU"] = `${newRow["Variant SKU"]}-${finishCode}`;
            }
            this.ensureMetafieldColumn();
            newRow[this.metafieldColumn] = finishName;
        }

        const key = `${newRow["Handle"]}|${newRow["Variant SKU"]}`;
        const handleKey = (newRow["Handle"] || "").trim().toLowerCase();
        const rec = this.existing ? this.existing.byHandle.get(handleKey) : null;

        let rows, representative, previousQty = 0, finalQty, skuConflict = null;

        if (rec) {
            // Mağazada var: satırları aynen geçir, yalnızca stok değişsin
            previousQty = rec.qty;
            finalQty = previousQty + entry.addQty;
            rows = rec.rows.map(r => Object.assign({}, r));
            rows[rec.variantIndex][this.existing.qtyColName] = finalQty.toString();
            representative = rows[rec.variantIndex];
        } else {
            finalQty = entry.addQty;
            newRow["Variant Inventory Qty"] = finalQty.toString();
            if (this.existing && this.existing.qtyColName !== "Variant Inventory Qty") {
                newRow[this.existing.qtyColName] = finalQty.toString();
            }
            rows = [newRow];
            representative = newRow;

            // Aynı SKU mağazada BAŞKA bir handle'da varsa uyar (yeni ürün olarak eklenecek, SKU çift olur)
            if (this.existing) {
                const hit = this.existing.skuToHandles.get((newRow["Variant SKU"] || "").trim().toLowerCase());
                if (hit) skuConflict = Array.from(hit.handles)[0];
            }
        }

        return {
            key,
            rows,
            row: representative,
            existsInStore: !!rec,
            previousQty,
            finalQty,
            skuConflict
        };
    }

    _appliedFinish(finishName) {
        return (this.config.hasFinishes && finishName) ? finishName : "";
    }

    /**
     * Satıra stok girer. Mağaza export'u yüklüyse ve handle mağazada varsa yeni miktar mevcut stoğun ÜSTÜNE EKLENİR.
     * Aynı kart (handle+SKU) tekrar girilirse son giriş geçerli olur (düzeltme amaçlı), toplanmaz.
     * Başarılıysa true döner; ayrıntı this.lastUpdate içindedir.
     */
    updateCardAtIndex(index, finishName, stock) {
        if (!Number.isInteger(index) || index < 0 || index >= this.rows.length) return false;

        const addQty = parseInt(stock, 10);
        if (!Number.isFinite(addQty) || addQty < 0) return false;

        const entry = { index, finishName: this._appliedFinish(finishName), addQty };
        const built = this._buildRow(entry);
        if (!built) return false;

        const replaced = this.entries.has(built.key);
        this.entries.set(built.key, entry);

        this.lastUpdate = {
            key: built.key,
            sku: built.row["Variant SKU"],
            title: built.row["Title"],
            existsInStore: built.existsInStore,
            previousStock: built.previousQty,
            addedStock: addQty,
            newStock: built.finalQty,
            skuConflict: built.skuConflict,
            replacedEarlierEntry: replaced
        };
        return true;
    }

    // Kaydetmeden önce önizleme: bu kart (ve finish) için SKU, mağaza stoğu ve bu oturumda girilen adet
    describeTarget(index, finishName) {
        const built = this._buildRow({ index, finishName: this._appliedFinish(finishName), addQty: 0 });
        if (!built) return null;
        const entered = this.entries.get(built.key);
        return {
            key: built.key,
            sku: built.row["Variant SKU"],
            title: built.row["Title"],
            existsInStore: built.existsInStore,
            previousStock: built.previousQty,
            skuConflict: built.skuConflict,
            enteredThisSession: entered ? entered.addQty : 0
        };
    }

    removeEntry(key) {
        return this.entries.delete(key);
    }

    _buildAll() {
        const out = [];
        for (const entry of this.entries.values()) {
            const built = this._buildRow(entry);
            if (built) out.push({ entry, built });
        }
        return out;
    }

    // Özet liste (arayüzde "Son girişler" için)
    getEntries() {
        return this._buildAll().map(({ entry, built }) => ({
            key: built.key,
            sku: built.row["Variant SKU"],
            title: built.row["Title"],
            addedStock: entry.addQty,
            previousStock: built.previousQty,
            newStock: built.finalQty,
            existsInStore: built.existsInStore,
            skuConflict: built.skuConflict
        }));
    }

    // Çıktıya girecek tüm satırlar (mağazada olan ürünlerin görsel satırları dahil)
    get updatedRows() {
        const out = [];
        this._buildAll().forEach(x => x.built.rows.forEach(r => out.push(r)));
        return out;
    }

    // ---------- DIŞA AKTARMA ----------

    // Çıktı başlıkları: mağaza export'u yüklüyse onun sütunları (+ bizim ekstra sütunlarımız), yoksa CSV'nin kendi başlıkları
    _outputHeaders() {
        if (!this.existing) return this.headers.slice();
        const exHeaders = this.existing.headers;
        const exKeys = new Set(exHeaders.map(h => this.colKey(h)));
        return exHeaders.concat(this.headers.filter(h => !exKeys.has(this.colKey(h))));
    }

    exportCSV() {
        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '""';
            let str = val.toString().replace(/"/g, '""');
            return `"${str}"`;
        };

        const outHeaders = this._outputHeaders();
        const lines = [outHeaders.map(escapeCSV).join(",")];

        this._buildAll().forEach(({ built }) => {
            built.rows.forEach(row => {
                // Satırın kendi sütun adı ya da (metafield etiketi farkına karşı) ortak anahtarla eşleşen değeri al
                const byKey = {};
                Object.keys(row).forEach(k => { byKey[this.colKey(k)] = row[k]; });
                const line = outHeaders.map(h => {
                    const v = row[h] !== undefined ? row[h] : byKey[this.colKey(h)];
                    return escapeCSV(v === undefined ? "" : v);
                }).join(",");
                lines.push(line);
            });
        });

        return lines.join("\n") + "\n";
    }
}

// Tarayıcıda etkisizdir; yalnızca Node ile test için.
if (typeof module !== "undefined" && module.exports) {
    module.exports = TCGStockEditor;
}
