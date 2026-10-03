class TCGStockEditor {
    constructor(csvText, gameConfig) {
        this.config = gameConfig;
        this.rows = [];
        this.updatedRows = [];
        this.headers = [];
        this.metafieldColumn = "product.metafields.custom.yuzey";
        
        this.parseCSV(csvText);
    }

    parseCSV(text) {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return;
        
        this.headers = this.parseCSVLine(lines[0]);

        if (this.config.hasFinishes && !this.headers.includes(this.metafieldColumn)) {
            this.headers.push(this.metafieldColumn);
        }
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length > 0) {
                let rowObj = {};
                this.headers.forEach((header, index) => {
                    rowObj[header] = values[index] !== undefined ? values[index] : "";
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

    findCardByNumber(cardNumber) {
        const results = [];
        const query = cardNumber.toString().trim().toLowerCase();
        
        this.rows.forEach((row, index) => {
            const sku = (row["Variant SKU"] || "").toLowerCase();
            const title = (row["Title"] || "").toLowerCase();

            if (sku.includes(query) || title.includes(query)) {
                results.push({ index, row });
            }
        });
        return results;
    }

    updateCardAtIndex(index, finishName, stock) {
        if (index >= this.rows.length) return false;

        const originalRow = this.rows[index];
        const newRow = JSON.parse(JSON.stringify(originalRow));

        newRow["Variant Inventory Qty"] = stock.toString();

        if (this.config.hasFinishes && finishName) {
            const finishCode = finishName.toUpperCase().replace(/\s+/g, '-');
            const handleSuffix = finishName.toLowerCase().replace(/\s+/g, '-');

            if (!newRow["Title"].includes(`(${finishName})`)) {
                newRow["Title"] = `${newRow["Title"]} (${finishName})`;
            }

            if (!newRow["Handle"].endsWith(handleSuffix)) {
                newRow["Handle"] = `${newRow["Handle"]}-${handleSuffix}`;
            }

            if (newRow["Variant SKU"] && !newRow["Variant SKU"].includes(finishCode)) {
                newRow["Variant SKU"] = `${newRow["Variant SKU"]}-${finishCode}`;
            }

            newRow[this.metafieldColumn] = finishName;
        }

        this.updatedRows.push(newRow);
        return true;
    }

    exportCSV() {
        const escapeCSV = (val) => {
            if (val === undefined || val === null) return '""';
            let str = val.toString().replace(/"/g, '""');
            return `"${str}"`;
        };

        let csvContent = this.headers.map(escapeCSV).join(",") + "\n";
        
        this.updatedRows.forEach(row => {
            let rowLine = this.headers.map(h => escapeCSV(row[h] || "")).join(",");
            csvContent += rowLine + "\n";
        });

        return csvContent;
    }
}