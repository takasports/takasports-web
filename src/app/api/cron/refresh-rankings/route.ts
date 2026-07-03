// Cron horario — refresca la foto materializada `ranking_view`.
//
// ranking_view dejó de ser una vista (se recalculaba ~375ms en cada lectura,
// ~65% del tiempo de la BD) y pasó a ser una MATERIALIZED VIEW: las lecturas
// son ahora un index lookup sub-ms, pero hay que rehacer la "foto" cuando los
// datos cambian. Este cron la refresca cada hora, lo que cubre por igual la
// ingesta semanal, las ediciones del admin y los ~12 scripts de mantenimiento
// que escriben directo en ranking_entries (ingest/override además refrescan al
// instante). El REFRESH lo hace la función refresh_ranking_view() (service_role).
//
// Auth: solo Bearer CRON_SECRET o header x-cron-secret.

import { NextRequest, NextResponse } from 'next/server'
import { adminSupabase } from '@/lib/supabase-admin'
import { checkBearerOrHeader } from '@/lib/auth-utils'
import { apiError } from '@/lib/api-utils'
import { sendTelegram } from '@/lib/telegram'

export async function GET(req: NextRequest) {
  if (!checkBearerOrHeader(req, 'x-cron-secret', process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const sb = adminSupabase()
  if (!sb) return NextResponse.json({ error: 'Supabase admin no configurado' }, { status: 503 })

  const { error } = await sb.rpc('refresh_ranking_view')
  if (error) {
    // Alarma de frescura: si el REFRESH horario falla, ranking_view se queda con
    // la última foto buena SIN que nadie se entere (el dato base puede estar
    // fresco, así que data-freshness no lo detecta). Avisamos por Telegram
    // (canal privado) además de loguear; la respuesta al cliente sigue genérica.
    try {
      await sendTelegram(
        '⚠️ <b>TakaSports — refresh rankings FALLÓ</b>\n\n' +
        'El refresh horario de <code>ranking_view</code> devolvió error. ' +
        'Los rankings se quedan con la última foto buena hasta el próximo intento. ' +
        'Revisa <code>refresh_ranking_view()</code> / la BD.',
      )
    } catch { /* no romper el cron por un fallo de Telegram */ }
    return apiError('server_error', 500)
  }

  return NextResponse.json({ ok: true, refreshed: 'ranking_view', at: new Date().toISOString() })
}
