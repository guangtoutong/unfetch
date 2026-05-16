# unfetch.org — Official site

Astro + Cloudflare Pages.

## Local

```bash
pnpm install
pnpm dev
# http://localhost:4321
```

## Build

```bash
pnpm build
# Output → ./dist
```

## Deploy to Cloudflare Pages

### One-time setup

1. Push this repo to GitHub (already done: `guangtoutong/unfetch`).
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorize GitHub for the `unzooai` Cloudflare account, pick `guangtoutong/unfetch`.
4. Build settings:
   - **Framework preset**: Astro
   - **Root directory**: `website/`
   - **Build command**: `pnpm install && pnpm build`
   - **Build output**: `dist`
5. Add custom domain `unfetch.org` under the Pages project → **Custom domains**.
   Cloudflare will auto-set the CNAME if the domain is on your account, otherwise add the CNAME record manually.

### CLI (wrangler) deploy

```bash
pnpm dlx wrangler pages deploy ./dist --project-name=unfetch
```

## Endpoints worth knowing

| URL | Purpose |
|-----|---------|
| `/` | English home page |
| `/{lang}` | Localized home (13 other languages) |
| `/mcp`, `/{lang}/mcp` | MCP integration guide |
| `/ads.json` | Remote-controlled ad bar (read by desktop app) — edit this file to change recommendations live |

## Structure

```
website/
  src/
    layouts/Base.astro       Header + footer + lang switcher
    components/
      Home.astro             Hero + features + CTA
      MCP.astro              MCP guide with config example
    i18n/strings.ts          14 language strings (English & Chinese fleshed out, others fallback)
    pages/
      index.astro            English home
      mcp.astro              English MCP
      [lang]/index.astro     Other-language home
      [lang]/mcp.astro       Other-language MCP
  public/
    ads.json                 Loaded by desktop app's ad bar
    favicon.svg              App icon
```
