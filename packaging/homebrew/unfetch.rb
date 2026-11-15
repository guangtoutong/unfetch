cask "unfetch" do
  version "0.4.0"
  sha256 :no_check # 发版后可替换为实际 DMG 的 sha256

  url "https://github.com/guangtoutong/unfetch/releases/download/v#{version}/unfetch_#{version}_universal.dmg"
  name "unfetch"
  desc "Modern multi-protocol download manager for humans and AI (HTTP/BT/HLS/DASH/MCP)"
  homepage "https://unfetch.org"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on macos: ">= :monterey"

  app "unfetch.app"
  binary "#{appdir}/unfetch.app/Contents/MacOS/unfetch"

  zap trash: [
    "~/.config/unfetch",
    "~/.local/share/unfetch",
    "~/Library/Application Support/com.unfetch.app",
    "~/Library/Caches/com.unfetch.app",
    "~/Library/Preferences/com.unfetch.app.plist",
    "~/Library/Saved Application State/com.unfetch.app.savedState",
  ]
end
