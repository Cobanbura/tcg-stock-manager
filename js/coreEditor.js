class TCGStockEditor {
    constructor(csvText, config) {
        this.config = config;
        this.rows = [];
        this.headers = [];
        this.maxProcessedNum = 0;
        this.parseCSV(csvText);
    }

    parseCSV(text) {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;
        
        this.headers = this.parseCSVLine(lines[0]);
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === this.headers.length) {
                let rowObj = {};
                this.headers.forEach((header, index) => {
                    rowObj[header] = values[index];
                });
                this.rows.push(rowObj);
            }
        }
    }

    parseCSVLine(text) {
        let values = [];
        let insideQuote = false;
        let entry = '';
        for (let i = 0; i < text.length; i++) {
            let char = text[i];
            if (char === '"' && text[i+1] === '"') {
                entry += '"';
                i++;
            } else if (char === '"') {
                insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
                values.push(entry);
                entry = '';
            } else {
                entry += char;
            }
        }
        values.push(entry);
        return values;
    }

    extractCardNumber(row) {
        const sku = row["Variant SKU"] || "";
        const title = row["Title"] || "";
        
        const skuMatch = sku.match(/-(\d+)-/);
        const titleMatch = title.match(/\((\d+)\)/);

        if (skuMatch) return parseInt(skuMatch[1], 10);
        if (titleMatch) return parseInt(titleMatch[1], 10);
        return 0;
    }

    findCardByNumber(cardNumber) {
        const results = [];
        const searchNum = cardNumber.toString().padStart(3, '0');
        
        this.rows.forEach((row, index) => {
            const sku = row["Variant SKU"] || "";
            const title = row["Title"] || "";
            if (sku.includes(`-${searchNum}-`) || sku.includes(`-${cardNumber}-`) || title.includes(`(${searchNum})`)) {
                results.push({ index, row });
            }
        });
        return results;
    }

    updateCardAtIndex(index, finishName, stock) {
        if (index >= this.rows.length) return false;

        const row = this.rows[index];
        const cardNum = this.extractCardNumber(row);
        
        if (cardNum > this.maxProcessedNum) {
            this.maxProcessedNum = cardNum;
        }

        const finishTag = this.config.finishes[finishName] || `finish:${finishName.toLowerCase()}`;
        const finishCode = finishName.toUpperCase().replace(/\s+/g, '-');
        const handleSuffix = finishName.toLowerCase().replace(/\s+/g, '-');

        if (!row["Title"].includes(`(${finishName})`)) {
            row["Title"] = `${row["Title"]} (${finishName})`;
        }

        if (!row["Handle"].endsWith(handleSuffix)) {
            row["Handle"] = `${row["Handle"]}-${handleSuffix}`;
        }

        if (row["Variant SKU"] && !row["Variant SKU"].includes(finishCode)) {
            row["Variant SKU"] = `${row["Variant SKU"]}-${finishCode}`;
        }

        row["Variant Inventory Qty"] = stock.toString();

        let rawTags = row["Tags"] || "";
        let currentTags = rawTags.split(",").map(t => t.trim()).filter(t => t !== "");
        if (!currentTags.includes(finishTag)) {
            currentTags.push(finishTag);
            row["Tags"] = currentTags.join(", ");
        }

        return true;
    }

    exportCSV() {
        const exportRows = this.rows.filter(row => {
            const cardNum = this.extractCardNumber(row);
            const stock = parseInt(row["Variant Inventory Qty"] || "0", 10);

            if (cardNum <= this.maxProcessedNum && stock === 0) {
                return false;
            }
            return true;
        });

        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '""';
            let str = val.toString().replace(/"/g, '""');
            return `"${str}"`;
        };

        let csvContent = this.headers.map(escapeCSV).join(",") + "\n";
        exportRows.forEach(row => {
            let rowLine = this.headers.map(h => escapeCSV(row[h] || "")).join(",");
            csvContent += rowLine + "\n";
        });

        return csvContent;
    }
}