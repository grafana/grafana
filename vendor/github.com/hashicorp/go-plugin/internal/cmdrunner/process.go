// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package cmdrunner

import "time"

// pidAlive checks whether a pid is alive.
func pidAlive(pid int) bool {
	return _pidAlive(pid)
}

// pidWait blocks for a process to exit.
func pidWait(pid int) error {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if !pidAlive(pid) {
			break
		}
	}

	return nil
}
