package perfstat

type DiskTotal struct {
	Number    int32 /* total number of disks */
	Size      int64 /* total size of all disks (in MB) */
	Free      int64 /* free portion of all disks (in MB) */
	XRate     int64 /* __rxfers: total number of transfers from disk */
	Xfers     int64 /* total number of transfers to/from disk */
	Wblks     int64 /* 512 bytes blocks written to all disks */
	Rblks     int64 /* 512 bytes blocks read from all disks */
	Time      int64 /* amount of time disks are active */
	Version   int64 /* version number (1, 2, etc.,) */
	Rserv     int64 /* Average read or receive service time */
	MinRserv  int64 /* min read or receive service time */
	MaxRserv  int64 /* max read or receive service time */
	RTimeOut  int64 /* number of read request timeouts */
	RFailed   int64 /* number of failed read requests */
	Wserv     int64 /* Average write or send service time */
	MinWserv  int64 /* min write or send service time */
	MaxWserv  int64 /* max write or send service time */
	WTimeOut  int64 /* number of write request timeouts */
	WFailed   int64 /* number of failed write requests */
	WqDepth   int64 /* instantaneous wait queue depth (number of requests waiting to be sent to disk) */
	WqTime    int64 /* accumulated wait queueing time */
	WqMinTime int64 /* min wait queueing time */
	WqMaxTime int64 /* max wait queueing time */
}

// Disk Adapter Types
const (
	DA_SCSI  = 0 /* 0 ==> SCSI, SAS, other legacy adapter types */
	DA_VSCSI = 1 /* 1 ==> Virtual SCSI/SAS Adapter */
	DA_FCA   = 2 /* 2 ==> Fiber Channel Adapter */
)

type DiskAdapter struct {
	Name        string /* name of the adapter (from ODM) */
	Description string /* adapter description (from ODM) */
	Number      int32  /* number of disks connected to adapter */
	Size        int64  /* total size of all disks (in MB)  */
	Free        int64  /* free portion of all disks (in MB)  */
	XRate       int64  /* __rxfers: total number of reads via adapter */
	Xfers       int64  /* total number of transfers via adapter */
	Rblks       int64  /* 512 bytes blocks written via adapter */
	Wblks       int64  /* 512 bytes blocks read via adapter  */
	Time        int64  /* amount of time disks are active */
	Version     int64  /* version number (1, 2, etc.,) */
	AdapterType int64  /* 0 ==> SCSI, SAS, other legacy adapter types, 1 ==> Virtual SCSI/SAS Adapter, 2 ==> Fiber Channel Adapter */
	DkBSize     int64  /* Number of Bytes in a block for this disk*/
	DkRxfers    int64  /* Number of transfers from disk */
	DkRserv     int64  /* read or receive service time */
	DkWserv     int64  /* write or send service time */
	MinRserv    int64  /* Minimum read service time */
	MaxRserv    int64  /* Maximum read service time */
	MinWserv    int64  /* Minimum Write service time */
	MaxWserv    int64  /* Maximum write service time */
	WqDepth     int64  /* driver wait queue depth */
	WqSampled   int64  /* accumulated sampled dk_wq_depth */
	WqTime      int64  /* accumulated wait queueing time */
	WqMinTime   int64  /* minimum wait queueing time */
	WqMaxTime   int64  /* maximum wait queueing time */
	QFull       int64  /* "Service" queue full occurrence count (number of times the adapter/devices connected to the adapter is not accepting any more request) */
	QSampled    int64  /* accumulated sampled */
}

type Disk struct {
	Name        string /* name of the disk */
	Description string /* disk description (from ODM) */
	VGName      string /* volume group name (from ODM) */
	Size        int64  /* size of the disk (in MB) */
	Free        int64  /* free portion of the disk (in MB) */
	BSize       int64  /* disk block size (in bytes) */
	XRate       int64  /* number of transfers from disk */
	Xfers       int64  /* number of transfers to/from disk */
	Wblks       int64  /* number of blocks written to disk */
	Rblks       int64  /* number of blocks read from disk */
	QDepth      int64  /* instantaneous "service" queue depth (number of requests sent to disk and not completed yet) */
	Time        int64  /* amount of time disk is active */
	Adapter     string /* disk adapter name */
	PathsCount  int32  /* number of paths to this disk */
	QFull       int64  /* "service" queue full occurrence count (number of times the disk is not accepting any more request) */
	Rserv       int64  /* read or receive service time */
	RTimeOut    int64  /* number of read request timeouts */
	Rfailed     int64  /* number of failed read requests */
	MinRserv    int64  /* min read or receive service time */
	MaxRserv    int64  /* max read or receive service time */
	Wserv       int64  /* write or send service time */
	WTimeOut    int64  /* number of write request timeouts */
	Wfailed     int64  /* number of failed write requests */
	MinWserv    int64  /* min write or send service time */
	MaxWserv    int64  /* max write or send service time */
	WqDepth     int64  /* instantaneous wait queue depth (number of requests waiting to be sent to disk) */
	WqSampled   int64  /* accumulated sampled dk_wq_depth */
	WqTime      int64  /* accumulated wait queueing time */
	WqMinTime   int64  /* min wait queueing time */
	WqMaxTime   int64  /* max wait queueing time */
	QSampled    int64  /* accumulated sampled dk_q_depth */
	Version     int64  /* version number (1, 2, etc.,) */
	PseudoDisk  bool   /*Indicates whether pseudo or physical disk */
	VTDisk      bool   /* 1- Virtual Target Disk, 0 - Others */
}

