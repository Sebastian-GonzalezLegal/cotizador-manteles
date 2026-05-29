require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { parseExcelData, getPriceFromDb } = require('./excelParser');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuración de CORS
// Permitimos el puerto por defecto de Vite (5173) y cualquier origen local útil
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'https://cotizador-manteles.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Si no hay origin (ej. herramientas de testing, curl) permitimos la llamada
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'El control de CORS de este servidor no permite peticiones desde este origen.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Middleware para procesar JSON en las peticiones
app.use(express.json());

// Base de datos de nombres de Materiales (los precios vienen del Excel)
const MATERIAL_NAMES = {
  'lino': 'Línea Lino',
  'tapir': 'Línea Tapir'
};

const COSTO_FIJO_CONFECCION = 2500;

// Ruta base informativa
app.get('/', (req, res) => {
  res.json({
    message: 'Asturias Market API - Cotizador de Manteles Activo',
    endpoints: {
      cotizar: 'POST /api/cotizar'
    }
  });
});

// Endpoint POST /api/cotizar
app.post('/api/cotizar', (req, res) => {
  try {
    const { forma, medida1, medida2, linea, estilo, agregado } = req.body;

    // 1. Validaciones de Inputs
    const m1Num = parseFloat(medida1);
    const m2Num = parseFloat(medida2);

    if (!forma || !['rectangular', 'cuadrado', 'redondo'].includes(forma)) {
      return res.status(400).json({ success: false, error: 'Forma de mesa no válida.' });
    }

    if (!m1Num || isNaN(m1Num) || m1Num <= 0) {
      return res.status(400).json({ success: false, error: 'La medida principal es requerida y debe ser positiva.' });
    }

    if (forma === 'rectangular' && (!m2Num || isNaN(m2Num) || m2Num <= 0)) {
      return res.status(400).json({ success: false, error: 'El largo es requerido para mesas rectangulares.' });
    }

    if (!linea || !MATERIAL_NAMES[linea]) {
      return res.status(400).json({ success: false, error: 'La línea de material es requerida o no es válida.' });
    }

    if (!estilo || !['con_caida', 'encastrable', 'ajustable'].includes(estilo)) {
      return res.status(400).json({ success: false, error: 'El estilo no es válido.' });
    }

    // 2. Lógica del Cálculo
    let anchoMesaNum = m1Num;
    let largoMesaNum = forma === 'rectangular' ? m2Num : m1Num;

    let anchoMantelNum = anchoMesaNum;
    let largoMantelNum = largoMesaNum;

    // Ajustes de caída
    if (estilo === 'con_caida') {
      anchoMantelNum += 40; // 20cm de cada lado
      largoMantelNum += 40;
    }
    
    const anchoMetros = anchoMantelNum / 100;
    const largoMetros = largoMantelNum / 100;
    const areaM2 = anchoMetros * largoMetros;

    // Generar nombres descriptivos para el error y la respuesta
    const formatNombre = forma.charAt(0).toUpperCase() + forma.slice(1);
    let agregadoNombre = '';
    if (agregado === 'bies') agregadoNombre = ' - Con Bies';
    else if (agregado === 'flecos') agregadoNombre = ' - Con Flecos';
    const estiloNombre = (estilo === 'con_caida' ? 'Con Caída' : (estilo === 'encastrable' ? 'Encastrable' : 'Ajustable')) + agregadoNombre;

    // Obtener precio base del Excel
    const db = parseExcelData();
    let totalExcel = getPriceFromDb(db, linea, forma, estilo, anchoMesaNum, largoMesaNum, agregado);

    if (totalExcel === null) {
       return res.status(400).json({ 
         success: false, 
         error: `La combinación seleccionada (Mesa ${formatNombre}, Estilo ${estiloNombre}) no está disponible en la lista de precios.` 
       });
    }

    // El precio final ya incluye impuestos, confección y todo
    const total = Math.round(totalExcel);
    const subtotalMaterial = total; // Para mantener la estructura de datos del Frontend
    const precioBaseM2 = 0;
    const configMaterial = { name: MATERIAL_NAMES[linea] };

    // Generar nombres descriptivos (movido arriba para manejo de errores)
    const medidasStr = forma === 'redondo' ? `Ø ${anchoMesaNum}cm` : `${anchoMesaNum}x${largoMesaNum}cm`;

    // 3. Respuesta detallada
    return res.status(200).json({
      success: true,
      data: {
        forma: forma,
        formaName: formatNombre,
        estilo: estilo,
        estiloName: estiloNombre,
        medidasMesaStr: medidasStr,
        anchoMantelCm: anchoMantelNum,
        largoMantelCm: largoMantelNum,
        linea: linea,
        lineaName: configMaterial.name,
        areaM2: Number(areaM2.toFixed(4)),
        precioBaseM2: precioBaseM2,
        subtotalMaterial: subtotalMaterial,
        costoConfeccion: COSTO_FIJO_CONFECCION,
        total: total
      }
    });

  } catch (error) {
    console.error('Error al procesar la cotización:', error);
    return res.status(500).json({
      success: false,
      error: 'Ocurrió un error interno en el servidor al calcular el presupuesto.'
    });
  }
});

