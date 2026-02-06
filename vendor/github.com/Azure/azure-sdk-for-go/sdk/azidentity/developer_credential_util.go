//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

package azidentity

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// cliTimeout is the default timeout for authentication attempts via CLI tools
const cliTimeout = 10 * time.Second

// executor runs a command and returns its output or an error
type executor func(ctx context.Context, credName, command string) ([]byte, error)

var shellExec = func(ctx context.Context, credName, command string) ([]byte, error) {
	// set a default timeout for this authentication iff the caller hasn't done so already
	var cancel context.CancelFunc
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		ctx, cancel = context.WithTimeout(ctx, cliTimeout)
		defer cancel()
	}
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		dir := os.Getenv("SYSTEMROOT")
		if dir == "" {
			return nil, newCredentialUnavailableError(credName, `environment variable "SYSTEMROOT" has no value`)
		}
		cmd = exec.CommandContext(ctx, "cmd.exe", "/c", command)
		cmd.Dir = dir
	} else {
		cmd = exec.CommandContext(ctx, "/bin/sh", "-c", command)
		cmd.Dir = "/bin"
	}
	cmd.Env = os.Environ()
	stderr := bytes.Buffer{}
	cmd.Stderr = &stderr
	cmd.WaitDelay = 100 * time.Millisecond

	stdout, err := cmd.Output()
	if errors.Is(err, exec.ErrWaitDelay) && len(stdout) > 0 {
		// The child process wrote to stdout and exited without closing it.
		// Swallow this error and return stdout because it may contain a token.
		return stdout, nil
	}
	if err != nil {
		msg := stderr.String()
		var exErr *exec.ExitError
		if errors.As(err, &exErr) && exErr.ExitCode() == 127 || strings.Contains(msg, "' is not recognized") {
			return nil, newCredentialUnavailableError(credName, "CLI executable not found on path")
		}
		if msg == "" {
			msg = err.Error()
		}
		return nil, newAuthenticationFailedError(credName, msg, nil)
	}

	return stdout, nil
}

// unavailableIfInDAC returns err or, if the credential was invoked by DefaultAzureCredential, a
// credentialUnavailableError having the same message. This ensures DefaultAzureCredential will try
// the next credential in its chain (another developer credential).
func unavailableIfInDAC(err error, inDefaultChain bool) error {
	if err != nil && inDefaultChain && !errors.As(err, new(credentialUnavailable)) {
		err = NewCredentialUnavailableError(err.Error())
	}
	return err
}

// validScope is for credentials authenticating via external tools. The authority validates scopes for all other credentials.
func validScope(scope string) bool {
	for _, r := range scope {
		if !(alphanumeric(r) || r == '.' || r == '-' || r == '_' || r == '/' || r == ':') {
			return false
		}
	}
	return true
}
