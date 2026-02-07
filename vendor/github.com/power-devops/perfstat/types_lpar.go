package perfstat

type PartitionType struct {
	SmtCapable        bool /* OS supports SMT mode */
	SmtEnabled        bool /* SMT mode is on */
	LparCapable       bool /* OS supports logical partitioning */
	LparEnabled       bool /* logical partitioning is on */
	SharedCapable     bool /* OS supports shared processor LPAR */
	SharedEnabled     bool /* partition runs in shared mode */
	DLparCapable      bool /* OS supports dynamic LPAR */
	Capped            bool /* partition is capped */
	Kernel64bit       bool /* kernel is 64 bit */
	PoolUtilAuthority bool /* pool utilization available */
	DonateCapable     bool /* capable of donating cycles */
	DonateEnabled     bool /* enabled for donating cycles */
	AmsCapable        bool /* 1 = AMS(Active Memory Sharing) capable, 0 = Not AMS capable */
	AmsEnabled        bool /* 1 = AMS(Active Memory Sharing) enabled, 0 = Not AMS enabled */
	PowerSave         bool /*1= Power saving mode is enabled*/
	AmeEnabled        bool /* Active Memory Expansion is enabled */
	SharedExtended    bool
}

type PartitionValue struct {
	Online  int64
	Max     int64
	Min     int64
	Desired int64
}

type PartitionConfig struct {
	Version                  int64          /* Version number */
	Name                     string         /* Partition Name */
	Node                     string         /* Node Name */
	Conf                     PartitionType  /* Partition Properties */
	Number                   int32          /* Partition Number */
	GroupID                  int32          /* Group ID */
	ProcessorFamily          string         /* Processor Type */
	ProcessorModel           string         /* Processor Model */
	MachineID                string         /* Machine ID */
	ProcessorMhz             float64        /* Processor Clock Speed in MHz */
	NumProcessors            PartitionValue /* Number of Configured Physical Processors in frame*/
	OSName                   string         /* Name of Operating System */
	OSVersion                string         /* Version of operating System */
	OSBuild                  string         /* Build of Operating System */
	LCpus                    int32          /* Number of Logical CPUs */
	SmtThreads               int32          /* Number of SMT Threads */
	Drives                   int32          /* Total Number of Drives */
	NetworkAdapters          int32          /* Total Number of Network Adapters */
	CpuCap                   PartitionValue /* Min, Max and Online CPU Capacity */
	Weightage                int32          /* Variable Processor Capacity Weightage */
	EntCapacity              int32          /* number of processor units this partition is entitled to receive */
	VCpus                    PartitionValue /* Min, Max and Online Virtual CPUs */
	PoolID                   int32          /* Shared Pool ID of physical processors, to which this partition belongs*/
	ActiveCpusInPool         int32          /* Count of physical CPUs in the shared processor pool, to which this partition belongs */
	PoolWeightage            int32          /* Pool Weightage */
	SharedPCpu               int32          /* Number of physical processors allocated for shared processor use */
	MaxPoolCap               int32          /* Maximum processor capacity of partition's pool */
	EntPoolCap               int32          /* Entitled processor capacity of partition's pool */
	Mem                      PartitionValue /* Min, Max and Online Memory */
	MemWeightage             int32          /* Variable Memory Capacity Weightage */
	TotalIOMemoryEntitlement int64          /* I/O Memory Entitlement of the partition in bytes */
	MemPoolID                int32          /* AMS pool id of the pool the LPAR belongs to */
	HyperPgSize              int64          /* Hypervisor page size in KB*/
	ExpMem                   PartitionValue /* Min, Max and Online Expanded Memory */
	TargetMemExpFactor       int64          /* Target Memory Expansion Factor scaled by 100 */
	TargetMemExpSize         int64          /* Expanded Memory Size in MB */
	SubProcessorMode         int32          /* Split core mode, its value can be 0,1,2 or 4. 0 for unsupported, 1 for capable but not enabled, 2 or 4 for enabled*/
}

const (
	AME_TYPE_V1           = 0x1
	AME_TYPE_V2           = 0x2
	LPAR_INFO_CAPPED      = 0x01 /* Parition Capped */
	LPAR_INFO_AUTH_PIC    = 0x02 /* Authority granted for poolidle*/
	LPAR_INFO_SMT_ENABLED = 0x04 /* SMT Enabled */
	LPAR_INFO_WPAR_ACTIVE = 0x08 /* Process Running Within a WPAR */
	LPAR_INFO_EXTENDED    = 0x10 /* Extended shared processor pool information */
	LPAR_INFO_AME_ENABLED = 0x20 /* Active Mem. Expansion (AME) enabled*/
	LPAR_INFO_SEM_ENABLED = 0x40 /* Speculative Execution Mode enabled */
)

