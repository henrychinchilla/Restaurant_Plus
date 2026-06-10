// src/App.tsx
import { useState, useEffect } from 'react';
import { 
  Star, CheckCircle, MessageSquare, Settings, AlertCircle, 
  Phone, Mail, User, Music, Smile, Shield, Activity, 
  FileText, RefreshCw, Sliders, Download, LogOut, 
  TrendingUp, Coffee, Sparkles, Share2, ClipboardList
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Interfaces
interface SurveyConfig {
  loyalty_strategy: 'none' | 'discount' | 'points';
  loyalty_discount_value: string;
  loyalty_points_value: string;
}

interface AdminConfig extends SurveyConfig {
  manager_email: string;
  manager_phone: string;
  manager_notifications_enabled: string;
  admin_password?: string;
}

interface KPIStats {
  total_responses: number;
  avg_food: number;
  avg_atmosphere: number;
  avg_waiter: number;
  avg_quality: number;
  avg_cost: number;
  avg_parking: number;
  manager_greeted_percentage: number;
  avg_karaoke_song: number;
  avg_karaoke_wait: number;
  recent_comments: Array<{ customer_name: string; comments: string; created_at: string }>;
  recent_responses: Array<any>;
}

export default function App() {
  const [isAdminMode, setIsAdminMode] = useState(window.location.pathname === '/admin');
  const [surveyConfig, setSurveyConfig] = useState<SurveyConfig>({
    loyalty_strategy: 'none',
    loyalty_discount_value: '',
    loyalty_points_value: ''
  });
  
  // Update browser history when toggling admin mode
  const toggleAdminMode = (admin: boolean) => {
    setIsAdminMode(admin);
    window.history.pushState(null, '', admin ? '/admin' : '/');
  };

  // Listen to popstate to support browser back button
  useEffect(() => {
    const handlePopState = () => {
      setIsAdminMode(window.location.pathname === '/admin');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load public configurations
  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setSurveyConfig(data as SurveyConfig);
      })
      .catch(err => console.error('Failed to load public config:', err));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Navbar */}
      <nav style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => toggleAdminMode(false)}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontFamily: 'var(--font-serif)'
          }}>R+</div>
          <span style={{ fontWeight: 'bold', fontSize: '18px', color: 'var(--primary)', fontFamily: 'var(--font-serif)' }}>Restaurant Plus</span>
        </div>
        
        <button 
          onClick={() => toggleAdminMode(!isAdminMode)} 
          className="btn btn-outline" 
          style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '4px' }}
        >
          {isAdminMode ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ClipboardList size={16} /> Ver Encuesta</span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Shield size={16} /> Panel Admin</span>
          )}
        </button>
      </nav>

      {/* Main Body */}
      {isAdminMode ? (
        <AdminPanel />
      ) : (
        <SurveyWizard config={surveyConfig} />
      )}

      {/* Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Restaurant Plus. Todos los derechos reservados.</p>
        <p style={{ marginTop: '4px', opacity: 0.6 }}>Evaluando calidad y servicio para consentirte.</p>
      </footer>
    </div>
  );
}

// -------------------------------------------------------------
// SURVEY WIZARD FRONTEND
// -------------------------------------------------------------
function SurveyWizard({ config }: { config: SurveyConfig }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [rewardDetails, setRewardDetails] = useState({ type: 'none', text: '' });

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  const [foodRating, setFoodRating] = useState<number | null>(null);
  const [qualityRating, setQualityRating] = useState<number | null>(null);
  const [costRating, setCostRating] = useState<number | null>(null);
  const [atmosphereRating, setAtmosphereRating] = useState<number | null>(null);
  
  const [waiterRating, setWaiterRating] = useState<number>(0);
  const [waiterName, setWaiterName] = useState('');
  const [managerGreeted, setManagerGreeted] = useState<boolean | null>(null);
  const [managerName, setManagerName] = useState('');
  const [parkingRating, setParkingRating] = useState<number>(0);

  const [eventType, setEventType] = useState<string>('none');
  const [eventSongRating, setEventSongRating] = useState<number>(0);
  const [eventWaitRating, setEventWaitRating] = useState<number>(0);
  const [eventGeneralRating, setEventGeneralRating] = useState<number>(0);

  const [comments, setComments] = useState('');

  const nextStep = () => {
    if (step === 1 && (!customerName || !customerPhone || !customerEmail)) {
      setError('Por favor, ingresa tu nombre, teléfono y correo electrónico para continuar.');
      return;
    }
    if (step === 2 && (foodRating === null || qualityRating === null || costRating === null || atmosphereRating === null)) {
      setError('Por favor, califica todos los aspectos de esta sección (1 al 10).');
      return;
    }
    if (step === 3 && (waiterRating === 0 || managerGreeted === null || parkingRating === 0)) {
      setError('Por favor, califica al mesero, responde sobre el gerente y califica el parqueo.');
      return;
    }
    if (step === 4 && eventType !== 'none') {
      if (eventType === 'karaoke' && (eventSongRating === 0 || eventWaitRating === 0)) {
        setError('Por favor, califica el repertorio de canciones y los tiempos de espera del Karaoke.');
        return;
      }
      if (eventType !== 'karaoke' && eventGeneralRating === 0) {
        setError('Por favor, califica tu experiencia en el evento.');
        return;
      }
    }

    setError('');
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      food_rating: foodRating,
      atmosphere_rating: atmosphereRating,
      waiter_rating: waiterRating,
      waiter_name: waiterName,
      quality_rating: qualityRating,
      cost_rating: costRating,
      manager_greeted: managerGreeted,
      manager_name: managerName,
      parking_rating: parkingRating,
      event_type: eventType,
      event_rating_song_selection: eventType === 'karaoke' ? eventSongRating : null,
      event_rating_wait_time: eventType === 'karaoke' ? eventWaitRating : null,
      event_rating_general: eventType !== 'karaoke' && eventType !== 'none' ? eventGeneralRating : null,
      comments: comments
    };

    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json() as any;
      if (!res.ok) {
        throw new Error(result.error || 'Ocurrió un error al enviar la encuesta.');
      }
      
      setRewardDetails({
        type: result.reward_sent,
        text: result.reward_details
      });
      setCompleted(true);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Standard Star Rating UI Helper
  const StarRating = ({ value, onChange, max = 5 }: { value: number, onChange: (val: number) => void, max?: number }) => {
    return (
      <div className="stars-container">
        {[...Array(max)].map((_, i) => {
          const starVal = i + 1;
          return (
            <button
              type="button"
              key={i}
              className={`star-btn ${starVal <= value ? 'filled' : ''}`}
              onClick={() => onChange(starVal)}
            >
              <Star size={32} fill={starVal <= value ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
    );
  };

  // Standard 1-10 Scale Rating UI Helper
  const Scale10Rating = ({ value, onChange }: { value: number | null, onChange: (val: number) => void }) => {
    return (
      <div className="scale-10-container">
        {[...Array(10)].map((_, i) => {
          const ratingVal = i + 1;
          return (
            <button
              type="button"
              key={i}
              className={`scale-10-btn ${value === ratingVal ? 'active' : ''}`}
              onClick={() => onChange(ratingVal)}
            >
              {ratingVal}
            </button>
          );
        })}
      </div>
    );
  };

  if (completed) {
    return (
      <div className="container animate-fade-in">
        <div className="card text-center" style={{ padding: '48px 32px', textAlign: 'center' }}>
          <div className="logo-icon" style={{ backgroundColor: 'var(--success)', backgroundImage: 'none', marginBottom: '24px' }}>
            <CheckCircle size={32} />
          </div>
          
          <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>¡Encuesta Completada!</h2>
          
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px' }}>
            Gracias por confiar en nosotros y gracias por tus respuestas. Todos tus comentarios nos ayudan a poder mejorar.
          </p>

          {rewardDetails.type !== 'none' && (
            <div style={{
              backgroundColor: 'rgba(212, 175, 55, 0.08)',
              border: '1px solid var(--secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              maxWidth: '450px',
              margin: '0 auto 24px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-gold)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--secondary)', marginBottom: '8px' }}>
                <Sparkles size={28} />
              </div>
              <h4 style={{ color: 'var(--primary)', marginBottom: '8px', fontSize: '18px' }}>Beneficio de Fidelidad Activado</h4>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-main)', margin: '8px 0' }}>
                {rewardDetails.text}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {rewardDetails.type === 'discount' 
                  ? 'Hemos enviado un correo a tu email. Muestra ese correo en caja para canjear tu descuento.' 
                  : `Tus puntos se han asignado al número de teléfono ${customerPhone}.`}
              </p>
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: 'var(--text-muted)',
            fontSize: '14px',
            backgroundColor: 'var(--bg-main)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            maxWidth: '400px',
            margin: '0 auto'
          }}>
            <Mail size={16} />
            <span>Se ha enviado un correo de confirmación a: <strong>{customerEmail}</strong></span>
          </div>

          <button 
            onClick={() => {
              setCompleted(false);
              setStep(1);
              setCustomerName('');
              setCustomerPhone('');
              setCustomerEmail('');
              setFoodRating(null);
              setQualityRating(null);
              setCostRating(null);
              setAtmosphereRating(null);
              setWaiterRating(0);
              setWaiterName('');
              setManagerGreeted(null);
              setManagerName('');
              setParkingRating(0);
              setEventType('none');
              setComments('');
            }}
            className="btn btn-primary"
            style={{ marginTop: '32px' }}
          >
            Llenar otra encuesta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in">
      {/* Header Info */}
      <div className="header">
        <div className="logo-icon">
          <Coffee size={24} />
        </div>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Tu Opinión Importa</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Ayúdanos a brindarte la mejor experiencia culinaria</p>
      </div>

      {/* Steps Progress Indicator */}
      <div className="wizard-progress">
        <div className={`wizard-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>1</div>
        <div className={`wizard-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>2</div>
        <div className={`wizard-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>3</div>
        <div className={`wizard-step ${step === 4 ? 'active' : step > 4 ? 'completed' : ''}`}>4</div>
        <div className={`wizard-step ${step === 5 ? 'active' : step > 5 ? 'completed' : ''}`}>5</div>
      </div>

      {error && (
        <div className="alert alert-danger animate-fade-in">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Survey Card */}
      <div className="card">
        {/* STEP 1: CONTACT INFO */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '16px', fontSize: '20px' }}>Información de Contacto</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              Ingresa tus datos para registrar tu participación.
              {config.loyalty_strategy === 'discount' && (
                <span className="text-gold" style={{ display: 'block', fontWeight: 'bold', marginTop: '8px' }}>
                  ★ ¡Completa la encuesta y obtén: {config.loyalty_discount_value}!
                </span>
              )}
              {config.loyalty_strategy === 'points' && (
                <span className="text-gold" style={{ display: 'block', fontWeight: 'bold', marginTop: '8px' }}>
                  ★ ¡Completa la encuesta y acumula: {config.loyalty_points_value}!
                </span>
              )}
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="name">Nombre Completo</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><User size={18} /></span>
                <input 
                  type="text" 
                  id="name" 
                  className="form-input" 
                  placeholder="Ej. Juan Pérez" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">Número de Teléfono</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Phone size={18} /></span>
                <input 
                  type="tel" 
                  id="phone" 
                  className="form-input" 
                  placeholder="Ej. +502 4589-9821" 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}><Mail size={18} /></span>
                <input 
                  type="email" 
                  id="email" 
                  className="form-input" 
                  placeholder="juan.perez@email.com" 
                  value={customerEmail} 
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                  required
                />
              </div>
            </div>
            
            <button type="button" onClick={nextStep} className="btn btn-primary btn-block" style={{ marginTop: '12px' }}>
              Iniciar Encuesta
            </button>
          </div>
        )}

        {/* STEP 2: FOOD AND ATMOSPHERE */}
        {step === 2 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Calidad de los Alimentos y Ambiente</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>Califica del 1 (Muy Malo) al 10 (Excelente)</p>

            <div className="form-group">
              <div className="rating-label">1. Preparación de los Alimentos</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Sabor, temperatura y presentación del platillo.</p>
              <Scale10Rating value={foodRating} onChange={setFoodRating} />
              <div className="scale-labels"><span>Muy Malo</span><span>Excelente</span></div>
            </div>

            <div className="form-group">
              <div className="rating-label">2. Calidad de los Productos</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Frescura e ingredientes utilizados.</p>
              <Scale10Rating value={qualityRating} onChange={setQualityRating} />
              <div className="scale-labels"><span>Inconforme</span><span>Excelente</span></div>
            </div>

            <div className="form-group">
              <div className="rating-label">3. Relación Costo / Beneficio</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>El precio de los platos versus la porción y sabor.</p>
              <Scale10Rating value={costRating} onChange={setCostRating} />
              <div className="scale-labels"><span>Muy Caro</span><span>Excelente</span></div>
            </div>

            <div className="form-group">
              <div className="rating-label">4. Ambiente del Restaurante</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Música, iluminación, temperatura y comodidad física.</p>
              <Scale10Rating value={atmosphereRating} onChange={setAtmosphereRating} />
              <div className="scale-labels"><span>Desagradable</span><span>Encantador</span></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={prevStep} className="btn btn-outline" style={{ flex: 1 }}>Atrás</button>
              <button type="button" onClick={nextStep} className="btn btn-primary" style={{ flex: 2 }}>Continuar</button>
            </div>
          </div>
        )}

        {/* STEP 3: WAITER, MANAGER, PARKING */}
        {step === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Atención y Staff</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>Cuéntanos cómo fue el trato que recibiste.</p>

            <div className="form-group">
              <div className="rating-label">1. Servicio del Mesero (1 - 5 Estrellas)</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Amabilidad, rapidez y cortesía.</p>
              <StarRating value={waiterRating} onChange={setWaiterRating} />
              
              <div style={{ marginTop: '12px' }}>
                <label className="form-label" style={{ fontSize: '13px' }} htmlFor="waiter_name">Nombre del Mesero (Opcional)</label>
                <input 
                  type="text" 
                  id="waiter_name"
                  className="form-input" 
                  placeholder="Ej. Carlos o María" 
                  value={waiterName} 
                  onChange={(e) => setWaiterName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div className="rating-label">2. Atención del Gerente</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>¿El gerente se acercó a tu mesa a saludar y verificar que todo estuviera correcto?</p>
              <div className="switch-container">
                <button 
                  type="button" 
                  className={`switch-btn ${managerGreeted === true ? 'active' : ''}`}
                  onClick={() => setManagerGreeted(true)}
                >
                  Sí, se acercó
                </button>
                <button 
                  type="button" 
                  className={`switch-btn ${managerGreeted === false ? 'active' : ''}`}
                  onClick={() => setManagerGreeted(false)}
                >
                  No llegó
                </button>
              </div>

              {managerGreeted === true && (
                <div style={{ marginTop: '12px' }} className="animate-fade-in">
                  <label className="form-label" style={{ fontSize: '13px' }} htmlFor="manager_name">Nombre del Gerente (Opcional)</label>
                  <input 
                    type="text" 
                    id="manager_name"
                    className="form-input" 
                    placeholder="¿Recuerdas su nombre?" 
                    value={managerName} 
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div className="rating-label">3. Parqueo y Asistencia (1 - 5 Estrellas)</div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Facilidad de estacionamiento y apoyo del valet/asistente.</p>
              <StarRating value={parkingRating} onChange={setParkingRating} />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={prevStep} className="btn btn-outline" style={{ flex: 1 }}>Atrás</button>
              <button type="button" onClick={nextStep} className="btn btn-primary" style={{ flex: 2 }}>Continuar</button>
            </div>
          </div>
        )}

        {/* STEP 4: EVENTS COVERAGE */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Eventos Especiales</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>Califica las actividades del restaurante.</p>

            <div className="form-group">
              <label className="form-label">¿Asistió a algún evento durante su visita hoy?</label>
              <select 
                className="form-input" 
                value={eventType} 
                onChange={(e) => setEventType(e.target.value)}
                style={{ paddingRight: '40px' }}
              >
                <option value="none">Ningún evento / No había evento</option>
                <option value="karaoke">Noche de Karaoke</option>
                <option value="live_music">Música en Vivo</option>
                <option value="other">Otro evento especial</option>
              </select>
            </div>

            {/* Karaoke Specific ratings */}
            {eventType === 'karaoke' && (
              <div className="form-group animate-fade-in" style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px' }}>
                  <Music size={20} />
                  <h4 style={{ margin: 0, fontSize: '16px' }}>Calificación de Karaoke</h4>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div className="rating-label" style={{ fontSize: '14px' }}>A. Selección de canciones / Repertorio</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>¿Encontró las canciones que quería cantar?</p>
                  <StarRating value={eventSongRating} onChange={setEventSongRating} />
                </div>

                <div>
                  <div className="rating-label" style={{ fontSize: '14px' }}>B. Tiempos de espera</div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>¿Cuánto tardó en tocar su turno para cantar?</p>
                  <StarRating value={eventWaitRating} onChange={setEventWaitRating} />
                </div>
              </div>
            )}

            {/* Other Event ratings */}
            {eventType !== 'none' && eventType !== 'karaoke' && (
              <div className="form-group animate-fade-in" style={{ backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '12px' }}>
                  <Smile size={20} />
                  <h4 style={{ margin: 0, fontSize: '16px' }}>Calificación de Actividad</h4>
                </div>

                <div>
                  <div className="rating-label" style={{ fontSize: '14px' }}>¿Cómo califica la calidad y entretenimiento del evento?</div>
                  <StarRating value={eventGeneralRating} onChange={setEventGeneralRating} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={prevStep} className="btn btn-outline" style={{ flex: 1 }}>Atrás</button>
              <button type="button" onClick={nextStep} className="btn btn-primary" style={{ flex: 2 }}>Continuar</button>
            </div>
          </div>
        )}

        {/* STEP 5: NOTES & SUBMIT */}
        {step === 5 && (
          <form onSubmit={handleSubmit} className="animate-fade-in">
            <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Anotaciones Finales</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>Tus observaciones nos ayudan a ser mejores cada día.</p>

            <div className="form-group">
              <label className="form-label" htmlFor="comments">Comentarios o Sugerencias Adicionales</label>
              <textarea 
                id="comments"
                className="form-input" 
                placeholder="Por favor cuéntanos detalles que consideres importantes de tu visita..."
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              padding: '16px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '24px',
              fontSize: '13px',
              color: 'var(--text-muted)'
            }}>
              Al hacer clic en "Enviar Encuesta", tus datos de contacto serán guardados y registrados en nuestro programa de clientes frecuentes de <strong>Restaurant Plus</strong> para poder enviarte promociones y beneficios especiales.
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={prevStep} className="btn btn-outline" style={{ flex: 1 }} disabled={loading}>Atrás</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="spinner"></span> Procesando...
                  </span>
                ) : (
                  'Enviar Encuesta'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// ADMIN PANEL FRONTEND
// -------------------------------------------------------------
function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Dashboard state
  const [stats, setStats] = useState<KPIStats>({
    total_responses: 0,
    avg_food: 0,
    avg_atmosphere: 0,
    avg_waiter: 0,
    avg_quality: 0,
    avg_cost: 0,
    avg_parking: 0,
    manager_greeted_percentage: 0,
    avg_karaoke_song: 0,
    avg_karaoke_wait: 0,
    recent_comments: [],
    recent_responses: []
  });
  
  const [config, setConfig] = useState<AdminConfig>({
    loyalty_strategy: 'none',
    loyalty_discount_value: '',
    loyalty_points_value: '',
    manager_email: '',
    manager_phone: '',
    manager_notifications_enabled: 'false',
    admin_password: ''
  });

  const [activeTab, setActiveTab] = useState<'kpis' | 'config' | 'log' | 'qr'>('kpis');
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Attempt login using saved password if available
  useEffect(() => {
    const savedPassword = localStorage.getItem('admin_password');
    if (savedPassword) {
      performLogin(savedPassword);
    }
  }, []);

  const performLogin = async (pw: string) => {
    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': pw
        }
      });
      if (res.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('admin_password', pw);
        setPassword(pw);
        loadAdminData(pw);
      } else {
        setLoginError('Contraseña incorrecta.');
        localStorage.removeItem('admin_password');
      }
    } catch (err) {
      setLoginError('Error de red al intentar autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setLoginError('Ingrese la contraseña.');
      return;
    }
    performLogin(password);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_password');
    setIsAuthenticated(false);
    setPassword('');
  };

  const loadAdminData = async (pw: string) => {
    try {
      // Load KPIs
      const statsRes = await fetch('/api/admin/stats', {
        headers: { 'Authorization': pw }
      });
      if (statsRes.status === 401) {
        handleLogout();
        return;
      }
      const statsData = await statsRes.json();
      setStats(statsData as KPIStats);

      // Load config
      const configRes = await fetch('/api/admin/config', {
        headers: { 'Authorization': pw }
      });
      const configData = await configRes.json();
      setConfig(configData as AdminConfig);
    } catch (err) {
      console.error('Error loading admin dashboard details:', err);
    }
  };

  const triggerRefresh = () => {
    loadAdminData(password);
  };

  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingConfig(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': password
        },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSuccessMsg('Configuraciones guardadas con éxito.');
        // Refresh local data
        localStorage.setItem('admin_password', config.admin_password || password);
        setPassword(config.admin_password || password);
        triggerRefresh();
      } else {
        alert('Error al guardar la configuración.');
      }
    } catch (err) {
      alert('Error de conexión.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleSendReport = async () => {
    setSendingReport(true);
    setSuccessMsg('');
    try {
      const res = await fetch('/api/admin/report', {
        method: 'POST',
        headers: { 'Authorization': password }
      });
      if (res.ok) {
        setSuccessMsg('Reporte en PDF/HTML enviado con éxito al correo del gerente.');
      } else {
        const errorData = await res.json() as any;
        alert(errorData.error || 'Error al enviar el reporte.');
      }
    } catch (err) {
      alert('Error al enviar el reporte por correo.');
    } finally {
      setSendingReport(false);
    }
  };

  // Helper score color
  const getRatingBadge = (score: number, scaleMax: number) => {
    const percentage = score / scaleMax;
    if (percentage >= 0.85) return 'badge-success';
    if (percentage >= 0.70) return 'badge-warning';
    return 'badge-danger';
  };

  // Render Login Lock Screen
  if (!isAuthenticated) {
    return (
      <div className="container animate-fade-in" style={{ maxWidth: '420px', padding: '64px 16px' }}>
        <div className="card text-center">
          <div className="logo-icon" style={{ backgroundColor: 'var(--primary)', backgroundImage: 'none' }}>
            <Shield size={24} />
          </div>
          <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Acceso Administrativo</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
            Ingrese la clave de seguridad para visualizar estadísticas y configurar la estrategia de fidelización.
          </p>

          {loginError && (
            <div className="alert alert-danger" style={{ padding: '10px 12px', fontSize: '13px' }}>
              <AlertCircle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="admin_pw">Contraseña de Seguridad</label>
              <input 
                type="password" 
                id="admin_pw" 
                className="form-input" 
                placeholder="Clave de administrador" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner"></span> Autenticando...
                </span>
              ) : (
                'Desbloquear Panel'
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container container-admin animate-fade-in" style={{ padding: '24px 16px' }}>
      
      {/* Admin Title Info */}
      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, textAlign: 'left' }}>Dashboard Restaurant Plus</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'left' }}>
            Gestión de KPIs de satisfacción y estrategias de mercadeo.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={triggerRefresh} className="btn btn-outline" style={{ padding: '10px 16px', fontSize: '14px' }}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '10px 16px', fontSize: '14px', color: 'var(--error)' }}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success animate-fade-in">
          <CheckCircle size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'kpis' ? 'active' : ''}`} onClick={() => { setActiveTab('kpis'); setSuccessMsg(''); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={16} /> Métricas y KPIs</span>
        </button>
        <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => { setActiveTab('config'); setSuccessMsg(''); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Sliders size={16} /> Configuración</span>
        </button>
        <button className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`} onClick={() => { setActiveTab('log'); setSuccessMsg(''); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={16} /> Log de Encuestas</span>
        </button>
        <button className={`tab-btn ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => { setActiveTab('qr'); setSuccessMsg(''); }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Share2 size={16} /> Código QR</span>
        </button>
      </div>

      {/* TAB 1: METRICS & KPIS */}
      {activeTab === 'kpis' && (
        <div>
          {/* KPI Widget Cards */}
          <div className="admin-grid">
            <div className="kpi-card kpi-primary">
              <span className="kpi-title">Muestras Totales</span>
              <span className="kpi-value">{stats.total_responses}</span>
              <span className="kpi-footer">Encuestas respondidas</span>
            </div>
            
            <div className={`kpi-card ${stats.avg_food >= 8.5 ? 'kpi-success' : stats.avg_food >= 7.0 ? 'kpi-warning' : 'kpi-danger'}`}>
              <span className="kpi-title">Alimentos (1-10)</span>
              <span className="kpi-value">{stats.avg_food.toFixed(2)}</span>
              <span className="kpi-footer">Promedio sabor y cocción</span>
            </div>

            <div className={`kpi-card ${stats.avg_waiter >= 4.2 ? 'kpi-success' : stats.avg_waiter >= 3.5 ? 'kpi-warning' : 'kpi-danger'}`}>
              <span className="kpi-title">Meseros (1-5)</span>
              <span className="kpi-value">{stats.avg_waiter.toFixed(2)}</span>
              <span className="kpi-footer">Atención y cortesía</span>
            </div>

            <div className="kpi-card kpi-gold">
              <span className="kpi-title">Visita Gerente</span>
              <span className="kpi-value">{stats.manager_greeted_percentage.toFixed(1)}%</span>
              <span className="kpi-footer">Porcentaje que saludó</span>
            </div>

            <div className={`kpi-card ${stats.avg_parking >= 4.2 ? 'kpi-success' : stats.avg_parking >= 3.5 ? 'kpi-warning' : 'kpi-danger'}`}>
              <span className="kpi-title">Parqueo (1-5)</span>
              <span className="kpi-value">{stats.avg_parking.toFixed(2)}</span>
              <span className="kpi-footer">Asistencia y comodidad</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Detailed Average Ratings */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={20} className="text-gold" /> Desglose de Calificaciones
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span>Calidad de los Productos (1-10)</span>
                    <span style={{ fontWeight: 'bold' }}>{stats.avg_quality.toFixed(2)}/10</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.avg_quality * 10}%`, height: '100%', backgroundColor: stats.avg_quality >= 8.5 ? 'var(--success)' : stats.avg_quality >= 7 ? 'var(--warning)' : 'var(--error)' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span>Costo / Beneficio (1-10)</span>
                    <span style={{ fontWeight: 'bold' }}>{stats.avg_cost.toFixed(2)}/10</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.avg_cost * 10}%`, height: '100%', backgroundColor: stats.avg_cost >= 8.5 ? 'var(--success)' : stats.avg_cost >= 7 ? 'var(--warning)' : 'var(--error)' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span>Ambiente del Local (1-10)</span>
                    <span style={{ fontWeight: 'bold' }}>{stats.avg_atmosphere.toFixed(2)}/10</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.avg_atmosphere * 10}%`, height: '100%', backgroundColor: stats.avg_atmosphere >= 8.5 ? 'var(--success)' : stats.avg_atmosphere >= 7 ? 'var(--warning)' : 'var(--error)' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span>Karaoke: Repertorio (1-5)</span>
                    <span style={{ fontWeight: 'bold' }}>{stats.avg_karaoke_song.toFixed(2)}/5</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.avg_karaoke_song * 20}%`, height: '100%', backgroundColor: stats.avg_karaoke_song >= 4.2 ? 'var(--success)' : stats.avg_karaoke_song >= 3.5 ? 'var(--warning)' : 'var(--error)' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
                    <span>Karaoke: Tiempo de Espera (1-5)</span>
                    <span style={{ fontWeight: 'bold' }}>{stats.avg_karaoke_wait.toFixed(2)}/5</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${stats.avg_karaoke_wait * 20}%`, height: '100%', backgroundColor: stats.avg_karaoke_wait >= 4.2 ? 'var(--success)' : stats.avg_karaoke_wait >= 3.5 ? 'var(--warning)' : 'var(--error)' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Comments */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={20} className="text-gold" /> Comentarios Recientes
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {stats.recent_comments.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
                    Aún no hay comentarios disponibles.
                  </p>
                ) : (
                  stats.recent_comments.map((comment, index) => (
                    <div key={index} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <strong>{comment.customer_name}</strong>
                        <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="comment-bubble">"{comment.comments}"</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ padding: '24px', marginTop: '24px', textAlign: 'left' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '12px' }}>Acciones Rápidas</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px' }}>
              Puedes enviar un reporte de KPI consolidado de forma manual al correo electrónico del encargado configurado.
            </p>
            <button 
              onClick={handleSendReport} 
              className="btn btn-primary"
              disabled={sendingReport}
            >
              {sendingReport ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner"></span> Enviando Reporte...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={18} /> Enviar Reporte de KPIs al Encargado</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CONFIGURATION */}
      {activeTab === 'config' && (
        <form onSubmit={handleUpdateConfig} className="card" style={{ textAlign: 'left' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}><Settings size={20} className="text-gold" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> Ajustes de Negocio y Notificaciones</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Configura las estrategias de fidelización de Restaurant Plus, alertas y accesos.
          </p>

          <h4 style={{ fontSize: '16px', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '16px' }}>Estrategia de Fidelización</h4>
          
          <div className="form-group">
            <label className="form-label">Estrategia Activa</label>
            <select 
              className="form-input" 
              value={config.loyalty_strategy}
              onChange={(e) => setConfig({ ...config, loyalty_strategy: e.target.value as any })}
            >
              <option value="none">Desactivado (No dar regalos por encuesta)</option>
              <option value="discount">Dar Descuentos sobre Consumo</option>
              <option value="points">Regalar Puntos de Lealtad</option>
            </select>
          </div>

          {config.loyalty_strategy === 'discount' && (
            <div className="form-group animate-fade-in">
              <label className="form-label" htmlFor="disc_val">Detalle del Descuento</label>
              <input 
                type="text" 
                id="disc_val" 
                className="form-input" 
                placeholder="Ej. 10% de descuento en tu consumo final" 
                value={config.loyalty_discount_value}
                onChange={(e) => setConfig({ ...config, loyalty_discount_value: e.target.value })}
                required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Este texto se le mostrará al cliente y se le enviará en su correo de confirmación.
              </p>
            </div>
          )}

          {config.loyalty_strategy === 'points' && (
            <div className="form-group animate-fade-in">
              <label className="form-label" htmlFor="points_val">Cantidad de Puntos a Regalar</label>
              <input 
                type="text" 
                id="points_val" 
                className="form-input" 
                placeholder="Ej. 100 puntos Club Plus" 
                value={config.loyalty_points_value}
                onChange={(e) => setConfig({ ...config, loyalty_points_value: e.target.value })}
                required
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                El número de puntos otorgados que se registrarán asociados al teléfono del cliente.
              </p>
            </div>
          )}

          <h4 style={{ fontSize: '16px', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '16px', marginTop: '32px' }}>Alertas y Reportes (Responsable del Área)</h4>

          <div className="form-group">
            <label className="form-label" htmlFor="mgr_email">Correo Electrónico del Encargado</label>
            <input 
              type="email" 
              id="mgr_email" 
              className="form-input" 
              placeholder="responsable@restaurantplus.com" 
              value={config.manager_email}
              onChange={(e) => setConfig({ ...config, manager_email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="mgr_phone">Teléfono / SMS del Encargado</label>
            <input 
              type="tel" 
              id="mgr_phone" 
              className="form-input" 
              placeholder="+50255898822" 
              value={config.manager_phone}
              onChange={(e) => setConfig({ ...config, manager_phone: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Alertas Automáticas al Encargado</label>
            <select 
              className="form-input" 
              value={config.manager_notifications_enabled}
              onChange={(e) => setConfig({ ...config, manager_notifications_enabled: e.target.value })}
            >
              <option value="true">Activo (Enviar correo/alerta por cada encuesta o bajas notas)</option>
              <option value="false">Desactivado (Solo enviar reportes manuales)</option>
            </select>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Si se activa, el sistema enviará alertas en tiempo real al correo del encargado cuando un cliente califique bajo (Alimentos &lt; 7 o Mesero &lt; 3).
            </p>
          </div>

          <h4 style={{ fontSize: '16px', color: 'var(--primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '16px', marginTop: '32px' }}>Seguridad del Panel</h4>

          <div className="form-group">
            <label className="form-label" htmlFor="adm_pw">Cambiar Contraseña de Administrador</label>
            <input 
              type="text" 
              id="adm_pw" 
              className="form-input" 
              placeholder="Nueva clave" 
              value={config.admin_password}
              onChange={(e) => setConfig({ ...config, admin_password: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }} disabled={updatingConfig}>
            {updatingConfig ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner"></span> Guardando Ajustes...
              </span>
            ) : (
              'Guardar Configuraciones'
            )}
          </button>
        </form>
      )}

      {/* TAB 3: RESPONSES LOG */}
      {activeTab === 'log' && (
        <div className="card" style={{ padding: '24px', textAlign: 'left' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}><FileText size={20} className="text-gold" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} /> Registro de Encuestas Recibidas</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            Visualiza y da seguimiento a los datos recopilados e ingresados por los comensales.
          </p>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Alimentos</th>
                  <th>Mesero / Servicio</th>
                  <th>Gerente</th>
                  <th>Fidelización</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_responses.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No se han registrado encuestas todavía.
                    </td>
                  </tr>
                ) : (
                  stats.recent_responses.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div style={{ fontWeight: 'bold' }}>{row.customer_name}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}><Mail size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />{row.customer_email}</div>
                        <div style={{ fontSize: '12px', marginTop: '2px' }}><Phone size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />{row.customer_phone}</div>
                      </td>
                      <td>
                        <span className={`badge ${getRatingBadge(row.food_rating, 10)}`}>
                          Nota: {row.food_rating}/10
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className={`badge ${getRatingBadge(row.waiter_rating, 5)}`}>
                            {row.waiter_rating} ★
                          </span>
                        </div>
                        {row.waiter_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Mesero: {row.waiter_name}</div>}
                      </td>
                      <td>
                        {row.manager_greeted === 1 ? (
                          <div>
                            <span className="badge badge-success">Sí saludó</span>
                            {row.manager_name && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{row.manager_name}</div>}
                          </div>
                        ) : (
                          <span className="badge badge-danger">No saludó</span>
                        )}
                      </td>
                      <td>
                        {row.reward_sent !== 'none' ? (
                          <div>
                            <span className="badge badge-primary">{row.reward_sent === 'discount' ? 'Descuento' : 'Puntos'}</span>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {row.reward_details}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Ninguno</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {new Date(row.created_at).toLocaleDateString()}<br/>
                          {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: QR CODE CONFIG */}
      {activeTab === 'qr' && (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px', textAlign: 'left' }}>Código QR para Encuesta</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', textAlign: 'left' }}>
            Imprime y coloca este código QR en las mesas, portafolios de cuentas o menú de Restaurant Plus. Al leer el código, los comensales serán redirigidos a esta página web.
          </p>

          <div style={{
            maxWidth: '400px', 
            margin: '0 auto',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h4 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)', marginBottom: '4px', fontSize: '20px' }}>Restaurant Plus</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>¡Tu opinión nos ayuda a crecer!</p>
            
            <div style={{
              backgroundColor: 'white',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '16px'
            }}>
              <QRCodeSVG 
                value={window.location.origin} 
                size={220}
                bgColor={"#ffffff"}
                fgColor={"#8b1e3f"}
                level={"H"}
                includeMargin={true}
              />
            </div>

            <p style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-main)', wordBreak: 'break-all', marginBottom: '20px' }}>
              Enlace: <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{window.location.origin}</a>
            </p>

            <button 
              onClick={() => {
                const svg = document.querySelector('.card svg');
                if (svg) {
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const canvas = document.createElement("canvas");
                  const ctx = canvas.getContext("2d");
                  const img = new Image();
                  img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx?.drawImage(img, 0, 0);
                    const pngFile = canvas.toDataURL("image/png");
                    const downloadLink = document.createElement("a");
                    downloadLink.download = "QR_RestaurantPlus.png";
                    downloadLink.href = pngFile;
                    downloadLink.click();
                  };
                  img.src = "data:image/svg+xml;base64," + btoa(svgData);
                }
              }} 
              className="btn btn-primary btn-block"
            >
              <Download size={18} /> Descargar Imagen QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
