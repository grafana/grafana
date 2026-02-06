package perfstat

type LogicalVolume struct {
	Name                   string /* logical volume name */
	VGName                 string /* volume group name  */
	OpenClose              int64  /* LVM_QLVOPEN, etc. (see lvm.h) */
	State                  int64  /* LVM_UNDEF, etc. (see lvm.h) */
	MirrorPolicy           int64  /* LVM_PARALLEL, etc. (see lvm.h) */
	MirrorWriteConsistency int64  /* LVM_CONSIST, etc. (see lvm.h) */
	WriteVerify            int64  /* LVM_VERIFY, etc. (see lvm.h) */
	PPsize                 int64  /* physical partition size in MB */
	LogicalPartitions      int64  /* total number of logical paritions configured for this logical volume */
	Mirrors                int32  /* number of physical mirrors for each logical partition */
	IOCnt                  int64  /* Number of read and write requests */
	KBReads                int64  /* Number of Kilobytes read */
	KBWrites               int64  /* Number of Kilobytes written */
	Version                int64  /* version number (1, 2, etc.,) */
}

type VolumeGroup struct {
	Name                 string /* volume group name */
	TotalDisks           int64  /* number of physical volumes in the volume group */
	ActiveDisks          int64  /* number of active physical volumes in the volume group */
	TotalLogicalVolumes  int64  /* number of logical volumes in the volume group */
	OpenedLogicalVolumes int64  /* number of logical volumes opened in the volume group */
	IOCnt                int64  /* Number of read and write requests */
	KBReads              int64  /* Number of Kilobytes read */
	KBWrites             int64  /* Number of Kilobytes written */
	Version              int64  /* version number (1, 2, etc.,) */
	VariedState          int    /* Indicates volume group available or not */
}
