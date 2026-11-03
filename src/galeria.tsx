import { doc, getDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { Foto } from './datos'
import { db } from './firebase'
import { ICONOS } from './iconos'

// Fotos grandes: se cargan solo cuando se muestran.
export function useFotos(ids: string[] = []) {
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const clave = ids.join(',')
  useEffect(() => {
    let vivo = true
    for (const id of ids) {
      getDoc(doc(db, 'fotos', id)).then((s) => { if (vivo && s.exists()) setFotos((f) => ({ ...f, [id]: (s.data() as Foto).datos })) }).catch(() => {})
    }
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])
  return fotos
}

export function Galeria({ ids, miniatura }: { ids?: string[]; miniatura?: string }) {
  const fotos = useFotos(ids)
  const [i, setI] = useState(0)
  const actual = ids?.[i]
  const src = (actual && fotos[actual]) || (i === 0 ? miniatura : undefined)
  return (
    <div className="galeria">
      {src ? <img className="foto-grande" src={src} alt="" /> : <div className="foto-grande sin-foto">{ICONOS.camara}</div>}
      {(ids?.length ?? 0) > 1 && (
        <div className="fila">
          {ids!.map((id, j) => <button key={id} className={`punto-foto ${j === i ? 'activo' : ''}`} aria-label={`Foto ${j + 1}`} onClick={() => setI(j)} />)}
        </div>
      )}
    </div>
  )
}
