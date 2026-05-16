-- ─────────────────────────────────────────────────────────────────
-- 024 — Moderación de chat de ligas
-- Permite que el owner de la liga borre cualquier mensaje. El autor
-- ya podía borrar los suyos (policy en 019).
-- ─────────────────────────────────────────────────────────────────

drop policy if exists "league owner can delete any message" on public.quiniela_league_chat;
create policy "league owner can delete any message"
  on public.quiniela_league_chat
  for delete
  using (
    exists (
      select 1
      from public.quiniela_leagues l
      where l.id = quiniela_league_chat.league_id
        and l.owner_id = auth.uid()
    )
  );
