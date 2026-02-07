// Copyright 2018 Tobias Klauser. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sysconf

import (
	"sync"

	"golang.org/x/sys/unix"
)

const (
	_HOST_NAME_MAX  = _MAXHOSTNAMELEN
	_LOGIN_NAME_MAX = _MAXLOGNAME + 1
	_SYMLOOP_MAX    = _MAXSYMLINKS

	_POSIX2_C_BIND    = 1
	_POSIX2_C_DEV     = -1
	_POSIX2_CHAR_TERM = -1
	_POSIX2_FORT_DEV  = -1
	_POSIX2_FORT_RUN  = -1
	_POSIX2_LOCALEDEF = -1
	_POSIX2_SW_DEV    = -1
	_POSIX2_UPE       = -1
)

var clktck struct {
	sync.Once
	v int64
}

func sysconfPOSIX(name int) (int64, error) {
	// NetBSD does not define all _POSIX_* values used in sysconf_posix.go
	// The supported ones are handled in sysconf below.
	return -1, errInvalid
}

func sysconf(name int) (int64, error) {
	// NetBSD uses sysctl to get some of these values. For the user.* namespace,
	// calls get handled by user_sysctl in /usr/src/lib/libc/gen/sysctl.c
	// Duplicate the relevant values here.

	switch name {
	// 1003.1
	case SC_ARG_MAX:
		return sysctl32("kern.argmax"), nil
	case SC_CHILD_MAX:
		var rlim unix.Rlimit
		if err := unix.Getrlimit(unix.RLIMIT_NPROC, &rlim); err == nil {
			if rlim.Cur != unix.RLIM_INFINITY {
				return int64(rlim.Cur), nil
			}
		}
		return -1, nil
	case SC_CLK_TCK:
		// TODO: use sync.OnceValue once Go 1.21 is the minimal supported version
		clktck.Do(func() {
			clktck.v = -1
			if ci, err := unix.SysctlClockinfo("kern.clockrate"); err == nil {
				clktck.v = int64(ci.Hz)
			}
		})
		return clktck.v, nil
	case SC_NGROUPS_MAX:
		return sysctl32("kern.ngroups"), nil
	case SC_JOB_CONTROL:
		return sysctl32("kern.job_control"), nil
	case SC_OPEN_MAX:
		var rlim unix.Rlimit
		if err := unix.Getrlimit(unix.RLIMIT_NOFILE, &rlim); err == nil {
			return int64(rlim.Cur), nil
		}
		return -1, nil
	case SC_STREAM_MAX:
		// sysctl("user.stream_max")
		return _FOPEN_MAX, nil
	case SC_TZNAME_MAX:
		// sysctl("user.tzname_max")
		return _NAME_MAX, nil
	case SC_SAVED_IDS:
		return yesno(sysctl32("kern.saved_ids")), nil
	case SC_VERSION:
		return sysctl32("kern.posix1version"), nil

	// 1003.1b
	case SC_FSYNC:
		return sysctl32("kern.fsync"), nil
	case SC_SYNCHRONIZED_IO:
		return sysctl32("kern.synchronized_io"), nil
	case SC_MAPPED_FILES:
		return sysctl32("kern.mapped_files"), nil
	case SC_MEMLOCK:
		return sysctl32("kern.memlock"), nil
	case SC_MEMLOCK_RANGE:
		return sysctl32("kern.memlock_range"), nil
	case SC_MEMORY_PROTECTION:
		return sysctl32("kern.memory_protection"), nil
	case SC_MONOTONIC_CLOCK:
		return sysctl32("kern.monotonic_clock"), nil
	case SC_SEMAPHORES:
		return sysctl32("kern.posix_semaphores"), nil
	case SC_TIMERS:
		return sysctl32("kern.posix_timers"), nil

	// 1003.1c
	case SC_LOGIN_NAME_MAX:
		return sysctl32("kern.login_name_max"), nil
	case SC_THREADS:
		return sysctl32("kern.posix_threads"), nil

	// 1003.1j
	case SC_BARRIERS:
		return yesno(sysctl32("kern.posix_barriers")), nil
	case SC_SPIN_LOCKS:
		return yesno(sysctl32("kern.posix_spin_locks")), nil
	case SC_READER_WRITER_LOCKS:
		return yesno(sysctl32("kern.posix_reader_writer_locks")), nil

	// 1003.2
	case SC_2_VERSION:
		// sysctl user.posix2_version
		return _POSIX2_VERSION, nil
	case SC_2_C_BIND:
		// sysctl user.posix2_c_bind
		return _POSIX2_C_BIND, nil
	case SC_2_C_DEV:
		// sysctl user.posix2_c_dev
		return _POSIX2_C_DEV, nil
	case SC_2_CHAR_TERM:
		// sysctl user.posix2_char_term
		return _POSIX2_CHAR_TERM, nil
	case SC_2_FORT_DEV:
		// sysctl user.posix2_fort_dev
		return _POSIX2_FORT_DEV, nil
	case SC_2_FORT_RUN:
		// sysctl user.posix2_fort_run
		return _POSIX2_FORT_RUN, nil
	case SC_2_LOCALEDEF:
		// sysctl user.posix2_localedef
		return _POSIX2_LOCALEDEF, nil
	case SC_2_SW_DEV:
		// sysctl user.posix2_sw_dev
		return _POSIX2_SW_DEV, nil
	case SC_2_UPE:
		// sysctl user.posix2_upe
		return _POSIX2_UPE, nil

	// XPG 4.2
	case SC_IOV_MAX:
		return sysctl32("kern.iov_max"), nil
	case SC_XOPEN_SHM:
		return yesno(sysctl32("kern.ipc.sysvshm")), nil

	// 1003.1-2001, XSI Option Group
	case SC_AIO_LISTIO_MAX:
		return sysctl32("kern.aio_listio_max"), nil
	case SC_AIO_MAX:
		return sysctl32("kern.aio_max"), nil
	case SC_ASYNCHRONOUS_IO:
		return yesno(sysctl32("kern.posix_aio")), nil
	case SC_MESSAGE_PASSING:
		return yesno(sysctl32("kern.posix_msg")), nil
	case SC_MQ_OPEN_MAX:
		return sysctl32("kern.mqueue.mq_open_max"), nil
	case SC_MQ_PRIO_MAX:
		return sysctl32("kern.mqueue.mq_prio_max"), nil
	case SC_PRIORITY_SCHEDULING:
		return yesno(sysctl32("kern.posix_sched")), nil
	case SC_ATEXIT_MAX:
		// sysctl("user.atexit_max")
		return -1, nil // TODO

	// 1003.1-2001, TSF
	case SC_GETGR_R_SIZE_MAX:
		return _GETGR_R_SIZE_MAX, nil
	case SC_GETPW_R_SIZE_MAX:
		return _GETPW_R_SIZE_MAX, nil

	// Unsorted
	case SC_HOST_NAME_MAX:
		return _MAXHOSTNAMELEN, nil
	case SC_PASS_MAX:
		return _PASSWORD_LEN, nil
	case SC_REGEXP:
		return _POSIX_REGEXP, nil
	case SC_SHARED_MEMORY_OBJECTS:
		return _POSIX_SHARED_MEMORY_OBJECTS, nil
	case SC_SHELL:
		return _POSIX_SHELL, nil
	case SC_SPAWN:
		return _POSIX_SPAWN, nil

	// Extensions
	case SC_NPROCESSORS_CONF:
		return sysctl32("hw.ncpu"), nil
	case SC_NPROCESSORS_ONLN:
		return sysctl32("hw.ncpuonline"), nil

	// Linux/Solaris
	case SC_PHYS_PAGES:
		return sysctl64("hw.physmem64") / int64(unix.Getpagesize()), nil

	// Native
	case SC_SCHED_RT_TS:
		return sysctl32("kern.sched.rtts"), nil
	case SC_SCHED_PRI_MIN:
		return sysctl32("kern.sched.pri_min"), nil
	case SC_SCHED_PRI_MAX:
		return sysctl32("kern.sched.pri_max"), nil
	case SC_THREAD_DESTRUCTOR_ITERATIONS:
		return _POSIX_THREAD_DESTRUCTOR_ITERATIONS, nil
	case SC_THREAD_KEYS_MAX:
		return _POSIX_THREAD_KEYS_MAX, nil
	case SC_THREAD_STACK_MIN:
		return int64(unix.Getpagesize()), nil
	case SC_THREAD_THREADS_MAX:
		return sysctl32("kern.maxproc"), nil
	case SC_THREAD_ATTR_STACKADDR:
		return _POSIX_THREAD_ATTR_STACKADDR, nil
	case SC_THREAD_ATTR_STACKSIZE:
		return _POSIX_THREAD_ATTR_STACKSIZE, nil
	case SC_THREAD_SAFE_FUNCTIONS:
		return _POSIX_THREAD_SAFE_FUNCTIONS, nil
	case SC_THREAD_PRIO_PROTECT:
		return _POSIX_THREAD_PRIO_PROTECT, nil
	case SC_THREAD_PRIORITY_SCHEDULING,
		SC_THREAD_PRIO_INHERIT,
		SC_THREAD_PROCESS_SHARED:
		return -1, nil
	case SC_TTY_NAME_MAX:
		return pathconf(_PATH_DEV, _PC_NAME_MAX), nil
	case SC_TIMER_MAX:
		return _POSIX_TIMER_MAX, nil
	case SC_SEM_NSEMS_MAX:
		return _LONG_MAX, nil
	case SC_CPUTIME:
		return _POSIX_CPUTIME, nil
	case SC_THREAD_CPUTIME:
		return _POSIX_THREAD_CPUTIME, nil
	case SC_DELAYTIMER_MAX:
		return _POSIX_DELAYTIMER_MAX, nil
	case SC_SIGQUEUE_MAX:
		return _POSIX_SIGQUEUE_MAX, nil
	case SC_REALTIME_SIGNALS:
		return 200112, nil
	}

	return sysconfGeneric(name)
}
