import { redirect } from 'next/navigation'

// /article/[id] is kept for backward compat (Telegram/WF-07 links)
// Canonical URL is /noticias/[slug] — redirect everything there
export default async function ArticleRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/noticias/${id}`)
}
