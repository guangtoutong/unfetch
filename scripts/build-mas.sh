#!/usr/bin/env bash
#
# Mac App Store 分发版构建脚本
#
# 跟 scripts/build-mac.sh 的关键差别:
#   - 用 Apple Distribution 证书签(不是 Developer ID Application)
#   - 嵌入 entitlements.mas.plist (sandbox + JIT + 网络 + sidecar)
#   - 嵌入 Mac App Store provisioning profile 到
#     unfetch.app/Contents/embedded.provisionprofile
#   - 用 productbuild 包成签名 .pkg(不是 hdiutil dmg)
#   - 不做公证(MAS 提交后 Apple 审核流程自己 notarize)
#   - 不带 BT/yt-dlp(政策原因) — 用 VITE_APP_STORE_BUILD=1 触发前端
#     条件隐藏第三方广告;Go daemon 端理想做 build tag,留待后续
#
# 必需的 env(放 .env.local):
#   MAS_SIGNING_IDENTITY      e.g. "Apple Distribution: xiangdong li (6NQM3XP5RF)"
#   MAS_INSTALLER_IDENTITY    e.g. "3rd Party Mac Developer Installer: xiangdong li (6NQM3XP5RF)"
#   MAS_PROVISIONING_PROFILE  下载好的 .provisionprofile 文件路径
#
# 可选 env:
#   MAS_VERSION       App Store 上的短版本号(默认 package.json 的 version)
#   MAS_BUILD_NUMBER  build 编号,每次重新提交同一版本号递增(默认同 MAS_VERSION)
#
# 用法:./scripts/build-mas.sh
# 产物:dist-mas/unfetch_<MAS_VERSION>_<MAS_BUILD_NUMBER>.pkg

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${MAS_SIGNING_IDENTITY:?Set MAS_SIGNING_IDENTITY (Apple Distribution cert) in .env.local}"
: "${MAS_INSTALLER_IDENTITY:?Set MAS_INSTALLER_IDENTITY (3rd Party Mac Developer Installer cert) in .env.local}"
: "${MAS_PROVISIONING_PROFILE:?Set MAS_PROVISIONING_PROFILE (.provisionprofile path) in .env.local}"

PRODUCT="unfetch"
PKG_VERSION="$(node -p "require('./package.json').version")"
MAS_VERSION="${MAS_VERSION:-$PKG_VERSION}"
MAS_BUILD_NUMBER="${MAS_BUILD_NUMBER:-$PKG_VERSION}"

[ -f "$MAS_PROVISIONING_PROFILE" ] || { echo "ERROR: provisioning profile 不在 $MAS_PROVISIONING_PROFILE" >&2; exit 1; }

ENTITLEMENTS="src-tauri/entitlements.mas.plist"
SIDECAR_ENTITLEMENTS="src-tauri/entitlements.mas-sidecar.plist"
[ -f "$ENTITLEMENTS" ]         || { echo "ERROR: $ENTITLEMENTS 缺失" >&2; exit 1; }
[ -f "$SIDECAR_ENTITLEMENTS" ] || { echo "ERROR: $SIDECAR_ENTITLEMENTS 缺失" >&2; exit 1; }

echo "==> ${PRODUCT} MAS build"
echo "    Short version: $MAS_VERSION"
echo "    Build number:  $MAS_BUILD_NUMBER"
echo "    App cert:      $MAS_SIGNING_IDENTITY"
echo "    Installer:     $MAS_INSTALLER_IDENTITY"
echo "    Profile:       $MAS_PROVISIONING_PROFILE"

# ---------- 1. 前端 + Go daemon(universal) ----------
echo "==> Building frontend (VITE_APP_STORE_BUILD=1)"
pnpm install --frozen-lockfile
VITE_APP_STORE_BUILD=1 pnpm build

echo "==> Building Go daemon (universal binary)"
mkdir -p src-tauri/binaries
pushd core >/dev/null
for ARCH in x86_64 aarch64; do
  GO_ARCH="amd64"
  [ "$ARCH" = "aarch64" ] && GO_ARCH="arm64"
  GOOS=darwin GOARCH="${GO_ARCH}" CGO_ENABLED=0 \
    go build -ldflags="-s -w" \
    -o "../src-tauri/binaries/unfetch-daemon-${ARCH}-apple-darwin" .
done
lipo -create \
  "../src-tauri/binaries/unfetch-daemon-x86_64-apple-darwin" \
  "../src-tauri/binaries/unfetch-daemon-aarch64-apple-darwin" \
  -output "../src-tauri/binaries/unfetch-daemon-universal-apple-darwin"
chmod +x ../src-tauri/binaries/unfetch-daemon-*-apple-darwin
popd >/dev/null

