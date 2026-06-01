-- ─────────────────────────────────────────────────────────────────
-- Seed inicial de cosméticos (~32 items) — Fase 2.4 del plan placa.
--
-- Estructura:
--   · 11 derivados de badges (titles, frames, card_bgs existentes en
--     src/lib/badges.ts → cosmetic equivalentes)
--   · 14 drops por nivel — el sistema de progresión: cada level-up
--     suelta uno. Bronze (L1-9), Silver (L10-24), Gold (L25-49),
--     Diamond (L50+).
--   · 7 sport picks — avatar_frame por deporte. Free al elegir
--     deporte favorito. Esto da identidad inmediata al user nuevo.
--
-- INSERT con ON CONFLICT DO NOTHING para que la migración sea segura
-- de re-aplicar (idempotente).
-- ─────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════
-- A. DERIVADOS DE BADGES (matchean los unlocks actuales de badges.ts)
-- ══════════════════════════════════════════════════════════════════
insert into public.cosmetics (id, type, name, description, rarity, data, unlock_source, unlock_condition, sort_order) values

-- Titles
('title_oraculo',      'title', 'El Oráculo',         'Para los que sienten cuándo va a caer el gol.',
  'rare',  '{"text":"El Oráculo","color":"#a78bfa"}'::jsonb,           'badge', '{"badge_id":"oraculo"}'::jsonb,                    10),
('title_pleno',        'title', 'El Pleno',           'Lo clavaste todo en una jornada. Eso son palabras mayores.',
  'epic',  '{"text":"El Pleno","color":"#fbbf24"}'::jsonb,             'badge', '{"badge_id":"pleno_jornada"}'::jsonb,               11),
('title_high_roller',  'title', 'High Roller',        'Apostaste fuerte y te salió. Esto va de huevos.',
  'epic',  '{"text":"High Roller","color":"#22d3ee"}'::jsonb,          'badge', '{"badge_id":"high_roller"}'::jsonb,                 12),
('title_underdog',     'title', 'Cazador de Cuotas',  'Lo ves donde nadie lo ve.',
  'rare',  '{"text":"Cazador de Cuotas","color":"#fb923c"}'::jsonb,    'badge', '{"badge_id":"underdog"}'::jsonb,                    13),
('title_racha_3',      'title', 'En Racha',           'Tres jornadas seguidas. La cosa va.',
  'rare',  '{"text":"En Racha","color":"#f97316"}'::jsonb,             'badge', '{"badge_id":"racha_3"}'::jsonb,                     14),
('title_racha_5',      'title', 'En Llamas',          'Cinco seguidas. Nadie te toca.',
  'epic',  '{"text":"En Llamas","color":"#ef4444"}'::jsonb,            'badge', '{"badge_id":"racha_5"}'::jsonb,                     15),
('title_podio_weekly', 'title', 'El Podio',           'TOP 3 semanal. Mírate ahí arriba.',
  'rare',  '{"text":"El Podio","color":"#cd7f32"}'::jsonb,             'badge', '{"badge_id":"top_3_weekly"}'::jsonb,                16),
('title_champion',     'title', 'Campeón Semanal',    'Te llevaste la jornada entera.',
  'epic',  '{"text":"Campeón Semanal","color":"#fbbf24"}'::jsonb,      'badge', '{"badge_id":"champion_weekly"}'::jsonb,             17),
('title_mundialista',  'title', 'Mundialista 2026',   'Participaste en el Mundial. Cosa única.',
  'rare',  '{"text":"Mundialista 2026","color":"#22c55e"}'::jsonb,     'badge', '{"badge_id":"mundialista_2026"}'::jsonb,            18),
('title_profeta',      'title', 'El Profeta',         'Lo predijiste antes que nadie.',
  'legendary','{"text":"El Profeta","color":"#fbbf24"}'::jsonb,        'badge', '{"badge_id":"profeta_mundial_2026"}'::jsonb,        19),
('title_podio_mundial','title', 'Podio Mundial',      'TOP 3 del Mundial 2026. Histórico.',
  'legendary','{"text":"Podio Mundial","color":"#fbbf24"}'::jsonb,     'badge', '{"badge_id":"top3_mundial_2026"}'::jsonb,           20),

-- Frames (epic+)
('frame_pleno_gold',   'frame', 'Marco del Pleno',    'Borde dorado que grita "no fallé ninguna".',
  'epic',  '{"color":"#fbbf24"}'::jsonb,                               'badge', '{"badge_id":"pleno_jornada"}'::jsonb,               30),
