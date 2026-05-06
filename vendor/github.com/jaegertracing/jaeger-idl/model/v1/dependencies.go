// Copyright (c) 2019 The Jaeger Authors.
// Copyright (c) 2017 Uber Technologies, Inc.
// SPDX-License-Identifier: Apache-2.0

package model

const (
	// JaegerDependencyLinkSource describes a dependency diagram that was generated from Jaeger traces.
	JaegerDependencyLinkSource = "jaeger"
)

// ApplyDefaults applies defaults to the DependencyLink.
func (d DependencyLink) ApplyDefaults() DependencyLink {
	dd := d
	if dd.Source == "" {
		dd.Source = JaegerDependencyLinkSource
	}
	return dd
}
