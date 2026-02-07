// Copyright 2018 Tobias Klauser. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sysconf

import "golang.org/x/sys/unix"

// sysconf implements sysconf(3) as in the OpenBSD 6.3 libc.
func sysconf(name int) (int64, error) {
	switch name {
	case SC_AIO_LISTIO_MAX,
		SC_AIO_MAX,
		SC_AIO_PRIO_DELTA_MAX:
		return -1, nil
	case SC_ARG_MAX:
		return sysctl32("kern.argmax"), nil
	case SC_ATEXIT_MAX:
		return -1, nil
	case SC_CHILD_MAX:
		var rlim unix.Rlimit
		if err := unix.Getrlimit(unix.RLIMIT_NPROC, &rlim); err == nil {
			if rlim.Cur != unix.RLIM_INFINITY {
				return int64(rlim.Cur), nil
			}
		}
		return -1, nil
	case SC_CLK_TCK:
		return _CLK_TCK, nil
	case SC_DELAYTIMER_MAX:
		return -1, nil
	case SC_GETGR_R_SIZE_MAX:
		return _GR_BUF_LEN, nil
	case SC_GETPW_R_SIZE_MAX:
		return _PW_BUF_LEN, nil
	case SC_IOV_MAX:
		return _IOV_MAX, nil
	case SC_LOGIN_NAME_MAX:
		return _LOGIN_NAME_MAX, nil
	case SC_NGROUPS_MAX:
		return sysctl32("kern.ngroups"), nil
	case SC_OPEN_MAX:
		var rlim unix.Rlimit
		if err := unix.Getrlimit(unix.RLIMIT_NOFILE, &rlim); err == nil {
			if rlim.Cur != unix.RLIM_INFINITY {
				return int64(rlim.Cur), nil
			}
		}
		return -1, nil
	case SC_SEM_NSEMS_MAX:
		return -1, nil
	case SC_SEM_VALUE_MAX:
		return _SEM_VALUE_MAX, nil
	case SC_SIGQUEUE_MAX:
		return -1, nil
	case SC_STREAM_MAX:
		var rlim unix.Rlimit
		if err := unix.Getrlimit(unix.RLIMIT_NOFILE, &rlim); err == nil {
			if rlim.Cur != unix.RLIM_INFINITY {
				if rlim.Cur > _SHRT_MAX {
					return _SHRT_MAX, nil
				}
				return int64(rlim.Cur), nil
			}
		}
		return -1, nil
	case SC_THREAD_DESTRUCTOR_ITERATIONS:
		return _PTHREAD_DESTRUCTOR_ITERATIONS, nil
	case SC_THREAD_KEYS_MAX:
		return _PTHREAD_KEYS_MAX, nil
	case SC_THREAD_STACK_MIN:
		return _PTHREAD_STACK_MIN, nil
	case SC_THREAD_THREADS_MAX:
		return -1, nil
	case SC_TIMER_MAX:
		return -1, nil
	case SC_TTY_NAME_MAX:
		return _TTY_NAME_MAX, nil
	case SC_TZNAME_MAX:
		return _NAME_MAX, nil

	case SC_BARRIERS:
		return _POSIX_BARRIERS, nil
	case SC_FSYNC:
		return _POSIX_FSYNC, nil
	case SC_IPV6:
		if _POSIX_IPV6 == 0 {
			fd, err := unix.Socket(unix.AF_INET6, unix.SOCK_DGRAM, 0)
			if err == nil && fd >= 0 {
				unix.Close(fd)
				return int64(200112), nil
			}
			return 0, nil
		}
		return _POSIX_IPV6, nil
	case SC_JOB_CONTROL:
		return _POSIX_JOB_CONTROL, nil
	case SC_MAPPED_FILES:
		return _POSIX_MAPPED_FILES, nil
	case SC_MONOTONIC_CLOCK:
		return _POSIX_MONOTONIC_CLOCK, nil
	case SC_SAVED_IDS:
		return _POSIX_SAVED_IDS, nil
	case SC_SEMAPHORES:
		return _POSIX_SEMAPHORES, nil
	case SC_SPAWN:
		return _POSIX_SPAWN, nil
	case SC_SPIN_LOCKS:
		return _POSIX_SPIN_LOCKS, nil
	case SC_SPORADIC_SERVER:
		return _POSIX_SPORADIC_SERVER, nil
	case SC_SYNCHRONIZED_IO:
		return _POSIX_SYNCHRONIZED_IO, nil
	case SC_THREAD_ATTR_STACKADDR:
		return _POSIX_THREAD_ATTR_STACKADDR, nil
	case SC_THREAD_ATTR_STACKSIZE:
		return _POSIX_THREAD_ATTR_STACKSIZE, nil
	case SC_THREAD_CPUTIME:
		return _POSIX_THREAD_CPUTIME, nil
	case SC_THREAD_PRIO_INHERIT:
		return _POSIX_THREAD_PRIO_INHERIT, nil
	case SC_THREAD_PRIO_PROTECT:
		return _POSIX_THREAD_PRIO_PROTECT, nil
	case SC_THREAD_PRIORITY_SCHEDULING:
		return _POSIX_THREAD_PRIORITY_SCHEDULING, nil
	case SC_THREAD_PROCESS_SHARED:
		return _POSIX_THREAD_PROCESS_SHARED, nil
	case SC_THREAD_ROBUST_PRIO_INHERIT:
		return _POSIX_THREAD_ROBUST_PRIO_INHERIT, nil
	case SC_THREAD_ROBUST_PRIO_PROTECT:
		return _POSIX_THREAD_ROBUST_PRIO_PROTECT, nil
	case SC_THREAD_SAFE_FUNCTIONS:
		return _POSIX_THREAD_SAFE_FUNCTIONS, nil
	case SC_THREAD_SPORADIC_SERVER:
		return _POSIX_THREAD_SPORADIC_SERVER, nil
	case SC_THREADS:
		return _POSIX_THREADS, nil
	case SC_TIMEOUTS:
		return _POSIX_TIMEOUTS, nil
	case SC_TIMERS:
		return _POSIX_TIMERS, nil
	case SC_TRACE,
		SC_TRACE_EVENT_FILTER,
		SC_TRACE_EVENT_NAME_MAX,
		SC_TRACE_INHERIT,
		SC_TRACE_LOG:
		return _POSIX_TRACE, nil
	case SC_TYPED_MEMORY_OBJECTS:
		return _POSIX_TYPED_MEMORY_OBJECTS, nil

	case SC_V7_ILP32_OFF32:
		return _POSIX_V7_ILP32_OFF32, nil
	case SC_V7_ILP32_OFFBIG:
		if _POSIX_V7_ILP32_OFFBIG == 0 {
			if unix.SizeofInt*_CHAR_BIT == 32 &&
				unix.SizeofLong*_CHAR_BIT == 32 &&
				unix.SizeofPtr*_CHAR_BIT == 32 &&
				sizeofOffT*_CHAR_BIT >= 64 {
				return 1, nil
			}
			return -1, nil
		}
		return _POSIX_V7_ILP32_OFFBIG, nil
	case SC_V7_LP64_OFF64:
		if _POSIX_V7_LP64_OFF64 == 0 {
			if unix.SizeofInt*_CHAR_BIT == 32 &&
				unix.SizeofLong*_CHAR_BIT == 64 &&
				unix.SizeofPtr*_CHAR_BIT == 64 &&
				sizeofOffT*_CHAR_BIT == 64 {
				return 1, nil
			}
			return -1, nil
		}
		return _POSIX_V7_LP64_OFF64, nil
	case SC_V7_LPBIG_OFFBIG:
		if _POSIX_V7_LPBIG_OFFBIG == 0 {
			if unix.SizeofInt*_CHAR_BIT >= 32 &&
				unix.SizeofLong*_CHAR_BIT >= 64 &&
				unix.SizeofPtr*_CHAR_BIT >= 64 &&
				sizeofOffT*_CHAR_BIT >= 64 {
				return 1, nil
			}
			return -1, nil
		}
		return _POSIX_V7_LPBIG_OFFBIG, nil

	case SC_V6_ILP32_OFF32:
		return _POSIX_V6_ILP32_OFF32, nil
	case SC_V6_ILP32_OFFBIG:
		if _POSIX_V6_ILP32_OFFBIG == 0 {
			if unix.SizeofInt*_CHAR_BIT == 32 &&
				unix.SizeofLong*_CHAR_BIT == 32 &&
				unix.SizeofPtr*_CHAR_BIT == 32 &&
				sizeofOffT*_CHAR_BIT >= 64 {
				return 1, nil
			}
			return -1, nil
		}
		return _POSIX_V6_ILP32_OFFBIG, nil
	case SC_V6_LP64_OFF64:
		if _POSIX_V6_LP64_OFF64 == 0 {
			if unix.SizeofInt*_CHAR_BIT == 32 &&
				unix.SizeofLong*_CHAR_BIT == 64 &&
				unix.SizeofPtr*_CHAR_BIT == 64 &&
				sizeofOffT*_CHAR_BIT == 64 {
				return 1, nil
			}
			return -1, nil
		}
		return _POSIX_V6_LP64_OFF64, nil
	case SC_V6_LPBIG_OFFBIG:
		if _POSIX_V6_LPBIG_OFFBIG == 0 {
			if unix.SizeofInt*_CHAR_BIT >= 32 &&
				unix.SizeofLong*_CHAR_BIT >= 64 &&
				unix.SizeofPtr*_CHAR_BIT >= 64 &&
				sizeofOffT*_CHAR_BIT >= 64 {
				return 1, nil
			}
			return -1, nil
		}
		return _POSIX_V6_LPBIG_OFFBIG, nil

	case SC_2_CHAR_TERM:
		return _POSIX2_CHAR_TERM, nil
	case SC_2_PBS,
		SC_2_PBS_ACCOUNTING,
		SC_2_PBS_CHECKPOINT,
		SC_2_PBS_LOCATE,
		SC_2_PBS_MESSAGE,
		SC_2_PBS_TRACK:
		return _POSIX2_PBS, nil
	case SC_2_UPE:
		return _POSIX2_UPE, nil
	case SC_2_VERSION:
		return _POSIX2_VERSION, nil

	case SC_XOPEN_CRYPT:
		return _XOPEN_CRYPT, nil
	case SC_XOPEN_ENH_I18N:
		return _XOPEN_ENH_I18N, nil
	case SC_XOPEN_REALTIME:
		return _XOPEN_REALTIME, nil
	case SC_XOPEN_REALTIME_THREADS:
		return _XOPEN_REALTIME_THREADS, nil
	case SC_XOPEN_SHM:
		return _XOPEN_SHM, nil
	case SC_XOPEN_STREAMS:
		return _XOPEN_STREAMS, nil
	case SC_XOPEN_UNIX:
		return _XOPEN_UNIX, nil
	case SC_XOPEN_UUCP:
		return _XOPEN_UUCP, nil

	case SC_AVPHYS_PAGES:
		if uvm, err := unix.SysctlUvmexp("vm.uvmexp"); err == nil {
			return int64(uvm.Free), nil
		}
		return -1, nil
	case SC_PHYS_PAGES:
		return sysctl64("hw.physmem") / int64(unix.Getpagesize()), nil
	case SC_NPROCESSORS_CONF:
		return sysctl32("hw.ncpu"), nil
	case SC_NPROCESSORS_ONLN:
		if val, err := unix.SysctlUint32("hw.ncpuonline"); err == nil {
			return int64(val), nil
		}
		return sysctl32("hw.ncpu"), nil
	}

	return sysconfGeneric(name)
}