('frame_high_roller',  'frame', 'Marco High Roller',  'Ciano eléctrico. Apuesta fuerte.',
  'epic',  '{"color":"#22d3ee"}'::jsonb,                               'badge', '{"badge_id":"high_roller"}'::jsonb,                 31),
('frame_racha_red',    'frame', 'Marco En Llamas',    'Rojo de racha de cinco.',
  'epic',  '{"color":"#ef4444"}'::jsonb,                               'badge', '{"badge_id":"racha_5"}'::jsonb,                     32),
('frame_constante',    'frame', 'Marco del Constante','Rosa de 30 días seguidos. Religión.',
  'epic',  '{"color":"#fb7185"}'::jsonb,                               'badge', '{"badge_id":"racha_dias_30"}'::jsonb,               33),
('frame_champion',     'frame', 'Marco Campeón',      'Dorado de campeón semanal.',
  'epic',  '{"color":"#fbbf24"}'::jsonb,                               'badge', '{"badge_id":"champion_weekly"}'::jsonb,             34),

-- Card BGs (legendary)
('cardbg_profeta',     'card_bg', 'Fondo del Profeta',  'Gradiente áureo profundo. Solo para profetas.',
  'legendary','{"gradient":"linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(180,83,9,0.10) 100%)"}'::jsonb,
  'badge', '{"badge_id":"profeta_mundial_2026"}'::jsonb,                                                                              50),
('cardbg_podio_mundial','card_bg','Fondo Podio Mundial','Gradiente legendario del Mundial.',
  'legendary','{"gradient":"linear-gradient(135deg, rgba(251,191,36,0.22) 0%, rgba(180,83,9,0.12) 100%)"}'::jsonb,
  'badge', '{"badge_id":"top3_mundial_2026"}'::jsonb,                                                                                 51),

-- ══════════════════════════════════════════════════════════════════
-- B. DROPS POR NIVEL — la columna nueva del sistema. Cada level-up
--    suelta uno; permite progresión visual continua sin depender de
--    romper logros específicos.
--
--    Niveles definidos en src/lib/levels.ts (L1-L9):
--    L1 Novato · L2 Aficionado · L3 Pronosticador · L4 Analista
--    L5 Experto · L6 Crack · L7 Maestro · L8 Leyenda · L9 Mito
--
--    Mapeo tier → niveles:
--    Bronze  = L1-L3 · Silver = L4-L5 · Gold = L6-L7 · Diamond = L8-L9
-- ══════════════════════════════════════════════════════════════════

-- Bronze tier (L1-L3) — sutiles, monocromáticos
('avatar_frame_bronze', 'avatar_frame', 'Anillo Bronce', 'Tu primer anillo de avatar.',
  'common', '{"color":"#cd7f32"}'::jsonb,                               'level', '{"min_level":1}'::jsonb,                            100),
('bgpattern_dots',     'background_pattern', 'Puntos sutiles', 'Patrón de puntos al fondo.',
  'common', '{"pattern":"dots"}'::jsonb,                                'level', '{"min_level":2}'::jsonb,                            101),
('signature_stat_xp',  'signature_stat',     'Stat XP firmado', 'Tu XP destacado en la placa.',
  'common', '{"key":"xp","label":"XP TOTAL"}'::jsonb,                   'level', '{"min_level":3}'::jsonb,                            102),

-- Silver tier (L4-L5)
('avatar_frame_silver','avatar_frame', 'Anillo Plata',   'Anillo plateado, paso a nivel medio.',
  'rare',   '{"color":"#cbd5e1","style":"solid"}'::jsonb,               'level', '{"min_level":4}'::jsonb,                            110),
('frame_silver_thin',  'frame',        'Marco plateado', 'Borde plata sobrio.',
  'rare',   '{"color":"#cbd5e1"}'::jsonb,                               'level', '{"min_level":4}'::jsonb,                            111),
('name_effect_silver', 'name_effect',  'Brillo plateado','Tu nombre con sheen plateado.',
  'rare',   '{"gradient":"linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)"}'::jsonb,
  'level', '{"min_level":5}'::jsonb,                                                                                                  112),
('corner_sticker_star_silver', 'corner_sticker', 'Pegatina estrella plata', 'Estrella en la esquina.',
  'rare',   '{"icon_id":"star","color":"#cbd5e1"}'::jsonb,              'level', '{"min_level":5}'::jsonb,                            113),
('bgpattern_lines',    'background_pattern', 'Líneas diagonales', 'Patrón de líneas oblicuas.',
  'rare',   '{"pattern":"lines"}'::jsonb,                               'level', '{"min_level":5}'::jsonb,                            114),

