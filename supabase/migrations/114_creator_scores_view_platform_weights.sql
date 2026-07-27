-- Rebalanceo de plataformas en effective_followers de creadores.
-- Antes IG/TikTok pesaban ×0.3 (infravaloraba a los nativos de IG/TikTok); ahora ×0.6.
-- Pesos: YouTube ×1.0 · Twitch ×0.9 · TikTok ×0.6 · Instagram ×0.6 · Twitter ×0.4.
CREATE OR REPLACE VIEW public.creator_scores_view AS
 SELECT creator_id,
    yt_subscribers,
    twitch_known,
    tiktok_known,
    twitter_known,
    instagram_known,
    videos_last_30d,
    yt_subscribers + twitch_known + tiktok_known + twitter_known + instagram_known AS total_followers_raw,
    round(yt_subscribers::numeric * 1.0 + twitch_known::numeric * 0.9 + twitter_known::numeric * 0.4 + tiktok_known::numeric * 0.6 + instagram_known::numeric * 0.6)::bigint AS effective_followers,
    f_creator_followers_score(round(yt_subscribers::numeric * 1.0 + twitch_known::numeric * 0.9 + twitter_known::numeric * 0.4 + tiktok_known::numeric * 0.6 + instagram_known::numeric * 0.6)::bigint) AS followers_score,
    f_creator_actividad_score(videos_last_30d) AS actividad_score,
    round(f_creator_followers_score(round(yt_subscribers::numeric * 1.0 + twitch_known::numeric * 0.9 + twitter_known::numeric * 0.4 + tiktok_known::numeric * 0.6 + instagram_known::numeric * 0.6)::bigint)::numeric * 0.70 + f_creator_actividad_score(videos_last_30d)::numeric * 0.30, 1) AS score,
    fetched_at,
    updated_at
   FROM creator_raw_metrics m;
