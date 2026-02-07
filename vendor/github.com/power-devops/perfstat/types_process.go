package perfstat

type Process struct {
	Version           int64   /* version number (1, 2, etc.,) */
	PID               int64   /* Process ID */
	ProcessName       string  /* Name of The Process */
	Priority          int32   /* Process Priority */
	NumThreads        int64   /* Thread Count */
	UID               int64   /* Owner Info */
	ClassID           int64   /* WLM Class Name */
	Size              int64   /* Virtual Size of the Process in KB(Exclusive Usage, Leaving all Shared Library Text & Shared File Pages, Shared Memory, Memory Mapped) */
	RealMemData       int64   /* Real Memory used for Data in KB */
	RealMemText       int64   /* Real Memory used for Text in KB */
	VirtMemData       int64   /* Virtual Memory used to Data in KB */
	VirtMemText       int64   /* Virtual Memory used for Text in KB */
	SharedLibDataSize int64   /* Data Size from Shared Library in KB */
	HeapSize          int64   /* Heap Size in KB */
	RealInUse         int64   /* The Real memory in use(in KB) by the process including all kind of segments (excluding system segments). This includes Text, Data, Shared Library Text, Shared Library Data, File Pages, Shared Memory & Memory Mapped */
	VirtInUse         int64   /* The Virtual memory in use(in KB) by the process including all kind of segments (excluding system segments). This includes Text, Data, Shared Library Text, Shared Library Data, File Pages, Shared Memory & Memory Mapped */
	Pinned            int64   /* Pinned Memory(in KB) for this process inclusive of all segments */
	PgSpInUse         int64   /* Paging Space used(in KB) inclusive of all segments */
	FilePages         int64   /* File Pages used(in KB) including shared pages */
	RealInUseMap      int64   /* Real memory used(in KB) for Shared Memory and Memory Mapped regions */
	VirtInUseMap      int64   /* Virtual Memory used(in KB) for Shared Memory and Memory Mapped regions */
	PinnedInUseMap    int64   /* Pinned memory(in KB) for Shared Memory and Memory Mapped regions */
	UCpuTime          float64 /* User Mode CPU time will be in percentage or milliseconds based on, whether it is filled by perfstat_process_util or perfstat_process respectively. */
	SCpuTime          float64 /* System Mode CPU time will be in percentage or milliseconds based on, whether it is filled by perfstat_process_util or perfstat_process respectively. */
	LastTimeBase      int64   /* Timebase Counter */
	InBytes           int64   /* Bytes Read from Disk */
	OutBytes          int64   /* Bytes Written to Disk */
	InOps             int64   /* In Operations from Disk */
	OutOps            int64   /* Out Operations from Disk */
}

type Thread struct {
	TID          int64   /* thread identifier */
	PID          int64   /* process identifier */
	CpuID        int64   /* processor on which I'm bound */
	UCpuTime     float64 /* User Mode CPU time will be in percentage or milliseconds based on, whether it is filled by perfstat_thread_util or perfstat_thread respectively. */
	SCpuTime     float64 /* System Mode CPU time will be in percentage or milliseconds based on, whether it is filled by perfstat_thread_util or perfstat_thread respectively. */
	LastTimeBase int64   /* Timebase Counter */
	Version      int64
}
