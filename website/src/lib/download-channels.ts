export type Platform = 'windows' | 'macos' | 'linux'
export type AssetKind = Platform | 'tools' | null

export function classifyAsset(name: string): AssetKind {
  const n = name.toLowerCase()
  if (n.includes('sha256sums') || n.endsWith('.sig') || n.endsWith('.json') || n.endsWith('.txt')) return null
  if (n.includes('-test.')) return null
  if (n.endsWith('.dmg') || n.endsWith('.app.tar.gz') || n.endsWith('.pkg')) return 'macos'
  if (n.endsWith('.msi') || n.endsWith('.exe') || n.endsWith('-portable.zip')) return 'windows'
  if (n.endsWith('.appimage') || n.endsWith('.deb') || n.endsWith('.rpm')) return 'linux'
  return null
}

export interface GithubDownloads {
  installers: number
  byPlatform: Record<Platform, number>
  tools: number
  stars: number | null
  latestTag: string | null
  latestUrl: string | null
  releases: number
}

interface GhRelease {
  tag_name?: string
  html_url?: string
  draft?: boolean
  prerelease?: boolean
  assets?: Array<{ name?: string; download_count?: number }>
}

let buildCache: { at: number; data: GithubDownloads | null } | null = null

export async function fetchGithubDownloads(
  repo: string,
  headers: Record<string, string>,
): Promise<GithubDownloads | null> {
  if (buildCache && Date.now() - buildCache.at < 60_000 && buildCache.data) {
    return buildCache.data
  }
  const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers })
  const stars = repoRes.ok
    ? ((await repoRes.json()) as { stargazers_count?: number }).stargazers_count ?? null
    : null

  const all: GhRelease[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100&page=${page}`, {
      headers,
    })
    if (!res.ok) break
    const batch = (await res.json()) as GhRelease[]
    if (!Array.isArray(batch)) break
    all.push(...batch)
    if (batch.length < 100) break
  }

  if (stars === null && all.length === 0) return null

  const byPlatform: Record<Platform, number> = { windows: 0, macos: 0, linux: 0 }
  let tools = 0
  for (const rel of all) {
    if (rel.draft) continue
    for (const a of rel.assets || []) {
      const kind = classifyAsset(a.name || '')
      const c = a.download_count || 0
      if (kind === 'tools') tools += c
      else if (kind) byPlatform[kind] += c
    }
  }
  const installers = byPlatform.windows + byPlatform.macos + byPlatform.linux
  const stable = all.find((r) => !r.draft && !r.prerelease)

  const result: GithubDownloads = {
    installers,
    byPlatform,
    tools,
    stars,
    latestTag: stable ? (stable.tag_name || '').replace(/^v/, '') || null : null,
    latestUrl: stable?.html_url || null,
    releases: all.length,
  }
  buildCache = { at: Date.now(), data: result }
  return result
}

export const STORE_CHANNELS = ['appstore', 'msstore'] as const
export type StoreChannel = (typeof STORE_CHANNELS)[number]
