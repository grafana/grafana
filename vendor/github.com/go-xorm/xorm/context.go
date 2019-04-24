// Copyright 2017 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build go1.8

package xorm

import "context"

// PingContext tests if database is alive
func (engine *Engine) PingContext(ctx context.Context) error {
	session := engine.NewSession()
	defer session.Close()
	return session.PingContext(ctx)
}

// PingContext test if database is ok
func (session *Session) PingContext(ctx context.Context) error {
	if session.isAutoClose {
		defer session.Close()
	}

	session.engine.logger.Infof("PING DATABASE %v", session.engine.DriverName())
	return session.DB().PingContext(ctx)
}
