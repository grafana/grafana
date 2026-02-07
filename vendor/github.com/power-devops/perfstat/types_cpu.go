package perfstat

type CPU struct {
	Name             string /* logical processor name (cpu0, cpu1, ..) */
	User             int64  /* raw number of clock ticks spent in user mode */
	Sys              int64  /* raw number of clock ticks spent in system mode */
	Idle             int64  /* raw number of clock ticks spent idle */
	Wait             int64  /* raw number of clock ticks spent waiting for I/O */
	PSwitch          int64  /* number of context switches (changes of currently running process) */
	Syscall          int64  /* number of system calls executed */
	Sysread          int64  /* number of read system calls executed */
	Syswrite         int64  /* number of write system calls executed */
	Sysfork          int64  /* number of fork system call executed */
	Sysexec          int64  /* number of exec system call executed */
	Readch           int64  /* number of characters tranferred with read system call */
	Writech          int64  /* number of characters tranferred with write system call */
	Bread            int64  /* number of block reads */
	Bwrite           int64  /* number of block writes */
	Lread            int64  /* number of logical read requests */
	Lwrite           int64  /* number of logical write requests */
	Phread           int64  /* number of physical reads (reads on raw device) */
	Phwrite          int64  /* number of physical writes (writes on raw device) */
	Iget             int64  /* number of inode lookups */
	Namei            int64  /* number of vnode lookup from a path name */
	Dirblk           int64  /* number of 512-byte block reads by the directory search routine to locate an entry for a file */
	Msg              int64  /* number of IPC message operations */
	Sema             int64  /* number of IPC semaphore operations  */
	MinFaults        int64  /* number of page faults with no I/O */
	MajFaults        int64  /* number of page faults with disk I/O */
	PUser            int64  /* raw number of physical processor tics in user mode */
	PSys             int64  /* raw number of physical processor tics in system mode */
	PIdle            int64  /* raw number of physical processor tics idle */
	PWait            int64  /* raw number of physical processor tics waiting for I/O */
	RedispSD0        int64  /* number of thread redispatches within the scheduler affinity domain 0 */
	RedispSD1        int64  /* number of thread redispatches within the scheduler affinity domain 1 */
	RedispSD2        int64  /* number of thread redispatches within the scheduler affinity domain 2 */
	RedispSD3        int64  /* number of thread redispatches within the scheduler affinity domain 3 */
	RedispSD4        int64  /* number of thread redispatches within the scheduler affinity domain 4 */
	RedispSD5        int64  /* number of thread redispatches within the scheduler affinity domain 5 */
	MigrationPush    int64  /* number of thread migrations from the local runque to another queue due to starvation load balancing */
	MigrationS3grq   int64  /* number of  thread migrations from the global runque to the local runque resulting in a move accross scheduling domain 3 */
	MigrationS3pul   int64  /* number of  thread migrations from another processor's runque resulting in a move accross scheduling domain 3 */
	InvolCSwitch     int64  /* number of  involuntary thread context switches */
	VolCSwitch       int64  /* number of  voluntary thread context switches */
	RunQueue         int64  /* number of  threads on the runque */
	Bound            int64  /* number of  bound threads */
	DecrIntrs        int64  /* number of decrementer tics interrupts */
	MpcRIntrs        int64  /* number of mpc's received interrupts */
	MpcSIntrs        int64  /* number of mpc's sent interrupts */
	DevIntrs         int64  /* number of device interrupts */
	SoftIntrs        int64  /* number of offlevel handlers called */
	PhantIntrs       int64  /* number of phantom interrupts */
	IdleDonatedPurr  int64  /* number of idle cycles donated by a dedicated partition enabled for donation */
	IdleDonatedSpurr int64  /* number of idle spurr cycles donated by a dedicated partition enabled for donation */
	BusyDonatedPurr  int64  /* number of busy cycles donated by a dedicated partition enabled for donation */
	BusyDonatedSpurr int64  /* number of busy spurr cycles donated by a dedicated partition enabled for donation */
	IdleStolenPurr   int64  /* number of idle cycles stolen by the hypervisor from a dedicated partition */
	IdleStolenSpurr  int64  /* number of idle spurr cycles stolen by the hypervisor from a dedicated partition */
	BusyStolenPurr   int64  /* number of busy cycles stolen by the hypervisor from a dedicated partition */
	BusyStolenSpurr  int64  /* number of busy spurr cycles stolen by the hypervisor from a dedicated partition */
	Hpi              int64  /* number of hypervisor page-ins */
	Hpit             int64  /* Time spent in hypervisor page-ins (in nanoseconds)*/
	PUserSpurr       int64  /* number of spurr cycles spent in user mode */
	PSysSpurr        int64  /* number of spurr cycles spent in kernel mode */
	PIdleSpurr       int64  /* number of spurr cycles spent in idle mode */
	PWaitSpurr       int64  /* number of spurr cycles spent in wait mode */
	SpurrFlag        int32  /* set if running in spurr mode */
	LocalDispatch    int64  /* number of local thread dispatches on this logical CPU */
	NearDispatch     int64  /* number of near thread dispatches on this logical CPU */
	FarDispatch      int64  /* number of far thread dispatches on this logical CPU */
	CSwitches        int64  /* Context switches */
	Version          int64  /* version number (1, 2, etc.,) */
	TbLast           int64  /* timebase counter */
	State            int    /* Show whether the CPU is offline or online */
	VtbLast          int64  /* Last virtual timebase read */
	ICountLast       int64  /* Last instruction count read */
}

