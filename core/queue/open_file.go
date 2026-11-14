//go:build !windows

package queue

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// playInUnflick 优先调用 unflick play <file> 播放已下载的文件
func playInUnflick(filePath string) error {
	if unflickPath, err := exec.LookPath("unflick"); err == nil {
		return exec.Command(unflickPath, "play", filePath).Start()
	}
	home, _ := os.UserHomeDir()
	candidates := []string{
		filepath.Join(home, ".local", "bin", "unflick"),
		"/usr/local/bin/unflick",
		"/opt/homebrew/bin/unflick",
		"/Applications/Unflick.app/Contents/MacOS/unflick",
		"/Applications/unflick.app/Contents/MacOS/unflick",
	}
	for _, p := range candidates {
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return exec.Command(p, "play", filePath).Start()
		}
	}
	return os.ErrNotExist
}

func openFile(path string) {
	if err := playInUnflick(path); err == nil {
		return
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", path)
	} else {
		cmd = exec.Command("xdg-open", path)
	}
	_ = cmd.Start()
}
