-- 079 — Higiene de índices: índice de cobertura para 9 claves foráneas sin
-- índice (acelera JOINs y los borrados en cascada) + quitar 1 índice duplicado
-- en push_subscriptions. NO se tocan los índices "sin usar" (pueden serlo solo
-- por falta de tráfico). Idempotente. Aplicada en Supabase vía MCP 2026-06-16.
create index if not exists idx_article_comment_reports_reporter on public.article_comment_reports (reporter_id);
create index if not exists idx_content_items_source on public.content_items (source_id);
create index if not exists idx_image_history_content_item on public.image_history (content_item_id);
create index if not exists idx_quiniela_league_chat_user on public.quiniela_league_chat (user_id);
create index if not exists idx_quiniela_season_predictions_question on public.quiniela_season_predictions (question_id);
create index if not exists idx_ranked_league_members_user on public.ranked_league_members (user_id);
create index if not exists idx_ranked_leagues_owner on public.ranked_leagues (owner_id);
create index if not exists idx_user_cosmetic_unlocks_cosmetic on public.user_cosmetic_unlocks (cosmetic_id);
create index if not exists idx_weekly_votes_user on public.weekly_votes (user_id);

-- duplicado: push_subscriptions tenía 2 índices idénticos sobre user_id
drop index if exists public.push_subs_user;
