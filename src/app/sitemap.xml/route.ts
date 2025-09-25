import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://somique.beauty'

const staticPaths = ['/', '/privacy', '/terms', '/support']

export const runtime = 'nodejs'

export async function GET() {
  const lastmod = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  
  const urls = staticPaths.map(path => ({
    loc: `${BASE_URL}${path}`,
    lastmod,
    changefreq: 'monthly',
    priority: path === '/' ? '1.0' : '0.6',
  }))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls
      .map(url =>
        `  <url>\n`
        + `    <loc>${url.loc}</loc>\n`
        + `    <lastmod>${url.lastmod}</lastmod>\n`
        + `    <changefreq>${url.changefreq}</changefreq>\n`
        + `    <priority>${url.priority}</priority>\n`
        + `  </url>`
      )
      .join('\n')
    + `\n</urlset>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
    },
  })
}
