import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Logo } from '../componentes'
import { dinero, enlaceWhatsApp, fechaLarga, libres, useAjustes, type Salida } from '../datos'
import { db } from '../firebase'
import { ICONOS } from '../iconos'
import { T } from '../textos'

// Página pública con todas las salidas publicadas: para Facebook, Instagram o WhatsApp.
export default function Catalogo() {
  const ajustes = useAjustes()
  const [salidas, setSalidas] = useState<Salida[] | null>(null)

  useEffect(() => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    // Las reglas solo dejan listar las publicadas: la consulta tiene que pedir publica == true.
    getDocs(query(collection(db, 'salidas'), where('publica', '==', true), where('fecha', '>=', Timestamp.fromDate(hoy))))
      .then((s) => setSalidas(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Salida)
        .filter((x) => x.estado === 'abierta').sort((a, b) => a.fecha.toMillis() - b.fecha.toMillis())))
      .catch((e) => { console.error(e); setSalidas([]) })
  }, [])

  return (
    <div className="app publico">
      <header className="marca"><Logo /><div><h2>{ajustes.nombre}</h2><small className="suave">{T.proximas}</small></div></header>
      {salidas === null && <p className="suave">Cargando…</p>}
      {salidas?.length === 0 && <div className="panel vacio">Por ahora no hay {T.salidas} abiertas. Escríbenos y te avisamos de las próximas.</div>}
      <div className="rejilla">
        {salidas?.map((s) => (
          <a key={s.id} className="tarjeta" href={`/s/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            {s.tour.miniatura ? <img src={s.tour.miniatura} alt="" /> : <span className="sin-foto">{ICONOS.tours}</span>}
            <b>{s.tour.nombre}</b>
            <small>{fechaLarga(s.fecha.toDate())}</small>
            <small>{dinero(s.precioAdulto, ajustes.moneda)} por persona</small>
            <span className={`pill ${libres(s) === 0 ? 'p-rosa' : libres(s) <= 5 ? 'p-amarillo' : 'p-verde'}`}>{libres(s) === 0 ? 'Lleno' : `${libres(s)} lugares`}</span>
          </a>
        ))}
      </div>
      {ajustes.telefono && <a className="btn btn-whatsapp" href={enlaceWhatsApp(ajustes.telefono, `Hola, quisiera información de sus ${T.servicios}.`)} target="_blank" rel="noreferrer">{ICONOS.whatsapp}Escríbenos</a>}
    </div>
  )
}
