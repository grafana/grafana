package perfstat

type MemoryTotal struct {
	VirtualTotal          int64 /* total virtual memory (in 4KB pages) */
	RealTotal             int64 /* total real memory (in 4KB pages) */
	RealFree              int64 /* free real memory (in 4KB pages) */
	RealPinned            int64 /* real memory which is pinned (in 4KB pages) */
	RealInUse             int64 /* real memory which is in use (in 4KB pages) */
	BadPages              int64 /* number of bad pages */
	PageFaults            int64 /* number of page faults */
	PageIn                int64 /* number of pages paged in */
	PageOut               int64 /* number of pages paged out */
	PgSpIn                int64 /* number of page ins from paging space */
	PgSpOut               int64 /* number of page outs from paging space */
	Scans                 int64 /* number of page scans by clock */
	Cycles                int64 /* number of page replacement cycles */
	PgSteals              int64 /* number of page steals */
	NumPerm               int64 /* number of frames used for files (in 4KB pages) */
	PgSpTotal             int64 /* total paging space (in 4KB pages) */
	PgSpFree              int64 /* free paging space (in 4KB pages) */
	PgSpRsvd              int64 /* reserved paging space (in 4KB pages) */
	RealSystem            int64 /* real memory used by system segments (in 4KB pages). */
	RealUser              int64 /* real memory used by non-system segments (in 4KB pages). */
	RealProcess           int64 /* real memory used by process segments (in 4KB pages). */
	VirtualActive         int64 /* Active virtual pages. Virtual pages are considered active if they have been accessed */
	IOME                  int64 /* I/O memory entitlement of the partition in bytes*/
	IOMU                  int64 /* I/O memory entitlement of the partition in use in bytes*/
	IOHWM                 int64 /* High water mark of I/O memory entitlement used in bytes*/
	PMem                  int64 /* Amount of physical mmeory currently backing partition's logical memory in bytes*/
	CompressedTotal       int64 /* Total numbers of pages in compressed pool (in 4KB pages) */
	CompressedWSegPg      int64 /* Number of compressed working storage pages */
	CPgIn                 int64 /* number of page ins to compressed pool */
	CPgOut                int64 /* number of page outs from compressed pool */
	TrueSize              int64 /* True Memory Size in 4KB pages */
	ExpandedMemory        int64 /* Expanded Memory Size in 4KB pages */
	CompressedWSegSize    int64 /* Total size of the compressed working storage pages in the pool */
	TargetCPoolSize       int64 /* Target Compressed Pool Size in bytes */
	MaxCPoolSize          int64 /* Max Size of Compressed Pool in bytes */
	MinUCPoolSize         int64 /* Min Size of Uncompressed Pool in bytes */
	CPoolSize             int64 /* Compressed Pool size in bytes */
	UCPoolSize            int64 /* Uncompressed Pool size in bytes */
	CPoolInUse            int64 /* Compressed Pool Used in bytes */
	UCPoolInUse           int64 /* Uncompressed Pool Used in bytes */
	Version               int64 /* version number (1, 2, etc.,) */
	RealAvailable         int64 /* number of pages (in 4KB pages) of memory available without paging out working segments */
	BytesCoalesced        int64 /* The number of bytes of the calling partition.s logical real memory  coalesced because they contained duplicated data */
	BytesCoalescedMemPool int64 /* number of bytes of logical real memory coalesced because they contained duplicated data in the calling partition.s memory */
}

type MemoryPage struct {
	PSize           int64 /* page size in bytes */
	RealTotal       int64 /* number of real memory frames of this page size */
	RealFree        int64 /* number of pages on free list */
	RealPinned      int64 /* number of pages pinned */
	RealInUse       int64 /* number of pages in use */
	PgExct          int64 /* number of page faults  */
	PgIns           int64 /* number of pages paged in */
	PgOuts          int64 /* number of pages paged out */
	PgSpIns         int64 /* number of page ins from paging space */
	PgSpOuts        int64 /* number of page outs from paging space */
	Scans           int64 /* number of page scans by clock */
	Cycles          int64 /* number of page replacement cycles */
	PgSteals        int64 /* number of page steals */
	NumPerm         int64 /* number of frames used for files */
	NumPgSp         int64 /* number of pages with allocated paging space */
	RealSystem      int64 /* number of pages used by system segments. */
	RealUser        int64 /* number of pages used by non-system segments. */
	RealProcess     int64 /* number of pages used by process segments. */
	VirtActive      int64 /* Active virtual pages. */
	ComprsdTotal    int64 /* Number of pages of this size compressed */
	ComprsdWsegPgs  int64 /* Number of compressed working storage pages */
	CPgIns          int64 /* number of page ins of this page size to compressed pool */
	CPgOuts         int64 /* number of page outs of this page size from compressed pool */
	CPoolInUse      int64 /* Compressed Size of this page size in Compressed Pool */
	UCPoolSize      int64 /* Uncompressed Pool size in bytes of this page size */
	ComprsdWsegSize int64 /* Total size of the compressed working storage pages in the pool */
	Version         int64 /* version number (1, 2, etc.,) */
	RealAvail       int64 /* number of pages (in 4KB pages) of memory available without paging out working segments */
}

// paging space types
const (
	LV_PAGING      = 1
	NFS_PAGING     = 2
	UNKNOWN_PAGING = 3
)

type PagingSpace struct {
	Name      string /* Paging space name */
	Type      uint8  /* type of paging device (LV_PAGING or NFS_PAGING) */
	VGName    string /* volume group name */
	Hostname  string /* host name of paging server */
	Filename  string /* swap file name on server */
	LPSize    int64  /* size in number of logical partitions  */
	MBSize    int64  /* size in megabytes  */
	MBUsed    int64  /* portion used in megabytes  */
	IOPending int64  /* number of pending I/O */
	Active    uint8  /* indicates if active (1 if so, 0 if not) */
	Automatic uint8  /* indicates if automatic (1 if so, 0 if not) */
	Version   int64  /* version number (1, 2, etc.,) */
}
