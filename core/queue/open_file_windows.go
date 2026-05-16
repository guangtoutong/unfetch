package queue

import "os/exec"

func openFile(path string) {
	cmd := exec.Command("cmd", "/c", "start", "", path)
	_ = cmd.Start()
}
