// SPDX-License-Identifier: BSD-3-Clause
// Created by cgo -godefs - DO NOT EDIT
// cgo -godefs types_freebsd.go

package process

const (
	CTLKern          = 1
	KernProc         = 14
	KernProcPID      = 1
	KernProcProc     = 8
	KernProcPathname = 12
	KernProcArgs     = 7
	KernProcCwd      = 42
)

const (
	sizeofPtr      = 0x4
	sizeofShort    = 0x2
	sizeofInt      = 0x4
	sizeofLong     = 0x4
	sizeofLongLong = 0x8
)

const (
	sizeOfKinfoVmentry = 0x488
	sizeOfKinfoProc    = 0x440
	sizeOfKinfoFile    = 0x570 // TODO: should be changed by running on the target machine
)

const (
	SIDL   = 1
	SRUN   = 2
	SSLEEP = 3
	SSTOP  = 4
	SZOMB  = 5
	SWAIT  = 6
	SLOCK  = 7
)

type (
	_C_short     int16
	_C_int       int32
	_C_long      int32
	_C_long_long int64
)

type Timespec struct {
	Sec  int64
	Nsec int64
}

type Timeval struct {
	Sec  int64
	Usec int64
}

type Rusage struct {
	Utime    Timeval
	Stime    Timeval
	Maxrss   int32
	Ixrss    int32
	Idrss    int32
	Isrss    int32
	Minflt   int32
	Majflt   int32
	Nswap    int32
	Inblock  int32
	Oublock  int32
	Msgsnd   int32
	Msgrcv   int32
	Nsignals int32
	Nvcsw    int32
	Nivcsw   int32
}

type Rlimit struct {
	Cur int32
	Max int32
}

type KinfoProc struct {
	Structsize   int32
	Layout       int32
	Args         int32 /* pargs */
	Paddr        int32 /* proc */
	Addr         int32 /* user */
	Tracep       int32 /* vnode */
	Textvp       int32 /* vnode */
	Fd           int32 /* filedesc */
	Vmspace      int32 /* vmspace */
	Wchan        int32
	Pid          int32
	Ppid         int32
	Pgid         int32
	Tpgid        int32
	Sid          int32
	Tsid         int32
	Jobc         int16
	Spare_short1 int16
	Tdev         uint32
	Siglist      [16]byte /* sigset */
	Sigmask      [16]byte /* sigset */
	Sigignore    [16]byte /* sigset */
	Sigcatch     [16]byte /* sigset */
	Uid          uint32
	Ruid         uint32
	Svuid        uint32
	Rgid         uint32
	Svgid        uint32
	Ngroups      int16
	Spare_short2 int16
	Groups       [16]uint32
	Size         uint32
	Rssize       int32
	Swrss        int32
	Tsize        int32
	Dsize        int32
	Ssize        int32
	Xstat        uint16
	Acflag       uint16
	Pctcpu       uint32
	Estcpu       uint32
	Slptime      uint32
	Swtime       uint32
	Cow          uint32
	Runtime      uint64
	Start        Timeval
	Childtime    Timeval
	Flag         int32
	Kiflag       int32
	Traceflag    int32
	Stat         int8
	Nice         int8
	Lock         int8
	Rqindex      int8
	Oncpu        uint8
	Lastcpu      uint8
	Tdname       [17]int8
	Wmesg        [9]int8
	Login        [18]int8
	Lockname     [9]int8
	Comm         [20]int8
	Emul         [17]int8
	Loginclass   [18]int8
	Sparestrings [50]int8
	Spareints    [4]int32
	Flag2        int32
	Fibnum       int32
	Cr_flags     uint32
	Jid          int32
	Numthreads   int32
	Tid          int32
	Pri          Priority
	Rusage       Rusage
	Rusage_ch    Rusage
	Pcb          int32 /* pcb */
	Kstack       int32
	Udata        int32
	Tdaddr       int32 /* thread */
	Spareptrs    [6]int64
	Sparelongs   [12]int64
	Sflag        int64
	Tdflags      int64
}

type Priority struct {
	Class  uint8
	Level  uint8
	Native uint8
	User   uint8
}

type KinfoVmentry struct {
	Structsize       int32
	Type             int32
	Start            uint64
	End              uint64
	Offset           uint64
	Vn_fileid        uint64
	Vn_fsid          uint32
	Flags            int32
	Resident         int32
	Private_resident int32
	Protection       int32
	Ref_count        int32
	Shadow_count     int32
	Vn_type          int32
	Vn_size          uint64
	Vn_rdev          uint32
	Vn_mode          uint16
	Status           uint16
	X_kve_ispare     [12]int32
	Path             [1024]int8
}

// TODO: should be changed by running on the target machine
type kinfoFile struct {
	Structsize     int32
	Type           int32
	Fd             int32
	Ref_count      int32
	Flags          int32
	Pad0           int32
	Offset         int64
	Anon0          [304]byte
	Status         uint16
	Pad1           uint16
	X_kf_ispare0   int32
	Cap_rights     capRights
	X_kf_cap_spare uint64
	Path           [1024]int8 // changed from uint8 by hand
}

// TODO: should be changed by running on the target machine
type capRights struct {
	Rights [2]uint64
}