type CPUTotal struct {
	NCpus            int     /* number of active logical processors */
	NCpusCfg         int     /* number of configured processors */
	Description      string  /* processor description (type/official name) */
	ProcessorHz      int64   /* processor speed in Hz */
	User             int64   /*  raw total number of clock ticks spent in user mode */
	Sys              int64   /* raw total number of clock ticks spent in system mode */
	Idle             int64   /* raw total number of clock ticks spent idle */
	Wait             int64   /* raw total number of clock ticks spent waiting for I/O */
	PSwitch          int64   /* number of process switches (change in currently running process) */
	Syscall          int64   /* number of system calls executed */
	Sysread          int64   /* number of read system calls executed */
	Syswrite         int64   /* number of write system calls executed */
	Sysfork          int64   /* number of forks system calls executed */
	Sysexec          int64   /* number of execs system calls executed */
	Readch           int64   /* number of characters tranferred with read system call */
	Writech          int64   /* number of characters tranferred with write system call */
	DevIntrs         int64   /* number of device interrupts */
	SoftIntrs        int64   /* number of software interrupts */
	Lbolt            int64   /* number of ticks since last reboot */
	LoadAvg1         float32 /* times the average number of runnables processes during the last 1, 5 and 15 minutes.    */
	LoadAvg5         float32 /* times the average number of runnables processes during the last 1, 5 and 15 minutes.    */
	LoadAvg15        float32 /* times the average number of runnables processes during the last 1, 5 and 15 minutes.    */
	RunQueue         int64   /* length of the run queue (processes ready) */
	SwpQueue         int64   /* length of the swap queue (processes waiting to be paged in) */
	Bread            int64   /* number of blocks read */
	Bwrite           int64   /* number of blocks written */
	Lread            int64   /* number of logical read requests */
	Lwrite           int64   /* number of logical write requests */
	Phread           int64   /* number of physical reads (reads on raw devices) */
	Phwrite          int64   /* number of physical writes (writes on raw devices) */
	RunOcc           int64   /* updated whenever runque is updated, i.e. the runqueue is occupied. This can be used to compute the simple average of ready processes  */
	SwpOcc           int64   /* updated whenever swpque is updated. i.e. the swpqueue is occupied. This can be used to compute the simple average processes waiting to be paged in */
	Iget             int64   /* number of inode lookups */
	Namei            int64   /* number of vnode lookup from a path name */
	Dirblk           int64   /* number of 512-byte block reads by the directory search routine to locate an entry for a file */
	Msg              int64   /* number of IPC message operations */
	Sema             int64   /* number of IPC semaphore operations */
	RcvInt           int64   /* number of tty receive interrupts */
	XmtInt           int64   /* number of tyy transmit interrupts */
	MdmInt           int64   /* number of modem interrupts */
	TtyRawInch       int64   /* number of raw input characters  */
	TtyCanInch       int64   /* number of canonical input characters (always zero) */
	TtyRawOutch      int64   /* number of raw output characters */
	Ksched           int64   /* number of kernel processes created */
	Koverf           int64   /* kernel process creation attempts where: -the user has forked to their maximum limit -the configuration limit of processes has been reached */
	Kexit            int64   /* number of kernel processes that became zombies */
	Rbread           int64   /* number of remote read requests */
	Rcread           int64   /* number of cached remote reads */
	Rbwrt            int64   /* number of remote writes */
	Rcwrt            int64   /* number of cached remote writes */
	Traps            int64   /* number of traps */
	NCpusHigh        int64   /* index of highest processor online */
	PUser            int64   /* raw number of physical processor tics in user mode */
	PSys             int64   /* raw number of physical processor tics in system mode */
	PIdle            int64   /* raw number of physical processor tics idle */
	PWait            int64   /* raw number of physical processor tics waiting for I/O */
	DecrIntrs        int64   /* number of decrementer tics interrupts */
	MpcRIntrs        int64   /* number of mpc's received interrupts */
	MpcSIntrs        int64   /* number of mpc's sent interrupts */
	PhantIntrs       int64   /* number of phantom interrupts */
	IdleDonatedPurr  int64   /* number of idle cycles donated by a dedicated partition enabled for donation */
	IdleDonatedSpurr int64   /* number of idle spurr cycles donated by a dedicated partition enabled for donation */
	BusyDonatedPurr  int64   /* number of busy cycles donated by a dedicated partition enabled for donation */
	BusyDonatedSpurr int64   /* number of busy spurr cycles donated by a dedicated partition enabled for donation */
	IdleStolenPurr   int64   /* number of idle cycles stolen by the hypervisor from a dedicated partition */
	IdleStolenSpurr  int64   /* number of idle spurr cycles stolen by the hypervisor from a dedicated partition */
	BusyStolenPurr   int64   /* number of busy cycles stolen by the hypervisor from a dedicated partition */
	BusyStolenSpurr  int64   /* number of busy spurr cycles stolen by the hypervisor from a dedicated partition */
	IOWait           int32   /* number of processes that are asleep waiting for buffered I/O */
	PhysIO           int32   /* number of processes waiting for raw I/O */
	TWait            int64   /* number of threads that are waiting for filesystem direct(cio) */
	Hpi              int64   /* number of hypervisor page-ins */
	Hpit             int64   /* Time spent in hypervisor page-ins (in nanoseconds) */
	PUserSpurr       int64   /* number of spurr cycles spent in user mode */
	PSysSpurr        int64   /* number of spurr cycles spent in kernel mode */
	PIdleSpurr       int64   /* number of spurr cycles spent in idle mode */
	PWaitSpurr       int64   /* number of spurr cycles spent in wait mode */
	SpurrFlag        int     /* set if running in spurr mode */
	Version          int64   /* version number (1, 2, etc.,) */
	TbLast           int64   /*time base counter */
	PurrCoalescing   int64   /* If the calling partition is authorized to see pool wide statistics then PURR cycles consumed to coalesce data else set to zero.*/
	SpurrCoalescing  int64   /* If the calling partition is authorized to see pool wide statistics then SPURR cycles consumed to coalesce data else set to zero.  */
}

