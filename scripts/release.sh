#!/usr/bin/env bash
#
# 一键发版：bump 版本号 → commit → tag → push
#
# CI (.github/workflows/release.yml) 跑 Windows + Linux 并创建 GitHub Release。
# 之后本地跑 ./scripts/build-mac.sh 把 macOS 的 .dmg 上传到同一个 Release。
#
# 用法：./scripts/release.sh 0.2.0

set -euo pipefail

cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>  (e.g. $0 0.2.0)" >&2
  exit 1
fi

VERSION="$1"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: 版本号必须是 semver，例如 0.2.0" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: 工作区有未提交改动。先 commit 或 stash。" >&2
  git status --short
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
  sed -i.bak -E "s/${OLD_VERSION}/v${VERSION}/g" website/src/components/Download.astro 2>/dev/null && \
    rm website/src/components/Download.astro.bak || true
  sed -i.bak -E "s/${OLD_VERSION#v}/${VERSION}/g" website/src/components/Download.astro 2>/dev/null && \
    rm website/src/components/Download.astro.bak || true
fi

# Cargo.lock 需要 cargo update 刷新自身版本
(cd src-tauri && cargo update -p unfetch --offline 2>/dev/null) || \
  echo "(skip cargo update for unfetch — 离线或包名不匹配，Cargo.lock 首次编译会自动更新)"

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml \
        website/src/i18n/strings.ts website/src/components/Download.astro 2>/dev/null || \
  git add -A

git commit -m "chore: bump version to ${VERSION}"
git tag "v${VERSION}"

echo ""
echo "==> Tagged v${VERSION}"
echo "==> 推送（这会触发 GitHub Actions 构建 Win + Linux）"
git push origin HEAD
git push origin "v${VERSION}"

cat <<MSG

==> 已推送 v${VERSION}。

后续步骤：
  1. CI 跑完后（~10 分钟），Win/Linux 产物自动放到：
     https://github.com/guangtoutong/unfetch/releases/tag/v${VERSION}
  2. 本地跑 macOS 构建+公证+上传：
     ./scripts/build-mac.sh ${VERSION}
  3. 全部产物到齐后，到 GitHub Releases 页 "Edit" → "Publish release"

CI 状态：https://github.com/guangtoutong/unfetch/actions
MSG
