import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Layers,
  Maximize2,
  HelpCircle,
  ChevronDown,
  Search,
  User,
  ShoppingBag,
  Info,
  Check
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Catálogo de Materiales con nombres descriptivos para el formulario
const MATERIALES_OPCIONES = [
  { id: 'ecocuero_premium', name: 'Ecocuero Premium - Castaño', desc: '$15.000 el m²' },
  { id: 'ecocuero_beige', name: 'Ecocuero Premium - Beige', desc: '$15.000 el m²' },
  { id: 'tela_antimanchas', name: 'Tela Antimanchas', desc: '$12.000 el m²' },
  { id: 'pvc_cristal', name: 'PVC Cristal Grueso A Medida', desc: '$10.000 el m²' }
];

export default function App() {
  // 1. Estados del Formulario
  const [ancho, setAncho] = useState(140);
  const [largo, setLargo] = useState(200);
  const [material, setMaterial] = useState('ecocuero_premium');

  // 2. Estados de Operación e Integración
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cotizacion, setCotizacion] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // 3. Efecto para re-calcular cotizaciones previas si es necesario
  // Evitamos llamadas innecesarias, pero permitimos cotizar automáticamente
  // al iniciar para que el usuario no vea la pantalla vacía.
  useEffect(() => {
    realizarCotizacion(true); // Cotización inicial silenciosa
  }, []);

  // 4. Lógica de comunicación con el Backend Express
  const realizarCotizacion = async (silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setError('');
    }

    // Validaciones rápidas en Frontend
    if (!ancho || ancho <= 0) {
      if (!silencioso) setError('El ancho debe ser un número positivo.');
      setLoading(false);
      return;
    }
    if (!largo || largo <= 0) {
      if (!silencioso) setError('El largo debe ser un número positivo.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`https://cotizador-manteles.onrender.com/api/cotizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ancho: Number(ancho),
          largo: Number(largo),
          material: material
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCotizacion(result.data);
      } else {
        setError(result.error || 'Ocurrió un error al calcular el presupuesto.');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo establecer comunicación con el servidor de cotizaciones. Asegúrate de que el backend esté corriendo.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    realizarCotizacion();
  };

  // Formateador de moneda en pesos argentinos
  const formatPesos = (valor) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const handlePagar = async () => {
    if (!cotizacion) return; 
    setIsRedirecting(true);
    try {
      // Usamos API_URL que apunta a localhost en desarrollo, y a Render en producción
      const response = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ancho: cotizacion.anchoCm,
          largo: cotizacion.largoCm,
          materialName: cotizacion.materialName,
          total: cotizacion.total
        })
      });

      if (!response.ok) {
        throw new Error('No se pudo generar el link de pago');
      }

      const data = await response.json();
      
      if (data.url) {
        // Redirigir usando window.top para evitar problemas si está embebido (CSP)
        window.top.location.href = data.url;
      } else {
        alert('Hubo un problema al obtener el enlace. Intentá de nuevo.');
      }
    } catch (error) {
      console.error('Error de pago:', error);
      alert('Ocurrió un error al intentar conectarse al checkout.');
    } finally {
      setIsRedirecting(false); 
    }
  };

  // 5. Lógica del Visualizador Dinámico
  // Mapeamos los valores de cm a porcentajes relativos en la mesa representativa (mesa de referencia de 200x200 cm virtuales)
  const calculateClothScale = () => {
    const scaleAncho = Math.max(35, Math.min(95, (ancho / 240) * 80));
    const scaleLargo = Math.max(35, Math.min(95, (largo / 300) * 80));
    return {
      width: `${scaleAncho}%`,
      height: `${scaleLargo}%`,
      left: `${(100 - scaleAncho) / 2}%`,
      top: `${(100 - scaleLargo) / 2}%`
    };
  };

  const clothStyles = calculateClothScale();

  return (
    <div className="main-wrapper">
      {/* Rejilla de Trabajo */}
      <div className="calculator-grid">

        {/* Columna Izquierda: Formulario e Ingreso de Datos */}
        <div className="asturias-card">
          <div className="card-title">
            <Calculator size={20} className="price-accent" />
            Configure las dimensiones de su mantel
          </div>

          {error && (
            <div className="alert-banner error">
              <Info size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Error: </strong> {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Entrada de Ancho */}
            <div className="form-group">
              <label className="form-label" htmlFor="ancho-input">Ancho del Mantel</label>
              <div className="input-container">
                <input
                  id="ancho-input"
                  type="number"
                  className="form-input input-with-suffix"
                  value={ancho}
                  onChange={(e) => setAncho(e.target.value)}
                  placeholder="Ej. 140"
                  min="1"
                  required
                />
                <span className="input-suffix">cm</span>
              </div>
            </div>

            {/* Entrada de Largo */}
            <div className="form-group">
              <label className="form-label" htmlFor="largo-input">Largo del Mantel</label>
              <div className="input-container">
                <input
                  id="largo-input"
                  type="number"
                  className="form-input input-with-suffix"
                  value={largo}
                  onChange={(e) => setLargo(e.target.value)}
                  placeholder="Ej. 200"
                  min="1"
                  required
                />
                <span className="input-suffix">cm</span>
              </div>
            </div>

            {/* Selección del Material */}
            <div className="form-group">
              <label className="form-label" htmlFor="material-select">Material del Mantel</label>
              <select
                id="material-select"
                className="form-select"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              >
                {MATERIALES_OPCIONES.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name} ({op.desc})
                  </option>
                ))}
              </select>
            </div>

            {/* Botón de envío */}
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner"></div>
                  <span>Calculando...</span>
                </>
              ) : (
                <span>Calcular Precio</span>
              )}
            </button>
          </form>

          {/* Recibo/Desglose de Cotización Calculada */}
          {cotizacion && (
            <div className="result-container">
              <h3 className="receipt-title">Resumen de Cotización</h3>

              <div className="receipt-row">
                <span>Dimensiones:</span>
                <span className="receipt-row-val">{cotizacion.anchoCm} cm x {cotizacion.largoCm} cm</span>
              </div>

              <div className="receipt-row">
                <span>Superficie Total:</span>
                <span className="receipt-row-val">{cotizacion.areaM2} m²</span>
              </div>

              <div className="receipt-row">
                <span>Material Seleccionado:</span>
                <span className="receipt-row-val highlighted">{cotizacion.materialName}</span>
              </div>

              <div className="receipt-row">
                <span>Precio Base por m²:</span>
                <span className="receipt-row-val">{formatPesos(cotizacion.precioBaseM2)} / m²</span>
              </div>

              <div className="receipt-row">
                <span>Subtotal Material:</span>
                <span className="receipt-row-val">{formatPesos(cotizacion.subtotalMaterial)}</span>
              </div>

              <div className="receipt-row">
                <span>Confección y Acabados (Fijo):</span>
                <span className="receipt-row-val">{formatPesos(cotizacion.costoConfeccion)}</span>
              </div>

              <div className="receipt-row total-row">
                <span>Total Estimado:</span>
                <span className="price-accent">{formatPesos(cotizacion.total)}</span>
              </div>

              <button 
                onClick={handlePagar} 
                disabled={isRedirecting}
                style={{ 
                  marginTop: '1.5rem',
                  padding: '1rem',
                  cursor: isRedirecting ? 'not-allowed' : 'pointer',
                  backgroundColor: isRedirecting ? '#ccc' : '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  width: '100%',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                  transition: 'background-color 0.2s'
                }}
              >
                {isRedirecting ? (
                  <>
                    <div className="spinner-css" style={{
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid #fff',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <style>{`
                      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    `}</style>
                    Redirigiendo a Tiendanube...
                  </>
                ) : (
                  'Añadir al Carrito y Pagar'
                )}
              </button>
            </div>
          )}
        </div>

        {/* Columna Derecha: Visualizador Interactivo */}
        <div className="visualizer-container">
          <span className="visualizer-title">Vista Previa del Mantel en Mesa</span>

          <div className="table-stage">
            {/* Estructura de la Mesa de madera */}
            <div className="table-base"></div>

            {/* El Mantel dinámico sobre la mesa */}
            <div
              className={`cloth-overlay material-${material}`}
              style={{
                width: clothStyles.width,
                height: clothStyles.height,
                left: clothStyles.left,
                top: clothStyles.top
              }}
            >
              <span className="cloth-label">
                {MATERIALES_OPCIONES.find(op => op.id === material)?.name.split(' - ')[0]}
              </span>
              {/* Solapa caída del mantel */}
              <div className="cloth-drape"></div>
            </div>
          </div>

          {/* Badges de Medidas actualizadas en vivo */}
          <div className="visualizer-dimensions">
            <div className="dimension-badge">
              <Layers size={14} className="price-accent" />
              <span>Ancho: {ancho || 0} cm</span>
            </div>
            <div className="dimension-badge">
              <Maximize2 size={14} className="price-accent" />
              <span>Largo: {largo || 0} cm</span>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Informativo */}
      <p className="footer-text">
        Asturias Market © {new Date().getFullYear()} • Las cotizaciones mostradas son presupuestos estimados en base a confecciones de manteles rectangulares.
      </p>
    </div>
  );
}