# ---------- 2. Tauri build(不自动签名 — 我们后面用 MAS 证书重签)----------
echo "==> Building .app (universal, 无签名)"
env -u APPLE_SIGNING_IDENTITY -u APPLE_ID -u APPLE_PASSWORD -u APPLE_TEAM_ID \
  pnpm tauri build --target universal-apple-darwin --bundles app

APP="src-tauri/target/universal-apple-darwin/release/bundle/macos/${PRODUCT}.app"
[ -d "$APP" ] || { echo "ERROR: .app not found at $APP" >&2; exit 1; }

# ---------- 3. 改 Info.plist ----------
PLIST="$APP/Contents/Info.plist"
echo "==> Patching Info.plist with MAS version fields"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $MAS_VERSION" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $MAS_BUILD_NUMBER" "$PLIST"

# ---------- 4. 嵌入 provisioning profile + privacy manifest ----------
echo "==> Embedding provisioning profile"
cp "$MAS_PROVISIONING_PROFILE" "$APP/Contents/embedded.provisionprofile"

echo "==> Embedding PrivacyInfo.xcprivacy"
cp src-tauri/PrivacyInfo.xcprivacy "$APP/Contents/Resources/PrivacyInfo.xcprivacy"

# ---------- 5. 清干净 xattr(防 Apple 验证报 91109)----------
echo "==> Stripping extended attributes"
xattr -cr "$APP"

# ---------- 6. 移除已有签名 ----------
echo "==> Stripping existing signatures"
find "$APP" -type f \( -perm -u+x -o -name "*.dylib" -o -name "*.framework" \) -print0 |
  while IFS= read -r -d '' f; do
    codesign --remove-signature "$f" 2>/dev/null || true
  done
codesign --remove-signature "$APP" 2>/dev/null || true

# ---------- 7. 重签 sidecar ----------
echo "==> Signing sidecar binaries with MAS identity"
# 只签 main exec 之外的 sidecar(unfetch-daemon)。不带 application-identifier
# (sidecar entitlements 已分开),不加 --options runtime(MAS 用 sandbox,不要
# 跟 hardened runtime 混用)
for bin in "$APP"/Contents/MacOS/*; do
  [ -f "$bin" ] || continue
  if [ "$(basename "$bin")" = "${PRODUCT}" ]; then continue; fi
  echo "    sidecar: $(basename "$bin")"
  codesign --force --sign "$MAS_SIGNING_IDENTITY" \
    --entitlements "$SIDECAR_ENTITLEMENTS" \
    "$bin"
done

# 也签 Resources/binaries 下的 sidecar(Tauri externalBin 放这里)
if [ -d "$APP/Contents/Resources/binaries" ]; then
  for bin in "$APP"/Contents/Resources/binaries/*; do
    [ -f "$bin" ] || continue
    echo "    sidecar(res): $(basename "$bin")"
    codesign --force --sign "$MAS_SIGNING_IDENTITY" \
      --entitlements "$SIDECAR_ENTITLEMENTS" \
      "$bin"
  done
fi

# ---------- 8. 签 frameworks(如有)----------
if [ -d "$APP/Contents/Frameworks" ]; then
  echo "==> Signing frameworks"
  find "$APP/Contents/Frameworks" -type d -name "*.framework" -print0 |
    while IFS= read -r -d '' fw; do
      echo "    framework: $(basename "$fw")"
      codesign --force --deep --sign "$MAS_SIGNING_IDENTITY" "$fw"
    done
fi

# ---------- 9. 签外层 .app ----------
echo "==> Signing .app outer bundle"
# 不带 --options runtime — MAS sandbox 跟 hardened runtime 是两套安全模型
codesign --force --sign "$MAS_SIGNING_IDENTITY" \
  --entitlements "$ENTITLEMENTS" \
  --identifier app.unfetch.client \
  "$APP"

echo "==> Verifying signature"
codesign --verify --strict --deep --verbose=2 "$APP"

# ---------- 10. productbuild 包 .pkg ----------
echo "==> Building .pkg"
mkdir -p dist-mas
PKG="dist-mas/${PRODUCT}_${MAS_VERSION}_${MAS_BUILD_NUMBER}.pkg"
rm -f "$PKG"
productbuild --component "$APP" /Applications \
  --sign "$MAS_INSTALLER_IDENTITY" \
  "$PKG"

echo "==> Verifying .pkg signature"
pkgutil --check-signature "$PKG"

cat <<MSG

==> Done: $PKG

下一步:
  ./scripts/submit-mas.sh "$PKG"          上传到 App Store Connect

或者本地验证:
  pkgutil --payload-files "$PKG"          看 .pkg 内容
  xcrun altool --validate-app -f "$PKG" -t osx \\
    -u "\$APPLE_ID" -p "\$APPLE_PASSWORD"
MSG
