'use client'
import Image, { ImageProps } from 'next/image'

const OPTIMIZED_HOSTS = [
  'cdn.sanity.io',
  'cdninstagram.com',
  'fbcdn.net',
  'espncdn.com',
  'api-sports.io',
  'cloudfront.net',
  'twimg.com',
  'pbs.twimg.com',
]

function needsOptimization(src: string): boolean {
  try {
    const { hostname } = new URL(src)
    return OPTIMIZED_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

// Drop-in replacement for next/image that skips optimization for unknown external
// domains (news pipeline images from arbitrary sources) while still optimizing
// known CDNs (Sanity, ESPN, Instagram, etc.).
export default function DynamicImage({ src, ...props }: ImageProps) {
  const unoptimized = typeof src === 'string' && src.startsWith('http') && !needsOptimization(src)
  return <Image src={src} unoptimized={unoptimized} {...props} />
}
