#!/usr/bin/env bash
#
# 本地 macOS 构建：Developer ID 签名 + 公证 + 上传到 GitHub Release
#
# 为什么本地做：
#   - Apple 公证需要 Developer ID 证书、App-specific password、Team ID
#   - 这些凭据放 CI 风险大，本地做最稳
#   - GitHub Actions 只跑 Windows + Linux，macOS 由这个脚本本地完成
#
# 流程：
#   1. cargo build → tauri build --bundles app（出 .app）
#   2. codesign 重签（确保 sidecar daemon 也签上）
#   3. 打包 .zip 提交 notarytool，等审核通过
#   4. stapler 把公证票钉到 .app
#   5. hdiutil 制作 .dmg + 签名
#   6. 用 gh CLI 把 .dmg 上传到对应版本的 GitHub Release
#
# 用法：
#   ./scripts/build-mac.sh         # 不指定，从 package.json 读版本
#   ./scripts/build-mac.sh 0.2.0   # 强制指定版本（应与 tag 一致）
#
# 必需环境变量（放 .env.local 或 export）：
#   APPLE_SIGNING_IDENTITY   e.g. "Developer ID Application: Your Name (TEAMID)"
#   APPLE_ID                 Apple ID 邮箱
#   APPLE_PASSWORD           App-specific password（不是 Apple ID 密码！）
#   APPLE_TEAM_ID            10 位 Team ID
#   GH_TOKEN                 可选：用于 gh CLI 上传到 release（如已 gh auth login 可省）

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${APPLE_SIGNING_IDENTITY:?Set APPLE_SIGNING_IDENTITY in .env.local}"
: "${APPLE_ID:?Set APPLE_ID in .env.local}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD in .env.local}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID in .env.local}"

VERSION="${1:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"
PRODUCT="unfetch"

echo "==> ${PRODUCT} ${TAG} — 本地 macOS 构建 + 公证"

# ---------- 1. 前端 + Go daemon（universal: x86_64 + aarch64）----------
echo "==> Building frontend"
pnpm install --frozen-lockfile
pnpm build

echo "==> Building Go daemon (universal binary)"
mkdir -p src-tauri/binaries
pushd core >/dev/null
mkdir -p ../src-tauri/binaries
# 两个 arch 各编一次，再用 lipo 合并 — Tauri externalBin 要 universal 必须 lipo
for ARCH in x86_64 aarch64; do
  GO_ARCH="amd64"
  [ "$ARCH" = "aarch64" ] && GO_ARCH="arm64"
  echo "    ${ARCH} (GOARCH=${GO_ARCH})"
  GOOS=darwin GOARCH="${GO_ARCH}" CGO_ENABLED=0 \
    go build -ldflags="-s -w" \
    -o "../src-tauri/binaries/unfetch-daemon-${ARCH}-apple-darwin" .
done
# Tauri 的 externalBin 在 universal target 下需要带 -universal-apple-darwin 的合并产物
lipo -create \
  "../src-tauri/binaries/unfetch-daemon-x86_64-apple-darwin" \
  "../src-tauri/binaries/unfetch-daemon-aarch64-apple-darwin" \
  -output "../src-tauri/binaries/unfetch-daemon-universal-apple-darwin"
chmod +x ../src-tauri/binaries/unfetch-daemon-*-apple-darwin
popd >/dev/null

# ---------- 2. Tauri build --bundles app（先不打 dmg，后面手动 hdiutil 做）----------
echo "==> Building .app (universal, no dmg yet)"
# 用 env -u 显式 unset APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID,这样 Tauri 内置的
# notarize 步骤就被跳过 — 我们手动控制后面的签 sidecar + notarize 流程,因为
# Tauri 的默认签法不会给 sidecar 二进制加 hardened runtime + secure timestamp,
# 直接送公证会被拒。
env -u APPLE_ID -u APPLE_PASSWORD -u APPLE_TEAM_ID \
  APPLE_SIGNING_IDENTITY="$APPLE_SIGNING_IDENTITY" \
  pnpm tauri build --target universal-apple-darwin --bundles app

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/${PRODUCT}.app"
[ -d "$APP" ] || { echo "ERROR: .app not found at $APP" >&2; exit 1; }

# ---------- 3. 重签：先签 sidecar 二进制（必须 hardened + timestamp），再签 .app ----------
# --deep 在 macOS 13+ 已弃用，推荐 inside-out 单独签每一层。Tauri 默认对
# sidecar 只做轻量签名，没加 --options runtime 也没加 --timestamp，公证必拒。
echo "==> Signing sidecar binaries individually"
SIDECAR_DIR="$APP/Contents/Resources/binaries"
if [ -d "$SIDECAR_DIR" ]; then
  for f in "$SIDECAR_DIR"/*; do
    [ -f "$f" ] || continue
    echo "    sign $(basename "$f")"
    codesign --force --options runtime --timestamp \
      --sign "$APPLE_SIGNING_IDENTITY" "$f"
  done
fi

echo "==> Re-signing .app outer bundle (hardened runtime + timestamp)"
codesign --force --options runtime --timestamp \
  --sign "$APPLE_SIGNING_IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# ---------- 4. 公证 ----------
echo "==> Submitting to Apple notarization (may take 1-5 min)"
ZIP="/tmp/${PRODUCT}-${VERSION}-notarize.zip"
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
rm -f "$ZIP"

echo "==> Stapling notarization ticket"
xcrun stapler staple "$APP"
xcrun stapler validate "$APP"
spctl -a -vvv "$APP" || echo "(spctl 检查见上方输出)"

# ---------- 5. 打 dmg ----------
echo "==> Building dmg"
STAGE="/tmp/${PRODUCT}-dmg-stage-${VERSION}"
rm -rf "$STAGE" && mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/${PRODUCT}.app"
ln -s /Applications "$STAGE/Applications"
DMG_DIR="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
mkdir -p "$DMG_DIR"
DMG="${DMG_DIR}/${PRODUCT}_${VERSION}_universal.dmg"
rm -f "$DMG"
hdiutil create -volname "${PRODUCT}" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" "$DMG"
rm -rf "$STAGE"

echo ""
echo "==> Done locally: $DMG"
ls -lh "$DMG"

# ---------- 6. 上传到 GitHub Release ----------
if ! command -v gh >/dev/null 2>&1; then
  echo ""
  echo "[!] gh CLI 未安装，DMG 已生成但未上传。"
  echo "    手动上传：gh release upload ${TAG} \"${DMG}\""
  exit 0
fi

# 检查 release 是否已存在
if gh release view "${TAG}" --repo guangtoutong/unfetch >/dev/null 2>&1; then
  echo "==> Uploading to GitHub Release ${TAG}"
  gh release upload "${TAG}" "${DMG}" --repo guangtoutong/unfetch --clobber
  echo "==> 上传完成。Release 页：https://github.com/guangtoutong/unfetch/releases/tag/${TAG}"
else
  echo "[!] GitHub Release ${TAG} 还不存在。"
  echo "    一般是 CI（Win/Linux）还没跑完。等 CI 创建好 release 后再跑："
  echo "    gh release upload ${TAG} \"${DMG}\" --repo guangtoutong/unfetch --clobber"
fi
