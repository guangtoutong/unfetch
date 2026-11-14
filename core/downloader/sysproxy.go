//go:build !windows

package downloader

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// ReadSystemProxy returns the system-level proxy URL, or "" if none is configured.
func ReadSystemProxy() string {
	for _, k := range []string{"HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY",
		"https_proxy", "http_proxy", "all_proxy"} {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
	}
	if runtime.GOOS == "darwin" {
		if v := readMacOSSystemProxy(); v != "" {
			return v
		}
	}
	return ""
}

func readMacOSSystemProxy() string {
	out, err := exec.Command("scutil", "--proxy").Output()
	if err != nil {
		return ""
	}
	kv := parseScutilProxy(string(out))
	if kv["HTTPSEnable"] == "1" && kv["HTTPSProxy"] != "" && kv["HTTPSPort"] != "" {
		return fmt.Sprintf("http://%s:%s", kv["HTTPSProxy"], kv["HTTPSPort"])
	}
	if kv["HTTPEnable"] == "1" && kv["HTTPProxy"] != "" && kv["HTTPPort"] != "" {
		return fmt.Sprintf("http://%s:%s", kv["HTTPProxy"], kv["HTTPPort"])
	}
	if kv["SOCKSEnable"] == "1" && kv["SOCKSProxy"] != "" && kv["SOCKSPort"] != "" {
		return fmt.Sprintf("socks5://%s:%s", kv["SOCKSProxy"], kv["SOCKSPort"])
	}
	return ""
}

func parseScutilProxy(raw string) map[string]string {
	res := make(map[string]string)
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		idx := strings.Index(line, ":")
		if idx <= 0 {
			continue
		}
		k := strings.TrimSpace(line[:idx])
		v := strings.TrimSpace(line[idx+1:])
		if k != "" && v != "" {
			res[k] = v
		}
	}
	return res
}
