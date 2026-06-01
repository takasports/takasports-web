# Cron unificado del Índice Taka

Workflow n8n recomendado para mantener vivo el ecosistema completo.
Todos los endpoints aceptan `Authorization: Bearer $CRON_SECRET` o
`?secret=$CRON_SECRET` para pruebas manuales.

## WF — Lunes 10:00 — Cadena post-ingest

Tras el cron de ingest (WF-11 domingo 22:00 + WF-12 domingo 23:15), el lunes
recalculamos todo lo que depende del histórico nuevo. Encadénalos en n8n
con nodos HTTP Request en serie. Si uno falla, log + Telegram pero continúa.

| Orden | Hora | Endpoint | Descripción |
|-------|------|----------|-------------|
| 1 | 10:00 | `GET /api/cron/snapshot-history` | Graba snapshot en `ranking_score_history`. Cron domingo ya escribió score actual; lunes lo cristalizamos. |
| 2 | 10:05 | `GET /api/cron/recompute-badges` | `f_recompute_badges()` — streak_top10, mover_month, debut_top50 desde el histórico. |
| 3 | 10:10 | `GET /api/cron/favorites-push` | Envía push a usuarios cuyo favorito se movió ≥1.5 puntos esta semana. |
| 4 | 10:15 | `GET /api/cron/resolve-predictions` | Marca aciertos/fallos de las predicciones de la semana que cierra. |

## WF — 1er día del mes 06:00

| Hora | Endpoint | Descripción |
|------|----------|-------------|
| 06:00 | `GET /api/cron/award-achievements` | `f_award_monthly_achievements()` — MVP del mes y mayor escalador del mes (1 por categoría). |

## Sanity

Tras correr la cadena del lunes 10:00, valida en Supabase SQL:

```sql
-- Histórico nuevo
SELECT MAX(captured_at) FROM ranking_score_history;

-- Badges activos
SELECT code, COUNT(*) FROM entry_badges GROUP BY 1;

-- Predicciones resueltas esta semana
SELECT COUNT(*) FILTER (WHERE is_correct IS NOT NULL) AS resueltas,
       COUNT(*) FILTER (WHERE is_correct IS NULL) AS pendientes
FROM index_predictions
WHERE week_start = date_trunc('week', now())::date;
```

## Endpoints adicionales (manuales / on-demand)

| Endpoint | Cuándo |
|----------|--------|
| `GET /api/rankings/weekly-recap?format=html` | Genera HTML de movers para newsletter (no se envía automático). |
| `GET /api/rankings/weekly-recap` | Mismo data en JSON, para integraciones externas. |

## Fallback / re-runs

Si un cron del lunes 10:00 falla, no es crítico — son idempotentes:
- snapshot-history: `ON CONFLICT DO UPDATE` — se puede re-correr.
- recompute-badges: TRUNCATE + INSERT — idempotente.
- favorites-push: solo envía 1 push por usuario por semana (por dedup natural).
- resolve-predictions: solo afecta `is_correct IS NULL` — idempotente.

Si necesitas re-ejecutar manualmente:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://takasportsmedia.com/api/cron/snapshot-history
```
