require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// Base de datos simulada de Precios por Material (por metro cuadrado)
const MATERIAL_PRICES = {
  'ecocuero_premium': {
    name: 'Ecocuero Premium - Castaño',
    pricePerM2: 15000
  },
  'ecocuero_beige': {
    name: 'Ecocuero Premium - Beige',
    pricePerM2: 15000
  },
  'tela_antimanchas': {
    name: 'Tela Antimanchas',
    pricePerM2: 12000
  },
  'pvc_cristal': {
    name: 'PVC Cristal Grueso A Medida',
    pricePerM2: 10000
  }
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
    const { ancho, largo, material } = req.body;

    // 1. Validaciones de Inputs
    const anchoNum = parseFloat(ancho);
    const largoNum = parseFloat(largo);

    if (!ancho || isNaN(anchoNum) || anchoNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El ancho es requerido y debe ser un número positivo en centímetros.'
      });
    }

    if (!largo || isNaN(largoNum) || largoNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'El largo es requerido y debe ser un número positivo en centímetros.'
      });
    }

    if (!material || !MATERIAL_PRICES[material]) {
      const materialesValidos = Object.keys(MATERIAL_PRICES).join(', ');
      return res.status(400).json({
        success: false,
        error: `El material es requerido o no es válido. Materiales soportados: [${materialesValidos}].`
      });
    }

    // 2. Lógica del Cálculo
    // Convertir centímetros a metros
    const anchoMetros = anchoNum / 100;
    const largoMetros = largoNum / 100;

    // Calcular metros cuadrados (m2)
    const areaM2 = anchoMetros * largoMetros;

    // Obtener precio base del material seleccionado
    const configMaterial = MATERIAL_PRICES[material];
    const precioBaseM2 = configMaterial.pricePerM2;

    // Calcular subtotal de material y total
    const subtotalMaterial = Math.round(areaM2 * precioBaseM2);
    const total = subtotalMaterial + COSTO_FIJO_CONFECCION;

    // 3. Respuesta detallada
    return res.status(200).json({
      success: true,
      data: {
        anchoCm: anchoNum,
        largoCm: largoNum,
        material: material,
        materialName: configMaterial.name,
        areaM2: Number(areaM2.toFixed(4)), // redondeado a 4 decimales
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
    const { ancho, largo, materialName, total } = req.body;

    const storeId = (process.env.TIENDANUBE_STORE_ID || '').trim();
    const accessToken = (process.env.TIENDANUBE_ACCESS_TOKEN || '').trim();

    // Armamos el nombre exacto que va a funcionar como "DNI" del producto
    const productName = `Mantel a Medida (${ancho}x${largo} cm) - ${materialName}`;

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
      tags: "cotizador-automatico", // <-- ESTA ES LA LÍNEA MÁGICA
      variants: [
        {
          price: total,
          stock: 999 // AUMENTAMOS EL STOCK
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
      return res.status(500).json({ error: 'Error al crear el checkout en la tienda' });
    }

    const newProduct = await createResponse.json();
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
