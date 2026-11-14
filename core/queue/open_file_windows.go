package queue

import "os/exec"

func playInUnflick(filePath string) error {
	unflickPath, err := exec.LookPath("unflick.exe")
	if err != nil {
		return err
	}
	return exec.Command(unflickPath, "play", filePath).Start()
}

func openFile(path string) {
	if err := playInUnflick(path); err == nil {
		return
	}
	cmd := exec.Command("cmd", "/c", "start", "", path)
	_ = cmd.Start()
}
