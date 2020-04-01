// Copyright 2019 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.8

package xorm

import "context"

// Context creates a session with the context
func (engine *Engine) Context(ctx context.Context) *Session {
	session := engine.NewSession()
	session.isAutoClose = true
	return session.Context(ctx)
}

// SetDefaultContext set the default context
func (engine *Engine) SetDefaultContext(ctx context.Context) {
	engine.defaultContext = ctx
}

// PingContext tests if database is alive
func (engine *Engine) PingContext(ctx context.Context) error {
	session := engine.NewSession()
	defer session.Close()
	return session.PingContext(ctx)
}
