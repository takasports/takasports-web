// Extracción de encabezados (h2/h3) desde el bodyPortable de Sanity.
// Genera slugs deterministas y dedupe interno por artículo, indexado por _key
// del bloque para que el render de PortableText use el mismo id.

export interface TocHeading {
  id: string
  text: string
  level: 2 | 3
  key: string
}

export interface TocExtract {
  headings: TocHeading[]
  idByKey: Record<string, string>
}

interface PortableTextSpan {
  _type?: string
  text?: string
}

interface PortableTextBlock {
  _type?: string
  _key?: string
  style?: string
  children?: PortableTextSpan[]
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return base || 'seccion'
}

function blockText(block: PortableTextBlock): string {
  return (block.children ?? [])
    .map(c => (typeof c?.text === 'string' ? c.text : ''))
    .join('')
    .trim()
}

export function extractHeadings(
  blocks: Array<{ _type?: string; _key?: string; [key: string]: unknown }> | null | undefined,
): TocExtract {
  if (!Array.isArray(blocks)) return { headings: [], idByKey: {} }

  const headings: TocHeading[] = []
  const idByKey: Record<string, string> = {}
  const counts: Record<string, number> = {}

  for (const raw of blocks) {
    const block = raw as PortableTextBlock
    if (block?._type !== 'block') continue

    const level: 2 | 3 | null =
      block.style === 'h2' ? 2 : block.style === 'h3' ? 3 : null
    if (!level) continue

    const text = blockText(block)
    if (!text) continue

    const base = slugify(text)
    counts[base] = (counts[base] ?? 0) + 1
    const id = counts[base] === 1 ? base : `${base}-${counts[base]}`
    const key = block._key ?? `auto-${headings.length}`

    headings.push({ id, text, level, key })
    idByKey[key] = id
  }

  return { headings, idByKey }
}
