import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './estilos.css'
import App from './App'
import Catalogo from './publico/Catalogo'
import Reservar from './publico/Reservar'
import MiReserva from './publico/MiReserva'
import { cliente } from './cliente'
import { guardarInvitacionDeLaUrl } from './sesion'

// Colores de esta tienda (desde src/cliente.json).
const raiz = document.documentElement.style
raiz.setProperty('--principal', cliente.colorPrincipal)
raiz.setProperty('--acento', cliente.colorAcento)
raiz.setProperty('--fondo', cliente.colorFondo)

// Enlaces para clientes (sin entrar con Google): /salidas (todas las publicadas), /s/ID (reservar una) y /r/CODIGO (su reserva).
const [, tipo, codigo] = location.pathname.split('/')
const pagina = tipo === 'salidas' ? <Catalogo />
  : tipo === 's' && codigo ? <Reservar salidaId={codigo} />
  : tipo === 'r' && codigo ? <MiReserva codigo={codigo} />
  : <App />
if (pagina.type === App) guardarInvitacionDeLaUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pagina}
  </StrictMode>,
)
