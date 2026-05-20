-- ─────────────────────────────────────────────────────────────────
-- 027 — ranking_view: exponer columna handles (redes sociales)
--
-- Añade e.handles al SELECT de ranking_view para que la web pueda
-- mostrar iconos de Instagram / TikTok / YouTube / Twitter / Twitch
-- en las cards de creadores y periodistas.
--
-- CÓMO APLICAR:
--   Supabase Dashboard → SQL Editor → pegar y ejecutar.
-- ─────────────────────────────────────────────────────────────────

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
  e.handles,

  -- ── Factores como JSONB (COALESCE manual → auto) ───────────────
  jsonb_build_object(
    'rendimiento', COALESCE(e.rendimiento_manual, e.rendimiento_auto),
    'contexto',    COALESCE(e.contexto_manual,    e.contexto_auto),
    'mediatico',   COALESCE(e.mediatico_manual,   e.mediatico_auto),
    'narrativa',   COALESCE(e.narrativa_manual,   e.narrativa_auto)
  )                                                                   AS factors,

  -- ── Score / rank global (COALESCE manual → auto) ───────────────
  COALESCE(e.score_manual, e.score_auto)                             AS score,

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

  -- ── Score/rank dentro del mismo deporte ────────────────────────
  e.score_sport_auto                                                 AS score_sport,

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

  -- ── Score/rank histórico ────────────────────────────────────────
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

GRANT SELECT ON public.ranking_view TO anon, authenticated;

COMMENT ON VIEW public.ranking_view IS
  'Vista principal del Índice Taka. Incluye handles (redes sociales) para
mostrar iconos en cards de creadores/periodistas. Solo entradas active=true.';
