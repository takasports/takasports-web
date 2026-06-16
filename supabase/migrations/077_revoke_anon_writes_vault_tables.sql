-- 077 — Defensa en profundidad: quitar permisos de anon/authenticated en las
-- 18 tablas internas "caja fuerte" (RLS activo SIN politica = ya inaccesibles
-- para esos roles; solo escribe el service_role, que ignora grants y RLS).
--
-- Por defecto Supabase concede INSERT/UPDATE/DELETE a anon y authenticated en
-- todas las tablas; hoy el RLS-sin-politica las bloquea, pero el grant queda
-- LATENTE: si alguien anadiera una politica permisiva o desactivara RLS por
-- error, pasarian a escribibles desde la API publica (incl. app_secrets y
-- system_config). REVOKE ALL cierra ese riesgo sin afectar a nada que funcione
-- hoy (los flujos que escriben en newsletter_subscribers / rate_limits /
-- match_reminders usan el cliente service-role). Idempotente.

revoke all on
  public.app_secrets,
  public.content_items,
  public.content_sources,
  public.creator_raw_metrics,
  public.decision_log,
  public.entity_images,
  public.feedback_log,
  public.image_feedback_handles,
  public.learning_signals,
  public.match_reminders,
  public.newsletter_subscribers,
  public.quiniela_odds_cache,
  public.ranking_ingest_runs,
  public.rate_limits,
  public.route_jobs,
  public.scoring_config,
  public.system_config,
  public.template_registry
from anon, authenticated;
