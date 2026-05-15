import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ONE-TIME migration endpoint — delete after use
export async function POST(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.RANKINGS_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const sql = `
CREATE OR REPLACE FUNCTION public.f_recompute_score_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.score_auto := ROUND(CAST(
      COALESCE(NEW.rendimiento_auto, 50) * 0.40 +
      COALESCE(NEW.contexto_auto,    50) * 0.20 +
      COALESCE(NEW.mediatico_auto,   50) * 0.25 +
      COALESCE(NEW.narrativa_auto,   50) * 0.15 +
      COALESCE(NEW.editorial_boost,   0)
    AS NUMERIC), 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_score_auto ON public.ranking_entries;
CREATE TRIGGER trg_recompute_score_auto
  BEFORE UPDATE OF
    rendimiento_auto, contexto_auto, mediatico_auto, narrativa_auto, editorial_boost
  ON public.ranking_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.f_recompute_score_auto();
`

  const { error } = await sb.rpc('exec_sql', { sql })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
