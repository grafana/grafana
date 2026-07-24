package main

import (
	"fmt"
	"os"
	"os/exec"
	"sync"

	amtests "github.com/grafana/grafana/pkg/tests/alertmanager"
)

func docker(args []string) {
	cmd := exec.Command("docker", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		fmt.Printf("docker %v failed: %v\n", args[0], err)
		os.Exit(1)
	}
}

func main() {
	var wg sync.WaitGroup

	for _, c := range [][]string{
		{"pull", amtests.GetGrafanaImage()},
		{"pull", amtests.GetLokiImage()},
		{"pull", amtests.GetPostgresImage()},
		{"build", "-t", "webhook-receiver", "devenv/docker/blocks/stateful_webhook"},
	} {
		wg.Add(1)

		go func(cmd []string) {
			defer wg.Done()
			docker(cmd)
		}(c)
	}

	wg.Wait()
}
