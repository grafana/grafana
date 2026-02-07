//go:build dragonfly || freebsd || windows || plan9
// +build dragonfly freebsd windows plan9

/*
 * SPDX-FileCopyrightText: © Hypermode Inc. <hello@hypermode.com>
 * SPDX-License-Identifier: Apache-2.0
 */

package y

import "syscall"

func init() {
	datasyncFileFlag = syscall.O_SYNC
}
