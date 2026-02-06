// Go support for leveled logs, analogous to https://github.com/google/glog.
//
// Copyright 2023 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build (unix || windows) && !linux

package glog

import (
	"os"
	"syscall"
	"time"
)

// abortProcess attempts to kill the current process in a way that will dump the
// currently-running goroutines someplace useful (like stderr).
//
// It does this by sending SIGABRT to the current process. Unfortunately, the
// signal may or may not be delivered to the current thread; in order to do that
// portably, we would need to add a cgo dependency and call pthread_kill.
//
// If successful, abortProcess does not return.
func abortProcess() error {
	p, err := os.FindProcess(os.Getpid())
	if err != nil {
		return err
	}
	if err := p.Signal(syscall.SIGABRT); err != nil {
		return err
	}

	// Sent the signal.  Now we wait for it to arrive and any SIGABRT handlers to
	// run (and eventually terminate the process themselves).
	//
	// We could just "select{}" here, but there's an outside chance that would
	// trigger the runtime's deadlock detector if there happen not to be any
	// background goroutines running.  So we'll sleep a while first to give
	// the signal some time.
	time.Sleep(10 * time.Second)
	select {}
}
