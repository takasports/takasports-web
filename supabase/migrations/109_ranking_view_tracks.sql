-- Fase 1 rediseño rankings: colapso 12 categorías -> 3 tracks (deportista/equipo/creador).
-- ADITIVA: recrea ranking_view añadiendo `track` y `age_group`, conservando idénticas las 32 columnas
-- existentes (la app nativa lee esta vista directo con supabase-js -> no romper).
-- Rollback: recrear la vista sin las 2 columnas nuevas (definición previa en git anterior a esta).

ALTER TABLE ranking_entries ADD COLUMN IF NOT EXISTS age_group text;

DROP MATERIALIZED VIEW IF EXISTS ranking_view;

CREATE MATERIALIZED VIEW ranking_view AS
 SELECT id,
    category,
    name,
    subtitle,
    sport,
    emoji,
    image_url,
    country,
    league,
    "position",
    region,
    gender,
    COALESCE(badge_manual, badge) AS badge,
    featured,
    handles,
    jsonb_build_object(
      'rendimiento', COALESCE(rendimiento_manual, rendimiento_auto),
      'contexto', COALESCE(contexto_manual, contexto_auto),
      'mediatico', COALESCE(mediatico_manual, mediatico_auto),
      'narrativa', COALESCE(narrativa_manual, narrativa_auto)
    ) AS factors,
    COALESCE(score_manual, score_auto) AS score,
    rank() OVER (PARTITION BY category ORDER BY (COALESCE(score_manual, score_auto)) DESC NULLS LAST, (COALESCE(mediatico_manual, mediatico_auto, 50::numeric)) DESC NULLS LAST)::integer AS rank,
    COALESCE(trend_manual, trend_auto, 'flat'::text) AS trend,
    COALESCE(insight_manual, insight_auto) AS insight,
    COALESCE(trend_reason_manual, trend_reason_auto) AS trend_reason,
    score_sport_auto AS score_sport,
    CASE
        WHEN score_sport_auto IS NOT NULL THEN rank() OVER (PARTITION BY sport ORDER BY score_sport_auto DESC NULLS LAST, (COALESCE(mediatico_manual, mediatico_auto, 50::numeric)) DESC NULLS LAST)::integer
        ELSE NULL::integer
    END AS rank_sport,
    COALESCE(editorial_boost, 0::numeric)::numeric(4,2) AS editorial_boost,
    editorial_note,
    editorial_locked,
    score_prev,
    rank_prev,
    (score_manual IS NOT NULL OR rank_manual IS NOT NULL OR insight_manual IS NOT NULL OR trend_manual IS NOT NULL OR rendimiento_manual IS NOT NULL OR contexto_manual IS NOT NULL OR mediatico_manual IS NOT NULL OR narrativa_manual IS NOT NULL OR editorial_boost IS NOT NULL OR badge_manual IS NOT NULL) AS has_override,
    last_auto_update,
    last_manual_update,
    updated_at,
    delta_week,
    CASE
        WHEN category IN ('creadores', 'periodistas', 'creadores_wwe') THEN 'creador'
        WHEN category IN ('clubes', 'clubes_femenino') THEN 'equipo'
        ELSE 'deportista'
    END AS track,
    age_group
   FROM ranking_entries e
  WHERE active = true;

CREATE UNIQUE INDEX ranking_view_id_category_uidx ON ranking_view USING btree (id, category);
CREATE INDEX ranking_view_category_rank_idx ON ranking_view USING btree (category, rank);

GRANT ALL ON ranking_view TO anon, authenticated, service_role;
