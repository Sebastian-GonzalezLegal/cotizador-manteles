const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

let cachedDb = null;
let lastModifiedTime = null;

const parseExcelData = () => {
  const filePath = path.join(__dirname, 'TABLA DE PRECIOS.xlsx');
  
  if (!fs.existsSync(filePath)) {
    console.error('El archivo TABLA DE PRECIOS.xlsx no existe.');
    return { lino: [], tapir: [] };
  }

  const stat = fs.statSync(filePath);
  if (cachedDb && lastModifiedTime && stat.mtimeMs === lastModifiedTime) {
    return cachedDb;
  }

  console.log('🔄 Recargando datos desde Excel...');
  const workbook = xlsx.readFile(filePath);
  const db = {
    lino: [],
    tapir: []
  };

  const parseSheet = (sheetName, material) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    
    const sheetRows = xlsx.utils.sheet_to_json(sheet, { header: 1 }).filter(row => row.length > 0);
    
    let currentCategory = null;
    let currentHeaders = [];

    for (let i = 0; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      const isHeader = row.some(cell => typeof cell === 'string' && (cell.includes('TOTAL') || cell.includes('VALOR FINAL') || cell === 'Columna 1'));
      
      if (isHeader) {
        currentCategory = row[0];
        currentHeaders = row.map(h => typeof h === 'string' ? h.trim() : h);
        continue;
      }

      if (currentCategory && row.length >= 4) {
        const desc = row[0];
        const diametroIdx = currentHeaders.indexOf('Diametro');
        const anchoIdx = currentHeaders.indexOf('Ancho');
        const largoIdx = currentHeaders.indexOf('Largo');
        const agregadoIdx = currentHeaders.findIndex(h => typeof h === 'string' && h.toLowerCase().includes('agregado'));
        const tamanoIdx = currentHeaders.findIndex(h => typeof h === 'string' && h.toLowerCase().trim() === 'tamaño');
        const tipoIdx = currentHeaders.findIndex(h => typeof h === 'string' && h.toLowerCase().trim() === 'tipo');
        const valorFinalIdx = currentHeaders.findIndex(h => h === 'VALOR FINAL' || h === 'VALOR FINAL ' || h === 'Columna 1');

        if (valorFinalIdx === -1) continue;

        const valorFinal = parseFloat(row[valorFinalIdx]);
        if (isNaN(valorFinal)) continue;

        let entry = {
          category: currentCategory,
          desc: desc,
          valorFinal: valorFinal,
          agregado: (agregadoIdx !== -1 && typeof row[agregadoIdx] === 'string') ? row[agregadoIdx].toLowerCase().trim() : 'ninguno',
          tamano: (tamanoIdx !== -1 && typeof row[tamanoIdx] === 'string') ? row[tamanoIdx].toLowerCase().trim() : null,
          tipo: (tipoIdx !== -1 && typeof row[tipoIdx] === 'string') ? row[tipoIdx].toLowerCase().trim() : null
        };

        if (entry.tamano) {
            entry.type = entry.tamano; // 'redondo', 'rectangular', 'cuadrado'
            if (diametroIdx !== -1 && row[diametroIdx]) {
                entry.medida1 = parseFloat(row[diametroIdx]);
                entry.medida2 = entry.medida1;
            } else if (anchoIdx !== -1 && largoIdx !== -1 && row[anchoIdx] && row[largoIdx]) {
                entry.medida1 = parseFloat(row[anchoIdx]);
                entry.medida2 = parseFloat(row[largoIdx]);
            } else {
                // Intento extraer medida de la descripción si faltan columnas
                const match = desc.match(/(\d+[,.]\d+|\d+)/);
                if (match) {
                    let val = parseFloat(match[0].replace(',', '.'));
                    if (val < 10) val *= 100;
                    entry.medida1 = val;
                    entry.medida2 = val;
                }
            }
        } else {
            // FALLBACK ANTIGUO
            if (diametroIdx !== -1 && row[diametroIdx]) {
              entry.type = 'redondo';
              entry.medida1 = parseFloat(row[diametroIdx]);
              entry.medida2 = entry.medida1;
            } else if (anchoIdx !== -1 && largoIdx !== -1 && row[anchoIdx] && row[largoIdx]) {
              // Determinar si es cuadrado o rectangular por el nombre de la categoría o si los lados son iguales
              if (currentCategory.includes('CUADRAD') || parseFloat(row[anchoIdx]) === parseFloat(row[largoIdx])) {
                 entry.type = 'cuadrado';
              } else {
                 entry.type = 'rectangular';
              }
              entry.medida1 = parseFloat(row[anchoIdx]);
              entry.medida2 = parseFloat(row[largoIdx]);
            } else {
              if (typeof desc === 'string' && (desc.includes('DIAMETRO') || desc.includes('REDONDO'))) {
                 entry.type = 'redondo';
                 // Intenta extraer diametro de la descripcion (ej: "DIAMETRO 1,20")
                 const match = desc.match(/(\d+[,.]\d+|\d+)/);
                 if (match) {
                     let val = parseFloat(match[0].replace(',', '.'));
                     if (val < 10) val *= 100; // si está en metros, pasa a cm
                     entry.medida1 = val;
                     entry.medida2 = val;
                 }
              }
            }
        }

        if (entry.medida1) {
          db[material].push(entry);
        }
      }
    }
  };

  parseSheet('Hoja 1', 'lino');
  parseSheet('Hoja 2', 'tapir');
  
  cachedDb = db;
  lastModifiedTime = stat.mtimeMs;
  return db;
};

