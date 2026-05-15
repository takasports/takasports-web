-- ─────────────────────────────────────────────────────────────────
-- 021 — ranking_view: añade tiebreaker en RANK() / DENSE_RANK()
--
-- Problema: entradas con el mismo score (e.g. score_auto = 72.0) reciben
-- rank arbitrario según el orden interno de Postgres. Con 13 000+ entradas
-- los empates son frecuentes y producen rankings inestables entre ingestos.
--
-- Solución: añadir como segundo criterio de ordenación en las funciones
-- de ventana RANK() y DENSE_RANK() la dimensión mediática:
--   COALESCE(mediatico_manual, mediatico_auto, 50) DESC NULLS LAST
-- Así, ante igual score global, el deportista con mayor proyección
-- mediática queda por delante — criterio coherente con la fórmula v8
-- donde mediático pondera un 25 %.
--
-- NOTA: La definición exacta del DDL de ranking_view no estaba almacenada
-- en los archivos de migración locales (fue creada directamente en el
-- Supabase SQL Editor antes de que existiera este sistema de migraciones).
-- Esta migración reconstruye la vista fielmente a partir de:
--   · Los columns confirmados vía PostgREST (GET /rest/v1/ranking_view)
--   · Las columnas de ranking_entries verificadas vía OpenAPI
--   · Migration 020 (f_recompute_score_auto) — fórmula de score
--
-- CÓMO APLICAR:
--   Supabase Dashboard → SQL Editor → pegar y ejecutar.
-- ─────────────────────────────────────────────────────────────────

-- CREATE OR REPLACE no permite cambiar tipos de columna; usar DROP + CREATE.
DROP VIEW IF EXISTS public.ranking_view;
CREATE VIEW public.ranking_view AS
SELECT
  -- ── Identidad ──────────────────────────────────────────────────
  e.id,
  e.category,
  e.name,
  e.subtitle,
  e.sport,
  e.emoji,
  e.image_url,
  e.country,
  e.league,
  e.position,
  e.region,
  e.gender,
  COALESCE(e.badge_manual, e.badge)                                  AS badge,
  e.featured,

  -- ── Factores como JSONB (COALESCE manual → auto) ───────────────
  jsonb_build_object(
    'rendimiento', COALESCE(e.rendimiento_manual, e.rendimiento_auto),
    'contexto',    COALESCE(e.contexto_manual,    e.contexto_auto),
    'mediatico',   COALESCE(e.mediatico_manual,   e.mediatico_auto),
    'narrativa',   COALESCE(e.narrativa_manual,   e.narrativa_auto)
  )                                                                   AS factors,

  -- ── Score / rank global (COALESCE manual → auto) ───────────────
  COALESCE(e.score_manual, e.score_auto)                             AS score,

  -- RANK con tiebreaker en dimensión mediática
  RANK() OVER (
    PARTITION BY e.category
    ORDER BY
      COALESCE(e.score_manual, e.score_auto)              DESC NULLS LAST,
      COALESCE(e.mediatico_manual, e.mediatico_auto, 50)  DESC NULLS LAST
  )::integer                                                         AS rank,

  -- ── Trend / insight ────────────────────────────────────────────
  COALESCE(e.trend_manual, e.trend_auto, 'flat')                    AS trend,
  COALESCE(e.insight_manual, e.insight_auto)                        AS insight,
  COALESCE(e.trend_reason_manual, e.trend_reason_auto)              AS trend_reason,

  -- ── Score/rank dentro del mismo deporte (cross-category) ───────
  e.score_sport_auto                                                 AS score_sport,

  -- RANK dentro del deporte (también con tiebreaker mediático)
  CASE
    WHEN e.score_sport_auto IS NOT NULL THEN
      RANK() OVER (
        PARTITION BY e.sport
        ORDER BY
          e.score_sport_auto                                DESC NULLS LAST,
          COALESCE(e.mediatico_manual, e.mediatico_auto, 50) DESC NULLS LAST
      )::integer
    ELSE NULL
  END                                                                AS rank_sport,

  -- ── Metadatos editoriales ───────────────────────────────────────
  COALESCE(e.editorial_boost, 0)::numeric(4,2)                      AS editorial_boost,
  e.editorial_note,
  e.editorial_locked,

  -- ── Score/rank histórico (para trends y chart) ─────────────────
  e.score_prev,
  e.rank_prev,

  -- ── Flags de estado ────────────────────────────────────────────
  (
    e.score_manual       IS NOT NULL OR
    e.rank_manual        IS NOT NULL OR
    e.insight_manual     IS NOT NULL OR
    e.trend_manual       IS NOT NULL OR
    e.rendimiento_manual IS NOT NULL OR
    e.contexto_manual    IS NOT NULL OR
    e.mediatico_manual   IS NOT NULL OR
    e.narrativa_manual   IS NOT NULL OR
    e.editorial_boost    IS NOT NULL OR
    e.badge_manual       IS NOT NULL
  )                                                                   AS has_override,

  -- ── Timestamps ─────────────────────────────────────────────────
  e.last_auto_update,
  e.last_manual_update,
  e.updated_at

FROM public.ranking_entries e
WHERE e.active = true;

-- ── RLS heredada del owner (vistas no tienen RLS propia en Postgres) ──
-- La vista hereda los permisos de ranking_entries.
-- Para lectura pública (anon key) se necesita grant SELECT:
GRANT SELECT ON public.ranking_view TO anon, authenticated;

-- Comentario descriptivo
COMMENT ON VIEW public.ranking_view IS
  'Vista principal del Índice Taka. Aplica COALESCE(manual, auto) en todos
los campos editables. RANK() y RANK() dentro del deporte usan como tiebreaker
COALESCE(mediatico_manual, mediatico_auto, 50) DESC para resolver empates de
score de forma determinista y coherente con la fórmula v8 (mediático = 25%).
Solo incluye entradas con active = true.';
