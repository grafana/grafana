// Copyright 2020 The Libc Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package signal

const (
	//	/usr/include/asm-generic/signal-defs.h:24:#define SIG_DFL	((__sighandler_t)0)	/* default signal handling */
	SIG_DFL = 0
	//	/usr/include/asm-generic/signal-defs.h:25:#define SIG_IGN	((__sighandler_t)1)	/* ignore signal */
	SIG_IGN = 1
)
