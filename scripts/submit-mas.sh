#!/usr/bin/env bash
#
# 上传已 build 的 MAS .pkg 到 App Store Connect。
#
# 用法:./scripts/submit-mas.sh [path/to/unfetch_X.Y.Z_W.pkg]
# 不给路径时默认取 dist-mas/ 下最新 .pkg。
#
# 必需 env(.env.local):
#   APPLE_ID         你的 Apple ID 邮箱
#   APPLE_PASSWORD   app-specific password(不是 Apple ID 主密码)
#   APPLE_TEAM_ID    Apple Developer team ID,e.g. 6NQM3XP5RF
#
# altool 在新 Apple 工具里已 deprecate,但 MAS 上传仍受支持;
# 等以后申请到 ASC API key,可以换成 `xcrun iTMSTransporter`。

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

: "${APPLE_ID:?Set APPLE_ID in .env.local}"
: "${APPLE_PASSWORD:?Set APPLE_PASSWORD in .env.local}"
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID in .env.local}"

PKG="${1:-}"
if [ -z "$PKG" ]; then
  PKG=$(ls -t dist-mas/*.pkg 2>/dev/null | head -1)
fi
if [ -z "$PKG" ] || [ ! -f "$PKG" ]; then
  echo "ERROR: 没提供 .pkg 且 dist-mas/ 为空。先跑 ./scripts/build-mas.sh" >&2
  exit 1
fi

echo "==> Validating $PKG against App Store Connect"
xcrun altool --validate-app \
  -f "$PKG" \
  -t osx \
  -u "$APPLE_ID" \
  -p "$APPLE_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID"

echo ""
echo "==> Uploading $PKG"
xcrun altool --upload-app \
  -f "$PKG" \
  -t osx \
  -u "$APPLE_ID" \
  -p "$APPLE_PASSWORD" \
  --asc-provider "$APPLE_TEAM_ID"

cat <<MSG

==> 上传完成。build 大约 5-15 分钟后会出现在 App Store Connect:
    https://appstoreconnect.apple.com/apps

后续在 ASC 上:
  1. Distribution → macOS app → 选刚上传的 build
  2. 填 Version Release Notes、Screenshots、App Review Information
  3. Submit for Review

如果审核被拒,根据 Apple 邮件里 Guideline 编号定位问题,改完重跑:
  MAS_BUILD_NUMBER=<下一个数字> ./scripts/build-mas.sh
  ./scripts/submit-mas.sh
MSG
