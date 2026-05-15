-- Migration 022: columna handles JSONB para creadores
-- Almacena handles de plataformas sociales por entrada.
-- Formato: {"youtube":"UCxxxx","twitch":"login","instagram":"handle","tiktok":"@handle","twitter":"handle"}
-- Aplicada via Management API el 2026-05-16.
ALTER TABLE public.ranking_entries
  ADD COLUMN IF NOT EXISTS handles JSONB DEFAULT NULL;

COMMENT ON COLUMN public.ranking_entries.handles IS
  'Handles de redes sociales. {"youtube":"UCxxxx","twitch":"login","instagram":"handle","tiktok":"@handle","twitter":"handle"}';