// Endpoint POST /api/checkout para pago en Tiendanube
app.post('/api/checkout', async (req, res) => {
  try {
    const { formaName, medidasMesaStr, lineaName, estiloName, total } = req.body;

    // Obtenemos las credenciales desde las variables de entorno
    const storeId = (process.env.TIENDANUBE_STORE_ID || '').trim();
    const accessToken = (process.env.TIENDANUBE_ACCESS_TOKEN || '').trim();

    // Armamos el nombre exacto que va a funcionar como "DNI" del producto
    const productName = `Mantel ${formaName} ${estiloName} - ${lineaName} (Mesa ${medidasMesaStr})`;

    const headers = {
      'Authentication': `bearer ${accessToken}`,
      'User-Agent': 'AsturiasMarketApp (contacto@asturiasmarket.com)',
      'Content-Type': 'application/json'
    };

    // --- PASO 1: BUSCAR SI EL PRODUCTO YA EXISTE ---
    const searchResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/products?q=${encodeURIComponent(productName)}`, {
      method: 'GET',
      headers: headers
    });

    if (searchResponse.ok) {
      const existingProducts = await searchResponse.json();
      // Buscamos coincidencia exacta de nombre
      const exactMatch = existingProducts.find(p => p.name.es === productName);

      if (exactMatch) {
        console.log("♻️ Producto existente encontrado. Reciclando link...");
        const productUrl = exactMatch.canonical_url || (exactMatch.urls && exactMatch.urls.es);
        return res.json({ url: productUrl });
      }
    }

    // --- PASO 2: SI NO EXISTE, LO CREAMOS ---
    console.log("✨ Producto nuevo. Creando en Tiendanube con Tag oculto...");
    const productData = {
      name: { es: productName },
      published: true,
      tags: "cotizador-automatico", // Etiqueta para borrar fácil después
      variants: [
        {
          price: total,
          stock: 999 // Stock alto para que no se agote si reciclamos el link
        }
      ]
    };

    const createResponse = await fetch(`https://api.tiendanube.com/v1/${storeId}/products`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(productData)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Error desde Tiendanube:', errorText);
      return res.status(500).json({ error: 'Error al crear el producto en la tienda' });
    }

    const newProduct = await createResponse.json();

    // Devolvemos la URL oficial del producto (soluciona el error del Hash y Checkout)
    const productUrl = newProduct.canonical_url || (newProduct.urls && newProduct.urls.es);
    res.json({ url: productUrl });

  } catch (error) {
    console.error('Error en /api/checkout:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Inicializar Servidor
app.listen(PORT, () => {
  console.log(`[Asturias Market Server] Corriendo en http://localhost:${PORT}`);
});