type CPUUtil struct {
	Version          int64
	CpuID            string  /* holds the id of the cpu */
	Entitlement      float32 /* Partition's entitlement */
	UserPct          float32 /* % of utilization in user mode */
	KernPct          float32 /* % of utilization in kernel mode */
	IdlePct          float32 /* % of utilization in idle mode */
	WaitPct          float32 /* % of utilization in wait mode */
	PhysicalBusy     float32 /* physical cpus busy */
	PhysicalConsumed float32 /* total cpus consumed by the partition */
	FreqPct          float32 /* Average freq% over the last interval */
	EntitlementPct   float32 /* % of entitlement used */
	BusyPct          float32 /* % of entitlement busy */
	IdleDonatedPct   float32 /* % idle cycles donated */
	BusyDonatedPct   float32 /* % of busy cycles donated */
	IdleStolenPct    float32 /* % idle cycles stolen */
	BusyStolenPct    float32 /* % busy cycles stolen */
	LUserPct         float32 /* % of utilization in user mode, in terms of logical processor ticks */
	LKernPct         float32 /* % of utilization in kernel mode, in terms of logical processor ticks*/
	LIdlePct         float32 /* % of utilization in idle mode, in terms of logical processor ticks */
	LWaitPct         float32 /* % of utilization in wait mode, in terms of logical processor ticks */
	DeltaTime        int64   /*   delta time in milliseconds, for which utilization is evaluated */
}
