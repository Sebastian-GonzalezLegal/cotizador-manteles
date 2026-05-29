const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('excel_dump.json', 'utf8'));

function parseExcelData(rawData) {
  const db = {
    lino: [],
    tapir: []
  };

  const parseSheet = (sheetRows, material) => {
    let currentCategory = null;
    let currentHeaders = [];

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      // Check if this row is a header row. Usually contains "TOTAL" or "VALOR FINAL "
      const isHeader = row.some(cell => typeof cell === 'string' && (cell.includes('TOTAL') || cell.includes('VALOR FINAL')));
      
      if (isHeader) {
        currentCategory = row[0];
        currentHeaders = row.map(h => typeof h === 'string' ? h.trim() : h);
        continue;
      }

      // If we have a category and the row starts with a string but has numbers after, it's a data row
      if (currentCategory && row.length >= 4) {
        const desc = row[0];
        
        // Find indexes
        const diametroIdx = currentHeaders.indexOf('Diametro');
        const anchoIdx = currentHeaders.indexOf('Ancho');
        const largoIdx = currentHeaders.indexOf('Largo');
        const valorFinalIdx = currentHeaders.findIndex(h => h && h.includes('VALOR FINAL'));

        if (valorFinalIdx === -1) continue; // Skip if no final value

        const valorFinal = parseFloat(row[valorFinalIdx]);
        if (isNaN(valorFinal)) continue;

        let entry = {
          category: currentCategory,
          desc: desc,
          valorFinal: valorFinal
        };

        if (diametroIdx !== -1) {
          entry.type = 'redondo';
          entry.medida1 = parseFloat(row[diametroIdx]);
          entry.medida2 = entry.medida1;
        } else if (anchoIdx !== -1 && largoIdx !== -1) {
          entry.type = 'rectangular'; // could be cuadrado too
          entry.medida1 = parseFloat(row[anchoIdx]);
          entry.medida2 = parseFloat(row[largoIdx]);
        } else {
          // Fallback, try to parse from description
          if (desc.includes('DIAMETRO') || desc.includes('REDONDO')) {
             entry.type = 'redondo';
          }
        }

        if (entry.medida1) {
          db[material].push(entry);
        }
      }
    }
  };

  if (rawData['Hoja 1']) parseSheet(rawData['Hoja 1'], 'lino');
  if (rawData['Hoja 2']) parseSheet(rawData['Hoja 2'], 'tapir');

  return db;
}

const db = parseExcelData(rawData);
console.log(`Lino entries: ${db.lino.length}`);
console.log(`Tapir entries: ${db.tapir.length}`);
console.log(db.lino.slice(0, 5));
console.log(db.lino.filter(e => e.type === 'rectangular').slice(0, 5));

fs.writeFileSync('parsed_db.json', JSON.stringify(db, null, 2));
