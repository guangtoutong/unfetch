//go:build !windows

package queue

import "os/exec"

func openFile(path string) {
	cmd := exec.Command("xdg-open", path)
	_ = cmd.Start()
}