-- Gold tier (L6-L7)
('avatar_frame_gold',  'avatar_frame', 'Anillo Oro',     'Anillo dorado con gradient cónico.',
  'epic',   '{"color":"#fbbf24","style":"gradient"}'::jsonb,            'level', '{"min_level":6}'::jsonb,                            120),
('name_effect_gold',   'name_effect',  'Gradient áureo', 'Tu nombre en oro fundido.',
  'epic',   '{"gradient":"linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #b45309 100%)"}'::jsonb,
  'level', '{"min_level":6}'::jsonb,                                                                                                  121),
('corner_sticker_lightning_gold', 'corner_sticker', 'Pegatina rayo oro', 'Rayo dorado decorativo.',
  'epic',   '{"icon_id":"lightning","color":"#fbbf24"}'::jsonb,         'level', '{"min_level":7}'::jsonb,                            122),
('cardbg_gold_warm',   'card_bg',      'Fondo oro cálido','Fondo con tinte dorado.',
  'epic',   '{"gradient":"linear-gradient(160deg, #1a0f00 0%, #2d1a00 45%, #06060E 100%)"}'::jsonb,
  'level', '{"min_level":7}'::jsonb,                                                                                                  123),
('bgpattern_stripes',  'background_pattern', 'Stripes verticales', 'Stripes finos en el fondo.',
  'epic',   '{"pattern":"stripes"}'::jsonb,                             'level', '{"min_level":7}'::jsonb,                            124),

-- Diamond tier (L8-L9)
('avatar_frame_diamond','avatar_frame','Anillo Diamante','Anillo iridiscente arco iris.',
  'legendary','{"color":"#22d3ee","style":"gradient"}'::jsonb,          'level', '{"min_level":8}'::jsonb,                            130),
('name_effect_rainbow','name_effect',  'Gradient arco iris','Tu nombre en todos los colores del foil.',
  'legendary','{"gradient":"linear-gradient(90deg, #22d3ee 0%, #c084fc 50%, #fbbf24 100%)"}'::jsonb,
  'level', '{"min_level":8}'::jsonb,                                                                                                  131),
('cardbg_galaxy',      'card_bg',      'Fondo Galaxia',  'Fondo cósmico legendario.',
  'legendary','{"gradient":"linear-gradient(160deg, #001a26 0%, #1a0033 45%, #260011 80%, #06060E 100%)"}'::jsonb,
  'level', '{"min_level":9}'::jsonb,                                                                                                  132),

-- ══════════════════════════════════════════════════════════════════
-- C. SPORT PICKS — avatar_frame por deporte favorito. Free al elegir.
--    Da identidad inmediata, antes de tener cualquier badge.
-- ══════════════════════════════════════════════════════════════════
('avatar_frame_futbol',     'avatar_frame', 'Anillo Fútbol',    'Verde césped.',
  'common', '{"color":"#22c55e"}'::jsonb,                               'sport_pick', '{"sport":"futbol"}'::jsonb,                     200),
('avatar_frame_baloncesto', 'avatar_frame', 'Anillo NBA',       'Naranja del balón.',
  'common', '{"color":"#f59e0b"}'::jsonb,                               'sport_pick', '{"sport":"baloncesto"}'::jsonb,                 201),
('avatar_frame_formula1',   'avatar_frame', 'Anillo F1',        'Rojo escudería.',
  'common', '{"color":"#ef4444"}'::jsonb,                               'sport_pick', '{"sport":"formula1"}'::jsonb,                   202),
('avatar_frame_ufc',        'avatar_frame', 'Anillo UFC',       'Naranja octágono.',
  'common', '{"color":"#f97316"}'::jsonb,                               'sport_pick', '{"sport":"ufc"}'::jsonb,                        203),
('avatar_frame_tenis',      'avatar_frame', 'Anillo Tenis',     'Amarillo pelota.',
  'common', '{"color":"#d97706"}'::jsonb,                               'sport_pick', '{"sport":"tenis"}'::jsonb,                      204),
('avatar_frame_rugby',      'avatar_frame', 'Anillo Rugby',     'Morado oval.',
  'common', '{"color":"#a78bfa"}'::jsonb,                               'sport_pick', '{"sport":"rugby"}'::jsonb,                      205),
('avatar_frame_wwe',        'avatar_frame', 'Anillo Lucha',     'Amarillo cinturón.',
  'common', '{"color":"#facc15"}'::jsonb,                               'sport_pick', '{"sport":"wwe"}'::jsonb,                        206)

on conflict (id) do nothing;
