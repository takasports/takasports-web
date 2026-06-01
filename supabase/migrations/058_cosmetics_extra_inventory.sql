-- ─────────────────────────────────────────────────────────────────
-- Cosmetics adicionales (+20 items) para aumentar diversidad visual.
--
-- Después del seed inicial (056) el catálogo tenía 41 items. Para que
-- dos users del mismo tier no se sientan idénticos hay que multiplicar
-- inventario. Esta migración añade:
--
--   · 4 titles para badges huérfanos del seed (vidente, clarividente,
--     taker_inicial, racha_dias_7)
--   · 4 name_effects extra (bronze, naranja fuego, neon ciano, sunset)
--   · 4 background_patterns extra (hex, mesh, waves, grid)
--   · 4 corner_stickers extra (shield, flame, diamond, eye)
--   · 4 signature_stats por hitos (badges, plenos, racha, predicciones)
--
-- Idempotente (ON CONFLICT DO NOTHING). Misma estructura que 056.
-- ─────────────────────────────────────────────────────────────────

insert into public.cosmetics (id, type, name, description, rarity, data, unlock_source, unlock_condition, sort_order) values

-- ── Titles para badges huérfanos del seed inicial ───────────────
('title_vidente',            'title', 'El Vidente',         'Clavaste un marcador exacto. Eso ya es brujería.',
  'rare',     '{"text":"El Vidente","color":"#a78bfa"}'::jsonb,         'badge', '{"badge_id":"vidente"}'::jsonb,                    21),
('title_clarividente',       'title', 'El Clarividente',    'Los 3 exactos en una jornada. No es suerte, es don.',
  'legendary','{"text":"El Clarividente","color":"#fbbf24"}'::jsonb,    'badge', '{"badge_id":"clarividente"}'::jsonb,               22),
('title_taker_inicial',      'title', 'Takero',             'De los nuestros desde el día uno.',
  'common',   '{"text":"Takero","color":"#34d399"}'::jsonb,             'badge', '{"badge_id":"taker_inicial"}'::jsonb,              23),
('title_semana_fuego',       'title', 'Semana de Fuego',    'Siete días seguidos. Ardes.',
  'rare',     '{"text":"Semana de Fuego","color":"#ef4444"}'::jsonb,    'badge', '{"badge_id":"racha_dias_7"}'::jsonb,               24),

-- ── Name effects extra ─────────────────────────────────────────
('name_effect_bronze',       'name_effect', 'Bronce fundido',  'Gradiente cálido bronce.',
  'common',   '{"gradient":"linear-gradient(135deg, #fbbf24 0%, #cd7f32 50%, #92400e 100%)"}'::jsonb,
  'level', '{"min_level":2}'::jsonb,                                                                                                115),
('name_effect_fire',         'name_effect', 'Fuego',           'Tu nombre en llamas — naranja/rojo.',
  'epic',     '{"gradient":"linear-gradient(180deg, #fde047 0%, #f97316 50%, #dc2626 100%)","glow":"rgba(249,115,22,0.45)"}'::jsonb,
  'badge', '{"badge_id":"racha_5"}'::jsonb,                                                                                          116),
('name_effect_neon_cyan',    'name_effect', 'Neón ciano',      'Brillo eléctrico ciano.',
  'epic',     '{"gradient":"linear-gradient(90deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%)","glow":"rgba(34,211,238,0.45)"}'::jsonb,
  'badge', '{"badge_id":"high_roller"}'::jsonb,                                                                                      117),
('name_effect_sunset',       'name_effect', 'Atardecer',       'Gradiente rosa/morado/dorado.',
  'rare',     '{"gradient":"linear-gradient(90deg, #f472b6 0%, #c084fc 50%, #fbbf24 100%)"}'::jsonb,
  'level', '{"min_level":4}'::jsonb,                                                                                                 118),

-- ── Background patterns extra ──────────────────────────────────
('bgpattern_hex',            'background_pattern', 'Hex tile',  'Patrón hexagonal sutil.',
  'rare',     '{"pattern":"hex"}'::jsonb,                                'badge', '{"badge_id":"pleno_jornada"}'::jsonb,             125),
('bgpattern_mesh',           'background_pattern', 'Malla',     'Patrón de malla cruzada.',
  'common',   '{"pattern":"mesh"}'::jsonb,                               'level', '{"min_level":3}'::jsonb,                          126),
('bgpattern_waves',          'background_pattern', 'Ondas',     'Líneas onduladas como agua.',
  'epic',     '{"pattern":"waves"}'::jsonb,                              'level', '{"min_level":6}'::jsonb,                          127),
('bgpattern_grid',           'background_pattern', 'Grid',      'Cuadrícula precisa minimal.',
  'common',   '{"pattern":"grid"}'::jsonb,                               'level', '{"min_level":2}'::jsonb,                          128),

-- ── Corner stickers extra ──────────────────────────────────────
('corner_sticker_shield',    'corner_sticker', 'Pegatina escudo',   'Escudo defensivo.',
  'rare',     '{"icon_id":"shield","color":"#34d399"}'::jsonb,         'level', '{"min_level":4}'::jsonb,                            141),
('corner_sticker_flame',     'corner_sticker', 'Pegatina llama',    'Llama ardiente.',
  'epic',     '{"icon_id":"flame","color":"#ef4444"}'::jsonb,          'badge', '{"badge_id":"racha_5"}'::jsonb,                     142),
('corner_sticker_diamond',   'corner_sticker', 'Pegatina diamante', 'Diamante puro.',
  'legendary','{"icon_id":"diamond","color":"#22d3ee"}'::jsonb,        'level', '{"min_level":8}'::jsonb,                            143),
('corner_sticker_eye',       'corner_sticker', 'Pegatina ojo',      'El ojo que todo lo ve.',
  'rare',     '{"icon_id":"eye","color":"#a78bfa"}'::jsonb,            'badge', '{"badge_id":"oraculo"}'::jsonb,                     144),

-- ── Signature stats extra ──────────────────────────────────────
('signature_stat_badges',    'signature_stat', 'Stat logros',     'Total de badges desbloqueados.',
  'common',   '{"key":"badgesCount","label":"BADGES"}'::jsonb,         'level', '{"min_level":2}'::jsonb,                            150),
('signature_stat_plenos',    'signature_stat', 'Stat plenos',     'Plenos conseguidos.',
  'epic',     '{"key":"plenos","label":"PLENOS"}'::jsonb,              'badge', '{"badge_id":"pleno_jornada"}'::jsonb,               151),
('signature_stat_racha',     'signature_stat', 'Stat racha',      'Tu racha actual de jornadas.',
  'rare',     '{"key":"racha","label":"RACHA"}'::jsonb,                'badge', '{"badge_id":"racha_3"}'::jsonb,                     152),
('signature_stat_preds',     'signature_stat', 'Stat predicciones','Total de predicciones ranked.',
  'common',   '{"key":"predictions","label":"PREDS"}'::jsonb,          'level', '{"min_level":3}'::jsonb,                            153)

on conflict (id) do nothing;
