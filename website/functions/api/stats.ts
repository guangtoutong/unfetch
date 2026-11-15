/**
 * Cloudflare Pages Function: /api/stats
 *
 * Server-side proxy for GitHub stats (stars + total download count across releases),
 * cached for 5 minutes in Cloudflare's edge cache.
 *   - Visitors (including in mainland China) hit our own domain without CORS or
 *     GitHub 60/hr unauthenticated rate-limit issues.
 *   - Numbers update automatically every 5 minutes without redeploying the site.
 */

import { fetchGithubDownloads, STORE_CHANNELS } from '../../src/lib/download-channels'

const REPO = 'guangtoutong/unfetch'
const CACHE_TTL = 300 // 5 minutes
const CACHE_TTL_STALE = 60 // 1 minute fallback

interface GithubPayload {
  stars: number | null
  downloads: number | null
  latest_tag: string | null
  latest_url: string | null
}

interface StatsEnv {
  DB?: any
  GITHUB_TOKEN?: string
}

export const onRequest = async ({ request, env }: { request: Request; env: StatsEnv }) => {
  const cache = (caches as any).default as Cache | undefined
  const cacheKey = new Request(request.url, request)

  if (cache) {
    const cached = await cache.match(cacheKey)
    if (cached) return cached
  }

  let payload: GithubPayload = { stars: null, downloads: null, latest_tag: null, latest_url: null }
  let fetchOk = false
  try {
    const headers: Record<string, string> = {
      'User-Agent': 'unfetch-stats-proxy',
      Accept: 'application/vnd.github+json',
    }
    if (env?.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`
    const gh = await fetchGithubDownloads(REPO, headers)
    if (gh) {
      payload = {
        stars: gh.stars,
        downloads: gh.installers,
        latest_tag: gh.latestTag,
        latest_url: gh.latestUrl,
      }
      fetchOk = gh.stars != null
    }
  } catch {
    // Fall through to D1 cache if available
  }

  if (fetchOk && env?.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO stats_cache(key, value, updated_at) VALUES(?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
      )
        .bind('github', JSON.stringify(payload), Date.now())
        .run()
    } catch {
      // Non-fatal
    }
  } else if (env?.DB) {
    try {
      const row = await env.DB.prepare(`SELECT value FROM stats_cache WHERE key = ?`)
        .bind('github')
        .first()
      if (row?.value) {
        const fallback = JSON.parse(row.value) as GithubPayload
        payload = {
          stars: payload.stars ?? fallback.stars,
          downloads: payload.downloads ?? fallback.downloads,
          latest_tag: payload.latest_tag ?? fallback.latest_tag,
          latest_url: payload.latest_url ?? fallback.latest_url,
        }
      }
    } catch {
      // Non-fatal
    }
  }

  const stores: Record<string, number | null> = {}
  for (const ch of STORE_CHANNELS) stores[ch] = null
  if (env?.DB) {
    try {
      const rows = await env.DB.prepare(
        `SELECT channel, SUM(count) AS total FROM download_daily GROUP BY channel`,
      ).all()
      for (const r of rows?.results || []) {
        if (r.channel in stores) stores[r.channel] = r.total
      }
    } catch {
      // Non-fatal
    }
  }
  const storeSum = Object.values(stores).reduce<number>((a, b) => a + (b ?? 0), 0)
  const total = payload.downloads != null ? payload.downloads + storeSum : null

  const body = JSON.stringify({
    stars: payload.stars,
    downloads: total,
    github_downloads: payload.downloads,
    stores,
    latest_tag: payload.latest_tag,
    latest_url: payload.latest_url,
    updated: new Date().toISOString(),
    fresh: fetchOk,
  })

  const ttl = fetchOk ? CACHE_TTL : CACHE_TTL_STALE
  const response = new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}`,
      'Access-Control-Allow-Origin': '*',
    },
  })

  if (fetchOk && cache) {
    await cache.put(cacheKey, response.clone())
  }

  return response
}
