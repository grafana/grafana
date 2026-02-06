// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

//go:build !linux

package plugincontainer

import (
	"os/exec"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin/runner"
)

// NewContainerRunner must be passed a cmd that hasn't yet been started.
func (cfg *Config) NewContainerRunner(_ hclog.Logger, _ *exec.Cmd, _ string) (runner.Runner, error) {
	return nil, errUnsupportedOS
}
