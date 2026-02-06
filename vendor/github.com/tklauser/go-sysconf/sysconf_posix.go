// Copyright 2018 Tobias Klauser. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

//go:build darwin || dragonfly || freebsd || linux || openbsd

package sysconf

func sysconfPOSIX(name int) (int64, error) {
	switch name {
	case SC_ADVISORY_INFO:
		return _POSIX_ADVISORY_INFO, nil
	case SC_ASYNCHRONOUS_IO:
		return _POSIX_ASYNCHRONOUS_IO, nil
	case SC_BARRIERS:
		return _POSIX_BARRIERS, nil
	case SC_CLOCK_SELECTION:
		return _POSIX_CLOCK_SELECTION, nil
	case SC_CPUTIME:
		return _POSIX_CPUTIME, nil
	case SC_FSYNC:
		return _POSIX_FSYNC, nil
	case SC_IPV6:
		return _POSIX_IPV6, nil
	case SC_JOB_CONTROL:
		return _POSIX_JOB_CONTROL, nil
	case SC_MAPPED_FILES:
		return _POSIX_MAPPED_FILES, nil
	case SC_MEMLOCK:
		return _POSIX_MEMLOCK, nil
	case SC_MEMLOCK_RANGE:
		return _POSIX_MEMLOCK_RANGE, nil
	case SC_MONOTONIC_CLOCK:
		return _POSIX_MONOTONIC_CLOCK, nil
	case SC_MEMORY_PROTECTION:
		return _POSIX_MEMORY_PROTECTION, nil
	case SC_MESSAGE_PASSING:
		return _POSIX_MESSAGE_PASSING, nil
	case SC_PRIORITIZED_IO:
		return _POSIX_PRIORITIZED_IO, nil
	case SC_PRIORITY_SCHEDULING:
		return _POSIX_PRIORITY_SCHEDULING, nil
	case SC_RAW_SOCKETS:
		return _POSIX_RAW_SOCKETS, nil
	case SC_READER_WRITER_LOCKS:
		return _POSIX_READER_WRITER_LOCKS, nil
	case SC_REALTIME_SIGNALS:
		return _POSIX_REALTIME_SIGNALS, nil
	case SC_REGEXP:
		return _POSIX_REGEXP, nil
	case SC_SEMAPHORES:
		return _POSIX_SEMAPHORES, nil
	case SC_SHARED_MEMORY_OBJECTS:
		return _POSIX_SHARED_MEMORY_OBJECTS, nil
	case SC_SHELL:
		return _POSIX_SHELL, nil
	case SC_THREADS:
		return _POSIX_THREADS, nil
	case SC_TIMEOUTS:
		return _POSIX_TIMEOUTS, nil
	case SC_TIMERS:
		return _POSIX_TIMERS, nil
	case SC_VERSION:
		return _POSIX_VERSION, nil

	case SC_2_C_BIND:
		return _POSIX2_C_BIND, nil
	case SC_2_C_DEV:
		return _POSIX2_C_DEV, nil
	case SC_2_FORT_DEV:
		return -1, nil
	case SC_2_FORT_RUN:
		return -1, nil
	case SC_2_LOCALEDEF:
		return _POSIX2_LOCALEDEF, nil
	case SC_2_SW_DEV:
		return _POSIX2_SW_DEV, nil
	case SC_2_VERSION:
		return _POSIX2_VERSION, nil
	}
	return -1, errInvalid
}