const getPriceFromDb = (db, material, forma, estilo, medida1, medida2, agregado) => {
  const table = db[material];
  if (!table) return null;

  // Filtrar por forma (redondo, rectangular, cuadrado)
  let matchingEntries = table.filter(e => e.type === forma);
  
  // Transformar estilo de frontend a formato de la columna Tipo ('con_caida' -> 'caida')
  const estiloEsperado = estilo === 'con_caida' ? 'caida' : estilo;
  
  // Filtrar estrictamente por Tipo
  matchingEntries = matchingEntries.filter(e => e.tipo === estiloEsperado);
  if (matchingEntries.length === 0) return null;

  // Filtrar estrictamente por agregado
  if (agregado) {
    matchingEntries = matchingEntries.filter(e => e.agregado === agregado);
  }

  if (matchingEntries.length === 0) return null;

  // Lógica de búsqueda e interpolación
  if (forma === 'redondo' || forma === 'cuadrado') {
      // Solo nos importa medida1
      const size = medida1;
      
      // Ordenar por tamaño
      matchingEntries.sort((a, b) => a.medida1 - b.medida1);
      
      // Búsqueda exacta
      const exact = matchingEntries.find(e => e.medida1 === size);
      if (exact) return exact.valorFinal;

      // Buscar el menor superior y mayor inferior
      let lower = null;
      let upper = null;
      for (let i = 0; i < matchingEntries.length; i++) {
         if (matchingEntries[i].medida1 < size) lower = matchingEntries[i];
         if (matchingEntries[i].medida1 > size && !upper) upper = matchingEntries[i];
      }

      if (lower && upper) {
         // Interpolación lineal
         const diff = upper.medida1 - lower.medida1;
         const ratio = (size - lower.medida1) / diff;
         return lower.valorFinal + ratio * (upper.valorFinal - lower.valorFinal);
      } else if (lower) {
         // Si es mayor que el más grande, usamos el precio más grande o extrapolamos
         return lower.valorFinal;
      } else if (upper) {
         return upper.valorFinal;
      }

  } else if (forma === 'rectangular') {
      // Ordenamos primero por área (ancho * largo)
      const area = medida1 * medida2;
      matchingEntries.sort((a, b) => (a.medida1 * a.medida2) - (b.medida1 * b.medida2));
      
      // Búsqueda exacta
      const exact = matchingEntries.find(e => 
          (e.medida1 === medida1 && e.medida2 === medida2) || 
          (e.medida1 === medida2 && e.medida2 === medida1)
      );
      if (exact) return exact.valorFinal;

      // Interpolación basada en área
      let lower = null;
      let upper = null;
      for (let i = 0; i < matchingEntries.length; i++) {
         const entryArea = matchingEntries[i].medida1 * matchingEntries[i].medida2;
         if (entryArea < area) lower = matchingEntries[i];
         if (entryArea > area && !upper) upper = matchingEntries[i];
      }

      if (lower && upper) {
         const lowerArea = lower.medida1 * lower.medida2;
         const upperArea = upper.medida1 * upper.medida2;
         const diff = upperArea - lowerArea;
         const ratio = (area - lowerArea) / diff;
         return lower.valorFinal + ratio * (upper.valorFinal - lower.valorFinal);
      } else if (lower) {
         return lower.valorFinal;
      } else if (upper) {
         return upper.valorFinal;
      }
  }

  return null;
};

module.exports = {
  parseExcelData,
  getPriceFromDb
};
