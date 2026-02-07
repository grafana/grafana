// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package signal

const (
	// sys/sys/signal.h:139:#define	SIG_DFL		((__sighandler_t *)0)
	SIG_DFL = 0
	// sys/sys/signal.h:140:#define	SIG_IGN		((__sighandler_t *)1)
	SIG_IGN = 1
)
