/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package y

import "golang.org/x/net/trace"

var (
	NoEventLog trace.EventLog = nilEventLog{}
)

type nilEventLog struct{}

func (nel nilEventLog) Printf(format string, a ...interface{}) {}

func (nel nilEventLog) Errorf(format string, a ...interface{}) {}

func (nel nilEventLog) Finish() {}
