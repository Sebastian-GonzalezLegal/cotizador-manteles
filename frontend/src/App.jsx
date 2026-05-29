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
  Check,
  ArrowLeftRight,
  ArrowUpDown
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const FORMAS_OPCIONES = [
  { id: 'rectangular', name: 'Rectangular' },
  { id: 'cuadrado', name: 'Cuadrado' },
  { id: 'redondo', name: 'Redondo' }
];

const LINEAS_OPCIONES = [
  { id: 'lino', name: 'Línea Lino' },
  { id: 'tapir', name: 'Línea Tapir' }
];

const ESTILOS_NOMBRES = {
  'con_caida': 'Con caída',
  'encastrable': 'Encastrable',
  'ajustable': 'Ajustable con elástico'
};

const ESTILOS_DISPONIBLES = {
  'lino': {
    'rectangular': ['con_caida', 'encastrable'],
    'cuadrado': ['con_caida', 'encastrable'],
    'redondo': ['con_caida', 'encastrable', 'ajustable']
  },
  'tapir': {
    'rectangular': ['con_caida', 'encastrable'],
    'cuadrado': ['con_caida', 'encastrable'],
    'redondo': ['con_caida', 'encastrable', 'ajustable']
  }
};

export default function App() {
  const [checkoutUrl, setCheckoutUrl] = useState(null);

  // 1. Estados del Formulario
  const [forma, setForma] = useState('rectangular');
  const [medida1, setMedida1] = useState(140);
  const [medida2, setMedida2] = useState(200);
  const [linea, setLinea] = useState('lino');
  const [estilo, setEstilo] = useState('con_caida');
  const [agregado, setAgregado] = useState('ninguno');

  // 2. Estados de Operación e Integración
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cotizacion, setCotizacion] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isOutdated, setIsOutdated] = useState(false);

  const estilosPermitidos = ESTILOS_DISPONIBLES[linea]?.[forma] || [];

  // Marcar como desactualizado si cambia algún valor
  useEffect(() => {
    if (cotizacion) {
      setIsOutdated(true);
      setCheckoutUrl(null);
    }
  }, [forma, medida1, medida2, linea, estilo, agregado]);

  // Ajustar estilo si no es válido para la combinación
  useEffect(() => {
    if (estilosPermitidos.length > 0 && !estilosPermitidos.includes(estilo)) {
      setEstilo(estilosPermitidos[0]);
    }
  }, [forma, linea, estilo, estilosPermitidos]);

  useEffect(() => {
    realizarCotizacion(true); // Cotización inicial silenciosa
  }, []);

  const realizarCotizacion = async (silencioso = false) => {
    if (!silencioso) {
      setLoading(true);
      setError('');
    }

    if (!medida1 || medida1 <= 0) {
      if (!silencioso) setError('Las medidas de la mesa deben ser positivas.');
      setLoading(false);
      return;
    }
    if (forma === 'rectangular' && (!medida2 || medida2 <= 0)) {
      if (!silencioso) setError('El largo de la mesa debe ser positivo.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/cotizar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          forma,
          medida1: Number(medida1),
          medida2: forma === 'rectangular' ? Number(medida2) : Number(medida1),
          linea,
          estilo,
          agregado
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setCotizacion(result.data);
        setIsOutdated(false);
      } else {
        setError(result.error || 'Ocurrió un error al calcular el presupuesto.');
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo establecer comunicación con el servidor.');
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    realizarCotizacion();
  };

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
    setCheckoutUrl(null);
    try {
      const response = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          formaName: cotizacion.formaName,
          medidasMesaStr: cotizacion.medidasMesaStr,
          lineaName: cotizacion.lineaName,
          estiloName: cotizacion.estiloName,
          total: cotizacion.total
        })
      });

      if (!response.ok) {
        let errStr = 'No se pudo generar el link de pago';
        try {
          const errData = await response.json();
          if (errData.error) errStr += ' - ' + errData.error;
        } catch(e) {}
        throw new Error(errStr);
      }

      const data = await response.json();

      if (data.url) {
        setTimeout(() => {
          setCheckoutUrl(data.url);
          setIsRedirecting(false);
        }, 1500);
      } else {
        alert('Hubo un problema al obtener el enlace.');
        setIsRedirecting(false);
      }
    } catch (error) {
      console.error('Error de pago:', error);
      alert('Ocurrió un error al intentar conectarse al checkout. \n' + error.message);
      setIsRedirecting(false);
    }
  };

  const getInstruccionesMedicion = () => {
    if (estilo === 'con_caida') {
      if (forma === 'redondo') {
        return "Medí el diámetro de tu mesa y sumale 40 cm para obtener una caída de 20 cm alrededor. Con esta medida lográs una caída elegante, pareja y visualmente armoniosa.";
      } else {
        return "Medí el largo y el ancho de tu mesa y sumale 40 cm al largo y 40 cm al ancho. Así obtenés una caída de 20 cm por lado, la medida recomendada para lograr una mesa armónica y elegante.";
      }
    } else if (estilo === 'encastrable') {
      if (forma === 'redondo') {
        return "Las medidas publicadas corresponden al diámetro exacto de la mesa (no incluyen caída). Seleccioná la medida de tu mesa y el mantel calzará perfecto.";
      } else {
        return "Las medidas publicadas corresponden al tamaño exacto de la mesa (no incluyen caída). Solo seleccioná la medida de tu mesa y el mantel calzará perfecto.";
      }
    } else if (estilo === 'ajustable') {
      return "Seleccioná el diámetro de tu mesa. El elástico permite un leve margen de adaptación para asegurar un ajuste cómodo y firme.";
    }
    return "";
  };

  const calculateTableScale = () => {
    const isRedondo = forma === 'redondo';
    const isCuadrado = forma === 'cuadrado';
    
    // Tamaños base visuales para la mesa (ignoramos los cm ingresados para no achicar el dibujo)
    // Rectangular es más ancha, cuadrado/redondo son proporcionados.
    const baseWidth = (isCuadrado || isRedondo) ? 60 : 80;
    const baseHeight = (isCuadrado || isRedondo) ? 80 : 70;
    
    // Si tiene caída, el mantel es visualmente más grande que la mesa
    let paddingMantel = estilo === 'con_caida' ? 12 : 0;
    
    return {
      tableWidth: `${baseWidth}%`,
      tableHeight: `${baseHeight}%`,
      tableLeft: `${(100 - baseWidth) / 2}%`,
      tableTop: `${(100 - baseHeight) / 2}%`,
      tableBorderRadius: isRedondo ? '50%' : '6px',
      clothWidth: `calc(${baseWidth}% + ${paddingMantel}%)`,
      clothHeight: `calc(${baseHeight}% + ${paddingMantel}%)`,
      clothLeft: `calc(${(100 - baseWidth) / 2}% - ${paddingMantel/2}%)`,
      clothTop: `calc(${(100 - baseHeight) / 2}% - ${paddingMantel/2}%)`
    };
  };

  const styles = calculateTableScale();

  return (
    <div className="main-wrapper">
      <div className="calculator-grid">

        <div className="asturias-card">
          <div className="card-title">
            <Calculator size={20} className="price-accent" />
            Cotizá el mantel para tu mesa
          </div>

          {error && (
            <div className="alert-banner error">
              <Info size={18} style={{ flexShrink: 0 }} />
              <div><strong>Error: </strong> {error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Forma de la Mesa</label>
              <select className="form-select" value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMAS_OPCIONES.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label" htmlFor="m1-input">
                  {forma === 'rectangular' ? 'Ancho de la Mesa' : (forma === 'redondo' ? 'Diámetro de la Mesa' : 'Lado de la Mesa')}
                </label>
                <div className="input-container">
                  <input
                    id="m1-input" type="number" className="form-input input-with-suffix"
                    value={medida1} onChange={(e) => setMedida1(e.target.value)} min="1" required
                  />
                  <span className="input-suffix">cm</span>
                </div>
              </div>

              {forma === 'rectangular' && (
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label" htmlFor="m2-input">Largo de la Mesa</label>
                  <div className="input-container">
                    <input
                      id="m2-input" type="number" className="form-input input-with-suffix"
                      value={medida2} onChange={(e) => setMedida2(e.target.value)} min="1" required
                    />
                    <span className="input-suffix">cm</span>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Línea de Material</label>
              <select className="form-select" value={linea} onChange={(e) => setLinea(e.target.value)}>
                {LINEAS_OPCIONES.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estilo de Confección</label>
              <select className="form-select" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
                {estilosPermitidos.map(op => <option key={op} value={op}>{ESTILOS_NOMBRES[op]}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Terminación (Agregado)</label>
              <select className="form-select" value={agregado} onChange={(e) => setAgregado(e.target.value)}>
                <option value="ninguno">Sin agregado</option>
                <option value="bies">Con Bies</option>
                <option value="flecos">Con Flecos</option>
              </select>
            </div>
            
            <div className="alert-banner" style={{ backgroundColor: '#f5f0ec', color: '#5e4d42', borderLeft: '4px solid #7a6659' }}>
              <Info size={24} style={{ flexShrink: 0 }} />
              <div>
                <strong>¿Cómo mido mi mesa?</strong><br/>
                <span style={{ fontSize: '0.8rem' }}>{getInstruccionesMedicion()}</span>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <><div className="spinner"></div><span>Calculando...</span></> : <span>Calcular Precio</span>}
            </button>
          </form>

          {cotizacion && (
            <div className="result-container">
              <h3 className="receipt-title">Resumen de Cotización</h3>
              <div className="receipt-row"><span>Mesa a vestir:</span><span className="receipt-row-val highlighted">{cotizacion.formaName} ({cotizacion.medidasMesaStr})</span></div>
              <div className="receipt-row"><span>Medida final del Mantel:</span><span className="receipt-row-val">{cotizacion.anchoMantelCm} cm x {cotizacion.largoMantelCm} cm</span></div>
              <div className="receipt-row"><span>Línea / Estilo:</span><span className="receipt-row-val">{cotizacion.lineaName} ({cotizacion.estiloName})</span></div>
              <div className="receipt-row"><span>Superficie a confeccionar:</span><span className="receipt-row-val">{cotizacion.areaM2} m²</span></div>
              <div className="receipt-row total-row"><span>Total Estimado:</span><span className="price-accent">{formatPesos(cotizacion.total)}</span></div>

              {checkoutUrl ? (
                <a href={checkoutUrl} target="_top" style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#2e7d32', color: '#fff', textDecoration: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem', transition: 'background-color 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                  ✅ ¡Producto listo! Clic aquí para Pagar
                </a>
              ) : (
                <button 
                  onClick={handlePagar} 
                  disabled={isRedirecting || isOutdated} 
                  style={{ 
                    marginTop: '1.5rem', 
                    padding: '1rem', 
                    cursor: (isRedirecting || isOutdated) ? 'not-allowed' : 'pointer', 
                    backgroundColor: (isRedirecting || isOutdated) ? '#ccc' : '#000', 
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
                    <><div className="spinner-css" style={{ border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', width: '18px', height: '18px', animation: 'spin 1s linear infinite' }}></div> Redirigiendo a Tiendanube...</>
                  ) : isOutdated ? (
                    'Calculá el precio para continuar'
                  ) : (
                    'Añadir al Carrito y Pagar'
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="visualizer-container">
          <span className="visualizer-title">Vista Previa de Confección</span>
          <div className="table-stage">
            <div className="table-base" style={{ width: styles.tableWidth, height: styles.tableHeight, left: styles.tableLeft, top: styles.tableTop, borderRadius: styles.tableBorderRadius }}></div>
            <div className={`cloth-overlay material-${linea}`} style={{ width: styles.clothWidth, height: styles.clothHeight, left: styles.clothLeft, top: styles.clothTop, borderRadius: styles.tableBorderRadius }}>
              <span className="cloth-label">{LINEAS_OPCIONES.find(op => op.id === linea)?.name.split(' ')[1]}</span>
              {estilo === 'con_caida' && <div className="cloth-drape" style={{ borderRadius: styles.tableBorderRadius }}></div>}
            </div>
            
            {forma === 'rectangular' && (
              <>
                <div className="measure-badge badge-x">
                  <ArrowLeftRight size={12} /> Largo: {medida2 || 0} cm
                </div>
                <div className="measure-badge badge-y">
                  <ArrowUpDown size={12} /> Ancho: {medida1 || 0} cm
                </div>
              </>
            )}
            {(forma === 'cuadrado' || forma === 'redondo') && (
              <div className="measure-badge badge-x">
                <ArrowLeftRight size={12} /> {forma === 'redondo' ? 'Diámetro' : 'Lado'}: {medida1 || 0} cm
              </div>
            )}
          </div>
          <div className="visualizer-dimensions">
            <div className="dimension-badge"><Layers size={14} className="price-accent" /><span>{forma === 'redondo' ? 'Diámetro' : 'Ancho'}: {medida1 || 0} cm</span></div>
            {forma === 'rectangular' && <div className="dimension-badge"><Maximize2 size={14} className="price-accent" /><span>Largo: {medida2 || 0} cm</span></div>}
            <div className="dimension-badge"><Check size={14} className="price-accent" /><span>Estilo: {ESTILOS_NOMBRES[estilo]}</span></div>
          </div>
        </div>

      </div>
      <p className="footer-text">Asturias Market © {new Date().getFullYear()} • Cotizador Automático</p>
    </div>
  );
}
