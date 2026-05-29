const xlsx = require('xlsx');

const workbook = xlsx.readFile('TABLA DE PRECIOS.xlsx');
console.log('Sheet Names:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  // Print first 50 rows
  data.slice(0, 50).forEach(row => {
    if (row.length > 0) {
      console.log(row.join(' | '));
    }
  });
}
