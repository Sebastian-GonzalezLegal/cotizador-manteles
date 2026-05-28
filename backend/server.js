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
  'simil_lino': {
    name: 'Línea Ecocuero Simil Lino',
    pricePerM2: 18000
  },
  'ecocuero': {
    name: 'Línea Ecocuero',
    pricePerM2: 15000
  },
  'cristal': {
    name: 'Línea Cristal',
    pricePerM2: 12000
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
    const { forma, medida1, medida2, linea, estilo } = req.body;

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

    if (!linea || !MATERIAL_PRICES[linea]) {
      return res.status(400).json({ success: false, error: 'La línea de material es requerida o no es válida.' });
    }

    if (!estilo || !['con_caida', 'encastrable', 'ajustable'].includes(estilo)) {
      return res.status(400).json({ success: false, error: 'El estilo no es válido.' });
    }

    // 2. Lógica del Cálculo
    let anchoMesaNum = m1Num;
    let largoMesaNum = forma === 'rectangular' ? m2Num : m1Num;
    
    // Para mesas redondas, la caja delimitadora (bounding box) es diámetro x diámetro
    
    let anchoMantelNum = anchoMesaNum;
    let largoMantelNum = largoMesaNum;

    // Ajustes de caída
    if (estilo === 'con_caida') {
      anchoMantelNum += 40; // 20cm de cada lado
      largoMantelNum += 40;
    }
    // Para "encastrable" y "ajustable", las medidas ingresadas son las finales para el cálculo

    // Convertir centímetros a metros
    const anchoMetros = anchoMantelNum / 100;
    const largoMetros = largoMantelNum / 100;

    // Calcular metros cuadrados (m2) envolventes
    const areaM2 = anchoMetros * largoMetros;

    // Obtener precio base del material seleccionado
    const configMaterial = MATERIAL_PRICES[linea];
    const precioBaseM2 = configMaterial.pricePerM2;

    // Calcular subtotal de material y total
    const subtotalMaterial = Math.round(areaM2 * precioBaseM2);
    const total = subtotalMaterial + COSTO_FIJO_CONFECCION;

    // Generar nombres descriptivos
    const formatNombre = forma.charAt(0).toUpperCase() + forma.slice(1);
    const estiloNombre = estilo === 'con_caida' ? 'Con Caída' : (estilo === 'encastrable' ? 'Encastrable' : 'Ajustable');
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
    
    // Obtenemos las credenciales desde las variables de entorno, y removemos posibles saltos de línea (\r) de Windows
    const storeId = (process.env.TIENDANUBE_STORE_ID || '').trim();
    const accessToken = (process.env.TIENDANUBE_ACCESS_TOKEN || '').trim();
    
    // Armamos el cuerpo de la petición según la API de Tiendanube
    const productData = {
      name: { es: `Mantel ${formaName} ${estiloName} - ${lineaName} (Mesa ${medidasMesaStr})` },
      published: true, // Visibilidad activada para que se pueda comprar
      variants: [
        {
          price: total,
          stock: 1 // Stock de 1 porque es a medida y único para este cliente
        }
      ]
    };

    // Llamada a la API de Tiendanube
    const response = await fetch(`https://api.tiendanube.com/v1/${storeId}/products`, {
      method: 'POST',
      headers: {
        'Authentication': `bearer ${accessToken}`,
        'User-Agent': 'AsturiasMarketApp (contacto@asturiasmarket.com)', 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error desde Tiendanube:', errorText);
      return res.status(500).json({ error: 'Error al crear el checkout en la tienda' });
    }

    const newProduct = await response.json();
    
    const productUrl = newProduct.canonical_url || (newProduct.urls && newProduct.urls.es);
    
    if (!newProduct.variants || newProduct.variants.length === 0) {
      return res.status(500).json({ error: 'No se pudo generar la ruta de pago, la variante no existe' });
    }

    // Armamos la URL directa al checkout usando el origin de la tienda y el ID de la variante
    let storeOrigin = 'https://tiendaasturiasmarket.mitiendanube.com';
    try {
      if (productUrl) {
        storeOrigin = new URL(productUrl).origin;
      }
    } catch (err) {
      console.error('URL inválida devuelta por Tiendanube:', productUrl);
    }

    const variantId = newProduct.variants[0].id;
    const checkoutUrl = `${storeOrigin}/checkout/v3/start/${variantId}/1/`;

    // Le devolvemos la URL directa de pago al frontend
    res.json({ url: checkoutUrl });
    
  } catch (error) {
    console.error('Error en /api/checkout:', error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
});

// Inicializar Servidor
app.listen(PORT, () => {
  console.log(`[Asturias Market Server] Corriendo en http://localhost:${PORT}`);
});