type PartitionInfo struct {
	Version               int    /* version for this structure */
	OnlineMemory          uint64 /* MB of currently online memory */
	TotalDispatchTime     uint64 /* Total lpar dispatch time in nsecs */
	PoolIdleTime          uint64 /* Idle time of shared CPU pool nsecs*/
	DispatchLatency       uint64 /* Max latency inbetween dispatches of this LPAR on physCPUS in nsecs */
	LparFlags             uint   /* LPAR flags */
	PCpusInSys            uint   /* # of active licensed physical CPUs in system */
	OnlineVCpus           uint   /* # of current online virtual CPUs */
	OnlineLCpus           uint   /* # of current online logical CPUs */
	PCpusInPool           uint   /* # physical CPUs in shared pool */
	UnallocCapacity       uint   /* Unallocated Capacity available in shared pool */
	EntitledCapacity      uint   /* Entitled Processor Capacity for this partition */
	VariableWeight        uint   /* Variable Processor Capacity Weight */
	UnallocWeight         uint   /* Unallocated Variable Weight available for this partition */
	MinReqVCpuCapacity    uint   /* OS minimum required virtual processor capacity. */
	GroupId               uint8  /* ID of a LPAR group/aggregation */
	PoolId                uint8  /* ID of a shared pool */
	ShCpusInSys           uint   /* # of physical processors allocated for shared processor use */
	MaxPoolCapacity       uint   /* Maximum processor capacity of partition's pool */
	EntitledPoolCapacity  uint   /* Entitled processor capacity of partition's pool */
	PoolMaxTime           uint64 /* Summation of maximum time that could be consumed by the pool, in nanoseconds */
	PoolBusyTime          uint64 /* Summation of busy time accumulated across all partitions in the pool, in nanoseconds */
	PoolScaledBusyTime    uint64 /* Scaled summation of busy time accumulated across all partitions in the pool, in nanoseconds */
	ShCpuTotalTime        uint64 /* Summation of total time across all physical processors allocated for shared processor use, in nanoseconds */
	ShCpuBusyTime         uint64 /* Summation of busy time accumulated across all shared processor partitions, in nanoseconds */
	ShCpuScaledBusyTime   uint64 /* Scaled summation of busy time accumulated across all shared processor partitions, in nanoseconds */
	EntMemCapacity        uint64 /* Partition's current entitlement memory capacity setting */
	PhysMem               uint64 /* Amount of physical memory, in bytes, currently backing the partition's logical memory */
	VrmPoolPhysMem        uint64 /* Total amount of physical memory in the VRM pool */
	HypPageSize           uint   /* Page size hypervisor is using to virtualize partition's memory */
	VrmPoolId             int    /* ID of VRM pool */
	VrmGroupId            int    /* eWLM VRM group to which partition belongs */
	VarMemWeight          int    /* Partition's current variable memory capacity weighting setting */
	UnallocVarMemWeight   int    /* Amount of unallocated variable memory capacity weight available to LPAR's group */
	UnallocEntMemCapacity uint64 /* Amount of unallocated I/O memory entitlement available to LPAR's group */
	TrueOnlineMemory      uint64 /* true MB of currently online memory */
	AmeOnlineMemory       uint64 /* AME MB of currently online memory  */
	AmeType               uint8
	SpecExecMode          uint8  /* Speculative Execution Mode */
	AmeFactor             uint   /* memory expansion factor for LPAR */
	EmPartMajorCode       uint   /* Major and minor codes for our    */
	EmPartMinorCode       uint   /*   current energy management mode */
	BytesCoalesced        uint64 /* The number of bytes of the calling partition.s logical real memory  coalesced because they contained duplicated data */
	BytesCoalescedMemPool uint64 /* If the calling partition is authorized to see pool wide statistics then the number of bytes of logical real memory coalesced because they contained duplicated data in the calling partition.s memory pool else set to zero.*/
	PurrCoalescing        uint64 /* If the calling partition is authorized to see pool wide statistics then  PURR cycles consumed to coalesce data else set to zero.*/
	SpurrCoalescing       uint64 /* If the calling partition is authorized to see pool wide statistics then SPURR cycles consumed to coalesce data else set to zero.*/
}
