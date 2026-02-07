// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0
//go:build !linux

package plugincontainer

import (
	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin/runner"
)

func ReattachFunc(logger hclog.Logger, id, hostSocketDir string) (runner.AttachedRunner, error) {
	return nil, errUnsupportedOS
}
