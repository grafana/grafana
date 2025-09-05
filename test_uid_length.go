package main

import (
	"fmt"

	"github.com/grafana/grafana/pkg/util"
)

func main() {
	for i := 0; i < 5; i++ {
		uid := util.GenerateShortUID()
		fmt.Printf("UID: %s (length: %d)\n", uid, len(uid))
	}

	// Test our function
	baseName := "test-notification-settings"
	fmt.Printf("Base name: %s (length: %d)\n", baseName, len(baseName))

	// Simulate our function
	shortUID := util.GenerateShortUID()
	maxBaseLength := 30
	if len(baseName) > maxBaseLength {
		baseName = baseName[:maxBaseLength]
	}
	result := fmt.Sprintf("%s_%s", baseName, shortUID)
	fmt.Printf("Generated UID: %s (length: %d)\n", result, len(result))
}
