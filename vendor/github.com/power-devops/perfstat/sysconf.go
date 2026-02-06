//go:build aix
// +build aix

package perfstat

/*
#include <unistd.h>
*/
import "C"

import "fmt"

const (
	SC_ARG_MAX                      = 0
	SC_CHILD_MAX                    = 1
	SC_CLK_TCK                      = 2
	SC_NGROUPS_MAX                  = 3
	SC_OPEN_MAX                     = 4
	SC_STREAM_MAX                   = 5
	SC_TZNAME_MAX                   = 6
	SC_JOB_CONTROL                  = 7
	SC_SAVED_IDS                    = 8
	SC_VERSION                      = 9
	SC_POSIX_ARG_MAX                = 10
	SC_POSIX_CHILD_MAX              = 11
	SC_POSIX_LINK_MAX               = 12
	SC_POSIX_MAX_CANON              = 13
	SC_POSIX_MAX_INPUT              = 14
	SC_POSIX_NAME_MAX               = 15
	SC_POSIX_NGROUPS_MAX            = 16
	SC_POSIX_OPEN_MAX               = 17
	SC_POSIX_PATH_MAX               = 18
	SC_POSIX_PIPE_BUF               = 19
	SC_POSIX_SSIZE_MAX              = 20
	SC_POSIX_STREAM_MAX             = 21
	SC_POSIX_TZNAME_MAX             = 22
	SC_BC_BASE_MAX                  = 23
	SC_BC_DIM_MAX                   = 24
	SC_BC_SCALE_MAX                 = 25
	SC_BC_STRING_MAX                = 26
	SC_EQUIV_CLASS_MAX              = 27
	SC_EXPR_NEST_MAX                = 28
	SC_LINE_MAX                     = 29
	SC_RE_DUP_MAX                   = 30
	SC_2_VERSION                    = 31
	SC_2_C_DEV                      = 32
	SC_2_FORT_DEV                   = 33
	SC_2_FORT_RUN                   = 34
	SC_2_LOCALEDEF                  = 35
	SC_2_SW_DEV                     = 36
	SC_POSIX2_BC_BASE_MAX           = 37
	SC_POSIX2_BC_DIM_MAX            = 38
	SC_POSIX2_BC_SCALE_MAX          = 39
	SC_POSIX2_BC_STRING_MAX         = 40
	SC_POSIX2_BC_EQUIV_CLASS_MAX    = 41
	SC_POSIX2_BC_EXPR_NEST_MAX      = 42
	SC_POSIX2_BC_LINE_MAX           = 43
	SC_POSIX2_BC_RE_DUP_MAX         = 44
	SC_PASS_MAX                     = 45
	SC_XOPEN_VERSION                = 46
	SC_ATEXIT_MAX                   = 47
	SC_PAGE_SIZE                    = 48
	SC_PAGESIZE                     = SC_PAGE_SIZE
	SC_AES_OS_VERSION               = 49
	SC_COLL_WEIGHTS_MAX             = 50
	SC_2_C_WIND                     = 51
	SC_2_C_VERSION                  = 52
	SC_2_UPE                        = 53
	SC_2_CHAR_TERM                  = 54
	SC_XOPEN_SHM                    = 55
	SC_XOPEN_CRYPT                  = 56
	SC_XOPEN_ENH_I18N               = 57
	SC_IOV_MAX                      = 58
	SC_THREAD_SAFE_FUNCTIONS        = 59
	SC_THREADS                      = 60
	SC_THREAD_ATTR_STACKADDR        = 61
	SC_THREAD_ATTR_STACKSIZE        = 62
	SC_THREAD_FORKALL               = 63
	SC_THREAD_PRIORITY_SCHEDULING   = 64
	SC_THREAD_PRIO_INHERIT          = 65
	SC_THREAD_PRIO_PROTECT          = 66
	SC_THREAD_PROCESS_SHARED        = 67
	SC_THREAD_KEYS_MAX              = 68
	SC_THREAD_DATAKEYS_MAX          = SC_THREAD_KEYS_MAX
	SC_THREAD_STACK_MIN             = 69
	SC_THREAD_THREADS_MAX           = 70
	SC_NPROCESSORS_CONF             = 71
	SC_NPROCESSORS_ONLN             = 72
	SC_XOPEN_UNIX                   = 73
	SC_AIO_LISTIO_MAX               = 75
	SC_AIO_MAX                      = 76
	SC_AIO_PRIO_DELTA_MAX           = 77
	SC_ASYNCHRONOUS_IO              = 78
	SC_DELAYTIMER_MAX               = 79
	SC_FSYNC                        = 80
	SC_GETGR_R_SIZE_MAX             = 81
	SC_GETPW_R_SIZE_MAX             = 82
	SC_LOGIN_NAME_MAX               = 83
	SC_MAPPED_FILES                 = 84
	SC_MEMLOCK                      = 85
	SC_MEMLOCK_RANGE                = 86
	SC_MEMORY_PROTECTION            = 87
	SC_MESSAGE_PASSING              = 88
	SC_MQ_OPEN_MAX                  = 89
	SC_MQ_PRIO_MAX                  = 90
	SC_PRIORITIZED_IO               = 91
	SC_PRIORITY_SCHEDULING          = 92
	SC_REALTIME_SIGNALS             = 93
	SC_RTSIG_MAX                    = 94
	SC_SEMAPHORES                   = 95
	SC_SEM_NSEMS_MAX                = 96
	SC_SEM_VALUE_MAX                = 97
	SC_SHARED_MEMORY_OBJECTS        = 98
	SC_SIGQUEUE_MAX                 = 99
	SC_SYNCHRONIZED_IO              = 100
	SC_THREAD_DESTRUCTOR_ITERATIONS = 101
	SC_TIMERS                       = 102
	SC_TIMER_MAX                    = 103
	SC_TTY_NAME_MAX                 = 104
	SC_XBS5_ILP32_OFF32             = 105
	SC_XBS5_ILP32_OFFBIG            = 106
	SC_XBS5_LP64_OFF64              = 107
	SC_XBS5_LPBIG_OFFBIG            = 108
	SC_XOPEN_XCU_VERSION            = 109
	SC_XOPEN_REALTIME               = 110
	SC_XOPEN_REALTIME_THREADS       = 111
	SC_XOPEN_LEGACY                 = 112
	SC_REENTRANT_FUNCTIONS          = SC_THREAD_SAFE_FUNCTIONS
	SC_PHYS_PAGES                   = 113
	SC_AVPHYS_PAGES                 = 114
	SC_LPAR_ENABLED                 = 115
	SC_LARGE_PAGESIZE               = 116
	SC_AIX_KERNEL_BITMODE           = 117
	SC_AIX_REALMEM                  = 118
	SC_AIX_HARDWARE_BITMODE         = 119
	SC_AIX_MP_CAPABLE               = 120
	SC_V6_ILP32_OFF32               = 121
	SC_V6_ILP32_OFFBIG              = 122
	SC_V6_LP64_OFF64                = 123
	SC_V6_LPBIG_OFFBIG              = 124
	SC_XOPEN_STREAMS                = 125
	SC_HOST_NAME_MAX                = 126
	SC_REGEXP                       = 127
	SC_SHELL                        = 128
	SC_SYMLOOP_MAX                  = 129
	SC_ADVISORY_INFO                = 130
	SC_FILE_LOCKING                 = 131
	SC_2_PBS                        = 132
	SC_2_PBS_ACCOUNTING             = 133
	SC_2_PBS_CHECKPOINT             = 134
	SC_2_PBS_LOCATE                 = 135
	SC_2_PBS_MESSAGE                = 136
	SC_2_PBS_TRACK                  = 137
	SC_BARRIERS                     = 138
	SC_CLOCK_SELECTION              = 139
	SC_CPUTIME                      = 140
	SC_MONOTONIC_CLOCK              = 141
	SC_READER_WRITER_LOCKS          = 142
	SC_SPAWN                        = 143
	SC_SPIN_LOCKS                   = 144
	SC_SPORADIC_SERVER              = 145
	SC_THREAD_CPUTIME               = 146
	SC_THREAD_SPORADIC_SERVER       = 147
	SC_TIMEOUTS                     = 148
	SC_TRACE                        = 149
	SC_TRACE_EVENT_FILTER           = 150
	SC_TRACE_INHERIT                = 151
	SC_TRACE_LOG                    = 152
	SC_TYPED_MEMORY_OBJECTS         = 153
	SC_IPV6                         = 154
	SC_RAW_SOCKETS                  = 155
	SC_SS_REPL_MAX                  = 156
	SC_TRACE_EVENT_NAME_MAX         = 157
	SC_TRACE_NAME_MAX               = 158
	SC_TRACE_SYS_MAX                = 159
	SC_TRACE_USER_EVENT_MAX         = 160
	SC_AIX_UKEYS                    = 161
	SC_AIX_ENHANCED_AFFINITY        = 162
	SC_V7_ILP32_OFF32               = 163
	SC_V7_ILP32_OFFBIG              = 164
	SC_V7_LP64_OFF64                = 165
	SC_V7_LPBIG_OFFBIG              = 166
	SC_THREAD_ROBUST_PRIO_INHERIT   = 167
	SC_THREAD_ROBUST_PRIO_PROTECT   = 168
	SC_XOPEN_UUCP                   = 169
	SC_XOPEN_ARMOR                  = 170
)

func Sysconf(name int32) (int64, error) {
	r := C.sysconf(C.int(name))
	if r == -1 {
		return 0, fmt.Errorf("sysconf error")
	} else {
		return int64(r), nil
	}
}
