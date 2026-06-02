-- ─────────────────────────────────────────────────────────────────
-- Cosmetics estacionales + eventos (+14 items). Catálogo 61 → 75.
--
-- Diseño:
--   · Conmemorativos Mundial 2026 (season='mundial_2026') — atados a
--     badges del torneo. Cosméticos "premium" que solo tendrán quienes
--     participaron en el primer Mundial de Taka.
--   · Items de evento (unlock_source='event') — el admin los otorga
--     manualmente vía RPC unlock_cosmetic durante eventos especiales.
--     No se desbloquean solos. Quedan inactivos hasta que haya evento
--     (active=true pero sin trigger automático → solo manual).
--   · Drops de nivel alto (L9 Mito) — recompensas tope de progresión.
--
-- season != null marca el cosmético como temporal/coleccionable. La UI
-- puede mostrarlos con un badge "Edición Mundial 2026" en el futuro.
--
-- Idempotente (ON CONFLICT DO NOTHING).
-- ─────────────────────────────────────────────────────────────────

insert into public.cosmetics (id, type, name, description, rarity, data, unlock_source, unlock_condition, season, sort_order) values

-- ── Conmemorativos MUNDIAL 2026 (atados a badges del torneo) ────
('cardbg_mundial_pitch',     'card_bg', 'Cesped Mundial',     'El verde del Mundial 2026 grabado en tu placa.',
  'epic',      '{"gradient":"linear-gradient(160deg, #042f1a 0%, #0a1f12 45%, #06060E 100%)"}'::jsonb,
  'badge', '{"badge_id":"mundialista_2026"}'::jsonb, 'mundial_2026', 60),
('name_effect_mundial_gold', 'name_effect', 'Oro Mundial',     'Tu nombre en el oro del trofeo. Edicion 2026.',
  'legendary', '{"gradient":"linear-gradient(135deg, #fff7d6 0%, #fbbf24 40%, #b45309 100%)","glow":"rgba(251,191,36,0.55)"}'::jsonb,
  'badge', '{"badge_id":"top3_mundial_2026"}'::jsonb, 'mundial_2026', 61),
('corner_sticker_mundial',   'corner_sticker', 'Pegatina Mundial', 'Sello conmemorativo del Mundial 2026.',
  'epic',      '{"icon_id":"globe","color":"#22c55e"}'::jsonb,
  'badge', '{"badge_id":"mundialista_2026"}'::jsonb, 'mundial_2026', 62),
('frame_profeta_aura',       'frame', 'Aura del Profeta',     'Marco aureo solo para quienes lo vieron venir.',
  'legendary', '{"color":"#fbbf24"}'::jsonb,
  'badge', '{"badge_id":"profeta_mundial_2026"}'::jsonb, 'mundial_2026', 63),
('avatar_frame_mundial',     'avatar_frame', 'Anillo Mundial', 'Anillo conmemorativo verde-oro.',
  'epic',      '{"color":"#fbbf24","style":"gradient"}'::jsonb,
  'badge', '{"badge_id":"mundialista_2026"}'::jsonb, 'mundial_2026', 64),

-- ── Drops tope de progresión (L9 Mito) ──────────────────────────
('name_effect_mythic',       'name_effect', 'Mitico',          'Solo los Mitos lo tienen. Iridiscente total.',
  'legendary', '{"gradient":"linear-gradient(90deg, #f472b6 0%, #c084fc 25%, #22d3ee 50%, #4ade80 75%, #fbbf24 100%)","glow":"rgba(192,132,252,0.6)"}'::jsonb,
  'level', '{"min_level":9}'::jsonb, null, 133),
('frame_mythic',             'frame', 'Marco Mitico',          'Marco de nivel maximo. Pocos lo veran.',
  'legendary', '{"color":"#c084fc"}'::jsonb,
  'level', '{"min_level":9}'::jsonb, null, 134),
('corner_sticker_mythic',    'corner_sticker', 'Pegatina Mitica', 'Corona iridiscente del nivel maximo.',
  'legendary', '{"icon_id":"crown","color":"#c084fc"}'::jsonb,
  'level', '{"min_level":9}'::jsonb, null, 135),

-- ── Items de EVENTO (solo admin manual) ─────────────────────────
('title_fundador',           'title', 'Fundador',             'Estuviste desde el principio de Taka. Honor.',
  'legendary', '{"text":"Fundador","color":"#fbbf24"}'::jsonb,
  'event', '{"event_id":"founder"}'::jsonb, null, 70),
('frame_fundador',           'frame', 'Marco Fundador',       'Marco exclusivo de los primeros Takeros.',
  'legendary', '{"color":"#fbbf24"}'::jsonb,
  'event', '{"event_id":"founder"}'::jsonb, null, 71),
('corner_sticker_verified',  'corner_sticker', 'Verificado',  'Sello de cuenta verificada.',
  'epic',      '{"icon_id":"check","color":"#22d3ee"}'::jsonb,
  'event', '{"event_id":"verified"}'::jsonb, null, 72),
('name_effect_event_xmas',   'name_effect', 'Navidad',         'Rojo y verde festivo. Edicion limitada.',
  'rare',      '{"gradient":"linear-gradient(90deg, #ef4444 0%, #fff 50%, #22c55e 100%)"}'::jsonb,
  'event', '{"event_id":"xmas_2026"}'::jsonb, 'navidad_2026', 73),
('bgpattern_confetti',       'background_pattern', 'Confeti',  'Patron festivo de celebracion.',
  'rare',      '{"pattern":"dots"}'::jsonb,
  'event', '{"event_id":"celebration"}'::jsonb, null, 129),
('signature_stat_winrate',   'signature_stat', 'Stat winrate', 'Tu porcentaje de acierto destacado.',
  'epic',      '{"key":"winrate","label":"WINRATE"}'::jsonb,
  'event', '{"event_id":"analyst"}'::jsonb, null, 154)

on conflict (id) do nothing;
