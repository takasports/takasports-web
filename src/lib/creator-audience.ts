// ── Desglose de audiencia de un creador ───────────────────────────
//
// Dice de dónde sale su cifra de seguidores plataforma por plataforma, y
// —esto es lo importante— cuáles están MEDIDAS y cuáles son estimaciones que
// alguien escribió a mano y nadie ha vuelto a comprobar.
//
// La distinción no es cosmética: una cifra sembrada puede estar equivocada por
// órdenes de magnitud sin que nada lo delate. Impacto MMA encabezó el ranking
// entero con 22.800.000 suscriptores de YouTube cuando tiene 252.000, y ese
// número llevaba meses ahí. El criterio para llamarla medida es que la ficha
// tenga anclado el perfil de esa red: si sabemos a qué cuenta corresponde, un
// script la vuelve a leer cada semana; si no, nadie puede comprobarla nunca.
//
// Los datos vienen de `creator_audience_view` (migración 120), que existe
// justamente porque `creator_raw_metrics` tiene RLS sin políticas y no es
// legible con clave pública. La vista expone solo cifras que ya se pintan en la
// ficha, y la comparten web y app: así los dos dicen lo mismo sin duplicar la
// lógica de qué cuenta como medido.

import { getReadClient, supabaseConfigured } from '@/lib/rankings-data'

export interface PlataformaAudiencia {
  red: 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'twitch'
  label: string
  seguidores: number
  /** Hay perfil anclado → un script la relee cada semana. */
  medida: boolean
}

const ETIQUETA: Record<string, string> = {
  youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', twitch: 'Twitch', twitter: 'X',
}

export async function getCreatorAudience(id: string): Promise<PlataformaAudiencia[] | null> {
  if (!supabaseConfigured()) return null
  try {
    const sb = getReadClient()
    const { data, error } = await sb
      .from('creator_audience_view')
      .select('red, seguidores, medida')
      .eq('creator_id', id)
      .order('seguidores', { ascending: false })
    if (error || !data?.length) return null
    return data.map(r => ({
      red: r.red as PlataformaAudiencia['red'],
      label: ETIQUETA[r.red] ?? r.red,
      seguidores: Number(r.seguidores),
      medida: Boolean(r.medida),
    }))
  } catch {
    return null
  }
}
