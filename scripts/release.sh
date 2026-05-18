#!/usr/bin/env bash
#
# 一键发版：bump 版本号 → commit → tag → push → 部署官网
#
# 三件事一气呵成：
#   1. CI (.github/workflows/release.yml) 跑 Windows + Linux 并创建 GitHub Release
#   2. 把网站 build + 推到 Cloudflare Pages (unfetch.org)
#   3. 提示你之后本地跑 ./scripts/build-mac.sh <ver> 公证 mac dmg 并上传到 release
#
# 用法：./scripts/release.sh 0.2.1
#       ./scripts/release.sh 0.2.1 --no-deploy   # 跳过 wrangler 部署官网
#
# 幂等性：如果版本号已经 bump 过（比如 master 上累积了 patch commit），
# 这次跑只创建 tag，不会因为"没东西可 commit"而报错。

set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version> [--no-deploy]  (e.g. $0 0.2.1)" >&2
  exit 1
fi

VERSION="$1"
shift || true
DEPLOY_SITE=1
for arg in "$@"; do
  case "$arg" in
    --no-deploy) DEPLOY_SITE=0 ;;
  esac
done

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: 版本号必须是 semver，例如 0.2.1" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: 工作区有未提交改动。先 commit 或 stash。" >&2
  git status --short
  exit 1
fi

# 如果 tag 已经存在,提示并退出
if git rev-parse "v${VERSION}" >/dev/null 2>&1; then
  echo "ERROR: tag v${VERSION} 已经存在。先 git tag -d v${VERSION} 再重试。" >&2
  exit 1
fi

echo "==> Bumping unfetch to v${VERSION}"

# package.json
sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" package.json
rm package.json.bak

# src-tauri/tauri.conf.json
sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
rm src-tauri/tauri.conf.json.bak

# src-tauri/Cargo.toml（只改第一处，避免误改 dependencies）
sed -i.bak -E "0,/^version = \"[^\"]+\"/ s//version = \"$VERSION\"/" src-tauri/Cargo.toml
rm src-tauri/Cargo.toml.bak

# website 的 i18n（hero tag 文案 v0.x.x），先用 sed 批量替换旧版本号
OLD_VERSION=$(grep -oE 'v0\.[0-9]+\.[0-9]+' website/src/i18n/strings.ts | head -1 || true)
if [ -n "$OLD_VERSION" ] && [ "$OLD_VERSION" != "v${VERSION}" ]; then
  sed -i.bak -E "s/${OLD_VERSION}/v${VERSION}/g" website/src/i18n/strings.ts
  rm website/src/i18n/strings.ts.bak
  if [ -f website/src/components/Download.astro ]; then
    sed -i.bak -E "s/${OLD_VERSION#v}/${VERSION}/g" website/src/components/Download.astro && \
      rm website/src/components/Download.astro.bak || true
  fi
  if [ -f website/src/components/Home.astro ]; then
    sed -i.bak -E "s/${OLD_VERSION#v}/${VERSION}/g" website/src/components/Home.astro && \
      rm website/src/components/Home.astro.bak || true
  fi
  if [ -f website/src/layouts/Base.astro ]; then
    sed -i.bak -E "s/VERSION = '${OLD_VERSION#v}'/VERSION = '${VERSION}'/g" website/src/layouts/Base.astro && \
      rm website/src/layouts/Base.astro.bak || true
  fi
fi

# Cargo.lock 需要 cargo update 刷新自身版本
(cd src-tauri && cargo update -p unfetch 2>/dev/null) || \
  echo "(skip cargo update for unfetch — 离线或包名不匹配，Cargo.lock 首次编译会自动更新)"

# 收集所有改动 — 工作区可能完全干净(版本号早已 bump),也可能有真改动
git add -A
if git diff --cached --quiet; then
  echo "==> 版本号已经是 ${VERSION},没有 bump diff。直接 tag。"
else
  git commit -m "chore: bump version to ${VERSION}"
fi

git tag "v${VERSION}"

echo ""
echo "==> Tagged v${VERSION}"
echo "==> 推送（触发 GitHub Actions 构建 Win + Linux）"
git push origin HEAD
git push origin "v${VERSION}"

# ---------- 部署官网到 Cloudflare Pages ----------
if [ "${DEPLOY_SITE}" -eq 1 ]; then
  echo ""
  echo "==> 部署官网到 unfetch.org (Cloudflare Pages)"
  if ! command -v pnpm >/dev/null 2>&1; then
    echo "[!] pnpm 未安装,跳过官网部署。手动跑:"
    echo "    cd website && pnpm install && pnpm build && npx wrangler pages deploy dist --project-name=unfetch --branch=master --commit-dirty=true"
  else
    (
      cd website
      pnpm install --frozen-lockfile 2>&1 | tail -3
      pnpm build 2>&1 | tail -3
      npx wrangler pages deploy dist \
        --project-name=unfetch \
        --branch=master \
        --commit-dirty=true \
        2>&1 | tail -8
    )
  fi
else
  echo ""
  echo "==> --no-deploy 已指定,跳过 wrangler 部署。"
fi

cat <<MSG

==> 已推送 v${VERSION} + 部署官网。

下一步（macOS 公证 — 只能本地做）：
  ./scripts/build-mac.sh ${VERSION}

CI 状态：https://github.com/guangtoutong/unfetch/actions
Release：https://github.com/guangtoutong/unfetch/releases/tag/v${VERSION}
官网：https://unfetch.org/
MSG