type DiskPath struct {
	Name      string /* name of the path */
	XRate     int64  /* __rxfers: number of reads via the path */
	Xfers     int64  /* number of transfers via the path */
	Rblks     int64  /* 512 bytes blocks written via the path */
	Wblks     int64  /* 512 bytes blocks read via the path  */
	Time      int64  /* amount of time disks are active */
	Adapter   string /* disk adapter name (from ODM) */
	QFull     int64  /* "service" queue full occurrence count (number of times the disk is not accepting any more request) */
	Rserv     int64  /* read or receive service time */
	RTimeOut  int64  /* number of read request timeouts */
	Rfailed   int64  /* number of failed read requests */
	MinRserv  int64  /* min read or receive service time */
	MaxRserv  int64  /* max read or receive service time */
	Wserv     int64  /* write or send service time */
	WTimeOut  int64  /* number of write request timeouts */
	Wfailed   int64  /* number of failed write requests */
	MinWserv  int64  /* min write or send service time */
	MaxWserv  int64  /* max write or send service time */
	WqDepth   int64  /* instantaneous wait queue depth (number of requests waiting to be sent to disk) */
	WqSampled int64  /* accumulated sampled dk_wq_depth */
	WqTime    int64  /* accumulated wait queueing time */
	WqMinTime int64  /* min wait queueing time */
	WqMaxTime int64  /* max wait queueing time */
	QSampled  int64  /* accumulated sampled dk_q_depth */
	Version   int64  /* version number (1, 2, etc.,)   */
}

const (
	FC_DOWN = 0 // FC Adapter state is DOWN
	FC_UP   = 1 // FC Adapter state is UP
)

const (
	FCT_FCHBA = 0 // FC type - real Fiber Channel Adapter
	FCT_VFC   = 1 // FC type - virtual Fiber Channel
)

type FCAdapter struct {
	Version                      int64  /* version number (1, 2, etc.,) */
	Name                         string /* name of the adapter */
	State                        int32  /* FC Adapter state  UP or DOWN */
	InputRequests                int64  /* Number of Input Requests*/
	OutputRequests               int64  /* Number of Output Requests */
	InputBytes                   int64  /* Number of Input Bytes */
	OutputBytes                  int64  /* Number of Output Bytes */
	EffMaxTransfer               int64  /* Adapter's Effective Maximum  Transfer Value */
	NoDMAResourceCnt             int64  /* Count of DMA failures due to no DMA Resource available */
	NoCmdResourceCnt             int64  /* Count of failures to allocate a command due to no command resource available */
	AttentionType                int32  /* Link up or down Indicator */
	SecondsSinceLastReset        int64  /* Displays the seconds since last reset of the statistics on the adapter */
	TxFrames                     int64  /* Number of frames transmitted */
	TxWords                      int64  /* Fiber Channel Kbytes transmitted */
	RxFrames                     int64  /* Number of Frames Received */
	RxWords                      int64  /* Fiber Channel Kbytes Received */
	LIPCount                     int64  /* Count of LIP (Loop Initialization Protocol) Events received in case we have FC-AL */
	NOSCount                     int64  /* Count of NOS (Not_Operational) Events. This indicates a link failure state. */
	ErrorFrames                  int64  /* Number of frames received with the CRC Error */
	DumpedFrames                 int64  /* Number of lost frames */
	LinkFailureCount             int64  /* Count of Link failures */
	LossofSyncCount              int64  /* Count of loss of sync */
	LossofSignal                 int64  /* Count of loss of Signal */
	PrimitiveSeqProtocolErrCount int64  /* number of times a primitive sequence was in error */
	InvalidTxWordCount           int64  /* Count of Invalid Transmission words received */
	InvalidCRCCount              int64  /* Count of CRC Errors in a Received Frame */
	PortFcId                     int64  /* SCSI Id of the adapter */
	PortSpeed                    int64  /* Speed of Adapter in GBIT */
	PortType                     string /* Type of connection. The Possible Values are Fabric, Private Loop, Point-to-Point, unknown */
	PortWWN                      int64  /* World Wide Port name */
	PortSupportedSpeed           int64  /* Supported Port Speed in GBIT */
	AdapterType                  int    /* 0 - Fiber Chanel, 1 - Virtual Fiber Chanel Adapter */
	VfcName                      string /* name of the Virtual Fiber Chanel(VFC) adapter */
	ClientPartName               string /* name of the client partition */
}
