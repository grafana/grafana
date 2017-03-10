package redis_test

import (
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"text/template"
	"time"

	"gopkg.in/redis.v2"
)

func startRedis(port string) (*exec.Cmd, error) {
	cmd := exec.Command("redis-server", "--port", port)
	if false {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
}

func startRedisSlave(port, slave string) (*exec.Cmd, error) {
	cmd := exec.Command("redis-server", "--port", port, "--slaveof", "127.0.0.1", slave)
	if false {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	return cmd, nil
}

func startRedisSentinel(port, masterName, masterPort string) (*exec.Cmd, error) {
	dir, err := ioutil.TempDir("", "sentinel")
	if err != nil {
		return nil, err
	}

	sentinelConfFilepath := filepath.Join(dir, "sentinel.conf")
	tpl, err := template.New("sentinel.conf").Parse(sentinelConf)
	if err != nil {
		return nil, err
	}

	data := struct {
		Port       string
		MasterName string
		MasterPort string
	}{
		Port:       port,
		MasterName: masterName,
		MasterPort: masterPort,
	}
	if err := writeTemplateToFile(sentinelConfFilepath, tpl, data); err != nil {
		return nil, err
	}

	cmd := exec.Command("redis-server", sentinelConfFilepath, "--sentinel")
	if true {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	return cmd, nil
}

func writeTemplateToFile(path string, t *template.Template, data interface{}) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return t.Execute(f, data)
}

func TestSentinel(t *testing.T) {
	masterName := "mymaster"
	masterPort := "8123"
	slavePort := "8124"
	sentinelPort := "8125"

	masterCmd, err := startRedis(masterPort)
	if err != nil {
		t.Fatal(err)
	}
	defer masterCmd.Process.Kill()

	// Wait for master to start.
	time.Sleep(200 * time.Millisecond)

	master := redis.NewTCPClient(&redis.Options{
		Addr: ":" + masterPort,
	})
	if err := master.Ping().Err(); err != nil {
		t.Fatal(err)
	}

	slaveCmd, err := startRedisSlave(slavePort, masterPort)
	if err != nil {
		t.Fatal(err)
	}
	defer slaveCmd.Process.Kill()

	// Wait for slave to start.
	time.Sleep(200 * time.Millisecond)

	slave := redis.NewTCPClient(&redis.Options{
		Addr: ":" + slavePort,
	})
	if err := slave.Ping().Err(); err != nil {
		t.Fatal(err)
	}

	sentinelCmd, err := startRedisSentinel(sentinelPort, masterName, masterPort)
	if err != nil {
		t.Fatal(err)
	}
	defer sentinelCmd.Process.Kill()

	// Wait for sentinel to start.
	time.Sleep(200 * time.Millisecond)

	sentinel := redis.NewTCPClient(&redis.Options{
		Addr: ":" + sentinelPort,
	})
	if err := sentinel.Ping().Err(); err != nil {
		t.Fatal(err)
	}
	defer sentinel.Shutdown()

	client := redis.NewFailoverClient(&redis.FailoverOptions{
		MasterName:    masterName,
		SentinelAddrs: []string{":" + sentinelPort},
	})

	if err := client.Set("foo", "master").Err(); err != nil {
		t.Fatal(err)
	}

	val, err := master.Get("foo").Result()
	if err != nil {
		t.Fatal(err)
	}
	if val != "master" {
		t.Fatalf(`got %q, expected "master"`, val)
	}

	// Kill Redis master.
	if err := masterCmd.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	if err := master.Ping().Err(); err == nil {
		t.Fatalf("master was not killed")
	}

	// Wait for Redis sentinel to elect new master.
	time.Sleep(5 * time.Second)

	// Check that client picked up new master.
	val, err = client.Get("foo").Result()
	if err != nil {
		t.Fatal(err)
	}
	if val != "master" {
		t.Fatalf(`got %q, expected "master"`, val)
	}
}

var sentinelConf = `
port {{ .Port }}

sentinel monitor {{ .MasterName }} 127.0.0.1 {{ .MasterPort }} 1
sentinel down-after-milliseconds {{ .MasterName }} 1000
sentinel failover-timeout {{ .MasterName }} 2000
sentinel parallel-syncs {{ .MasterName }} 1
`
