package api

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"unfetch/core/queue"
	"unfetch/core/types"
)

func TestFullAPIRegression(t *testing.T) {
	// 1. 启动支持 Range 分片与 Header 校验的本地 HTTP 文件源服务器
	content := bytes.Repeat([]byte("unfetch-regression-test-chunk-data-0123456789abcdef\n"), 2048)
	sum := sha256.Sum256(content)
	expectedSHA := hex.EncodeToString(sum[:])

	var receivedUA string
	var receivedCustomHeader string
	fileSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedUA = r.Header.Get("User-Agent")
		receivedCustomHeader = r.Header.Get("X-Unfetch-Test")
		http.ServeContent(w, r, "sample.bin", time.Now(), bytes.NewReader(content))
	}))
	defer fileSrv.Close()

	// 2. 初始化临时下载目录与配置（含 TaskTemplate）
	tmpDir := t.TempDir()
	cfg := &types.Config{
		DownloadDir:   tmpDir,
		MaxConcurrent: 3,
		HTTPThreads:   4,
		AutoRetry:     true,
		MaxRetries:    2,
		TaskTemplates: []types.TaskTemplate{
			{
				Name:      "corp-mirror",
				UserAgent: "UnfetchRegressionBot/2.0",
				Cookies:   "sid=reg_test_cookie",
				Headers:   map[string]string{"X-Unfetch-Test": "template-ok"},
			},
		},
	}

	mgr, err := queue.NewManager(cfg, func(c *types.Config) error { return nil })
	if err != nil {
		t.Fatalf("NewManager failed: %v", err)
	}
	defer mgr.Shutdown()

	router := NewRouter(mgr, cfg, func(c *types.Config) error { return nil })
	apiSrv := httptest.NewServer(router)
	defer apiSrv.Close()

	// 3. 测试 GET /health
	resp, err := http.Get(apiSrv.URL + "/health")
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("GET /health failed: status=%v err=%v", resp, err)
	}
	resp.Body.Close()

	// 4. 测试 URL 协议探测函数
	cases := map[string]types.TaskType{
		"https://example.com/a.zip":                   types.TaskTypeHTTP,
		"https://cdn.example.com/live/index.m3u8?k=1": types.TaskTypeHLS,
		"ftp://ftp.gnu.org/gnu/hello.tar.gz":          types.TaskTypeFTP,
		"sftp://root@10.0.0.1/data/db.sql":            types.TaskTypeFTP,
		"ed2k://|file|test.iso|1024|abcdef|/|":        types.TaskTypeEd2k,
		"magnet:?xt=urn:btih:123456":                  types.TaskTypeBT,
	}
	if !types.AppStoreEdition {
		cases["https://www.youtube.com/watch?v=123"] = types.TaskTypeYtdlp
	}
	for u, want := range cases {
		if got := detectURLType(u); got != want {
			t.Errorf("detectURLType(%q) = %s, want %s", u, got, want)
		}
	}

	// 5. 测试 POST /tasks（使用模板 + SHA256 校验）
	addBody, _ := json.Marshal(types.AddTaskRequest{
		URL:            fileSrv.URL + "/sample.bin",
		SaveDir:        tmpDir,
		Filename:       "reg_sample.bin",
		Threads:        4,
		Template:       "corp-mirror",
		ExpectedSHA256: expectedSHA,
	})
	resp, err = http.Post(apiSrv.URL+"/tasks", "application/json", bytes.NewReader(addBody))
	if err != nil || resp.StatusCode != http.StatusCreated {
		t.Fatalf("POST /tasks failed: status=%v err=%v", resp, err)
	}
	var created types.Task
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	// 6. 轮询 GET /tasks/{id} 等待下载完成
	deadline := time.Now().Add(10 * time.Second)
	var finalTask types.Task
	for time.Now().Before(deadline) {
		r, err := http.Get(fmt.Sprintf("%s/tasks/%s", apiSrv.URL, created.ID))
		if err != nil {
			t.Fatal(err)
		}
		_ = json.NewDecoder(r.Body).Decode(&finalTask)
		r.Body.Close()
		if finalTask.Status == types.StatusDone || finalTask.Status == types.StatusError {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}

	if finalTask.Status != types.StatusDone {
		t.Fatalf("task did not finish: status=%s err=%s", finalTask.Status, finalTask.Error)
	}
	if finalTask.ActualSHA256 != expectedSHA {
		t.Errorf("ActualSHA256 = %s, want %s", finalTask.ActualSHA256, expectedSHA)
	}
	if receivedUA != "UnfetchRegressionBot/2.0" {
		t.Errorf("template User-Agent not applied: got %q", receivedUA)
	}
	if receivedCustomHeader != "template-ok" {
		t.Errorf("template Header not applied: got %q", receivedCustomHeader)
	}

	// 7. 验证落盘文件内容
	savedBytes, err := os.ReadFile(filepath.Join(tmpDir, "reg_sample.bin"))
	if err != nil || !bytes.Equal(savedBytes, content) {
		t.Fatalf("saved file mismatch: err=%v len=%d", err, len(savedBytes))
	}

	// 8. 测试 Trash -> Restore -> Delete 完整生命周期
	req, _ := http.NewRequest(http.MethodPatch, fmt.Sprintf("%s/tasks/%s/trash", apiSrv.URL, created.ID), nil)
	r, err := http.DefaultClient.Do(req)
	if err != nil || r.StatusCode != http.StatusOK {
		t.Fatalf("trash failed: %v", err)
	}
	r.Body.Close()

	req, _ = http.NewRequest(http.MethodPatch, fmt.Sprintf("%s/tasks/%s/restore", apiSrv.URL, created.ID), nil)
	r, err = http.DefaultClient.Do(req)
	if err != nil || r.StatusCode != http.StatusOK {
		t.Fatalf("restore failed: %v", err)
	}
	r.Body.Close()

	req, _ = http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/tasks/%s?delete_file=true", apiSrv.URL, created.ID), nil)
	r, err = http.DefaultClient.Do(req)
	if err != nil || r.StatusCode != http.StatusNoContent {
		t.Fatalf("delete failed: %v", err)
	}
	r.Body.Close()
}
