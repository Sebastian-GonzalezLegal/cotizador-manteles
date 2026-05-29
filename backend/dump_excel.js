const xlsx = require('xlsx');
const fs = require('fs');

const workbook = xlsx.readFile('TABLA DE PRECIOS.xlsx');
let out = {};

for (const sheetName of workbook.SheetNames) {
  out[sheetName] = [];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  out[sheetName] = data.filter(row => row.length > 0);
}

fs.writeFileSync('excel_dump.json', JSON.stringify(out, null, 2));
console.log('Done mapping to excel_dump.json');
