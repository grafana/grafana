package perfstat

import (
	"strings"
)

type FileSystem struct {
	Device      string /* name of the mounted device */
	MountPoint  string /* where the device is mounted */
	FSType      int    /* File system type, see the constants below */
	Flags       uint   /* Flags of the file system */
	TotalBlocks int64  /* number of 512 bytes blocks in the filesystem */
	FreeBlocks  int64  /* number of free 512 bytes block in the filesystem */
	TotalInodes int64  /* total number of inodes in the filesystem */
	FreeInodes  int64  /* number of free inodes in the filesystem */
}

func (f *FileSystem) TypeString() string {
	switch f.FSType {
	case FS_JFS2:
		return "jfs2"
	case FS_NAMEFS:
		return "namefs"
	case FS_NFS:
		return "nfs"
	case FS_JFS:
		return "jfs"
	case FS_CDROM:
		return "cdrfs"
	case FS_PROCFS:
		return "procfs"
	case FS_SFS:
		return "sfs"
	case FS_CACHEFS:
		return "cachefs"
	case FS_NFS3:
		return "nfs3"
	case FS_AUTOFS:
		return "autofs"
	case FS_POOLFS:
		return "poolfs"
	case FS_VXFS:
		return "vxfs"
	case FS_VXODM:
		return "vxodm"
	case FS_UDF:
		return "udfs"
	case FS_NFS4:
		return "nfs4"
	case FS_RFS4:
		return "rfs4"
	case FS_CIFS:
		return "cifs"
	case FS_PMEMFS:
		return "pmemfs"
	case FS_AHAFS:
		return "ahafs"
	case FS_STNFS:
		return "stnfs"
	case FS_ASMFS:
		return "asmfs"
	}
	return "unknown"
}

func (f *FileSystem) FlagsString() string {
	var flags []string

	switch {
	case f.Flags&VFS_READONLY != 0:
		flags = append(flags, "ro")
	case f.Flags&VFS_REMOVABLE != 0:
		flags = append(flags, "removable")
	case f.Flags&VFS_DEVMOUNT != 0:
		flags = append(flags, "local")
	case f.Flags&VFS_REMOTE != 0:
		flags = append(flags, "remote")
	case f.Flags&VFS_SYSV_MOUNT != 0:
		flags = append(flags, "sysv")
	case f.Flags&VFS_UNMOUNTING != 0:
		flags = append(flags, "unmounting")
	case f.Flags&VFS_NOSUID != 0:
		flags = append(flags, "nosuid")
	case f.Flags&VFS_NODEV != 0:
		flags = append(flags, "nodev")
	case f.Flags&VFS_NOINTEG != 0:
		flags = append(flags, "nointeg")
	case f.Flags&VFS_NOMANAGER != 0:
		flags = append(flags, "nomanager")
	case f.Flags&VFS_NOCASE != 0:
		flags = append(flags, "nocase")
	case f.Flags&VFS_UPCASE != 0:
		flags = append(flags, "upcase")
	case f.Flags&VFS_NBC != 0:
		flags = append(flags, "nbc")
	case f.Flags&VFS_MIND != 0:
		flags = append(flags, "mind")
	case f.Flags&VFS_RBR != 0:
		flags = append(flags, "rbr")
	case f.Flags&VFS_RBW != 0:
		flags = append(flags, "rbw")
	case f.Flags&VFS_DISCONNECTED != 0:
		flags = append(flags, "disconnected")
	case f.Flags&VFS_SHUTDOWN != 0:
		flags = append(flags, "shutdown")
	case f.Flags&VFS_VMOUNTOK != 0:
		flags = append(flags, "vmountok")
	case f.Flags&VFS_SUSER != 0:
		flags = append(flags, "suser")
	case f.Flags&VFS_SOFT_MOUNT != 0:
		flags = append(flags, "soft")
	case f.Flags&VFS_UNMOUNTED != 0:
		flags = append(flags, "unmounted")
	case f.Flags&VFS_DEADMOUNT != 0:
		flags = append(flags, "deadmount")
	case f.Flags&VFS_SNAPSHOT != 0:
		flags = append(flags, "snapshot")
	case f.Flags&VFS_VCM_ON != 0:
		flags = append(flags, "vcm_on")
	case f.Flags&VFS_VCM_MONITOR != 0:
		flags = append(flags, "vcm_monitor")
	case f.Flags&VFS_ATIMEOFF != 0:
		flags = append(flags, "noatime")
	case f.Flags&VFS_READMOSTLY != 0:
		flags = append(flags, "readmostly")
	case f.Flags&VFS_CIOR != 0:
		flags = append(flags, "cior")
	case f.Flags&VFS_CIO != 0:
		flags = append(flags, "cio")
	case f.Flags&VFS_DIO != 0:
		flags = append(flags, "dio")
	}

	return strings.Join(flags, ",")
}

// Filesystem types
const (
	FS_JFS2    = 0  /* AIX physical fs "jfs2" */
	FS_NAMEFS  = 1  /* AIX pseudo fs "namefs" */
	FS_NFS     = 2  /* SUN Network File System "nfs" */
	FS_JFS     = 3  /* AIX R3 physical fs "jfs" */
	FS_CDROM   = 5  /* CDROM File System "cdrom" */
	FS_PROCFS  = 6  /* PROCFS File System "proc" */
	FS_SFS     = 16 /* AIX Special FS (STREAM mounts) */
	FS_CACHEFS = 17 /* Cachefs file system */
	FS_NFS3    = 18 /* NFSv3 file system */
	FS_AUTOFS  = 19 /* Automount file system */
	FS_POOLFS  = 20 /* Pool file system */
	FS_VXFS    = 32 /* THRPGIO File System "vxfs" */
	FS_VXODM   = 33 /* For Veritas File System */
	FS_UDF     = 34 /* UDFS file system */
	FS_NFS4    = 35 /* NFSv4 file system */
	FS_RFS4    = 36 /* NFSv4 Pseudo file system */
	FS_CIFS    = 37 /* AIX SMBFS (CIFS client) */
	FS_PMEMFS  = 38 /* MCR Async Mobility pseudo file system */
	FS_AHAFS   = 39 /* AHAFS File System "aha" */
	FS_STNFS   = 40 /* Short-Term NFS */
	FS_ASMFS   = 41 /* Oracle ASM FS */
)

// Filesystem flags
const (
	VFS_READONLY     = 0x00000001 /* rdonly access to vfs */
	VFS_REMOVABLE    = 0x00000002 /* removable (diskette) media */
	VFS_DEVMOUNT     = 0x00000004 /* physical device mount */
	VFS_REMOTE       = 0x00000008 /* file system is on network */
	VFS_SYSV_MOUNT   = 0x00000010 /* System V style mount */
	VFS_UNMOUNTING   = 0x00000020 /* originated by unmount() */
	VFS_NOSUID       = 0x00000040 /* don't maintain suid-ness across this mount */
	VFS_NODEV        = 0x00000080 /* don't allow device access across this mount */
	VFS_NOINTEG      = 0x00000100 /* no integrity mount option */
	VFS_NOMANAGER    = 0x00000200 /* mount managed fs w/o manager */
	VFS_NOCASE       = 0x00000400 /* do not map dir names */
	VFS_UPCASE       = 0x00000800 /* map dir names to uppercase */
	VFS_NBC          = 0x00001000 /* NBC cached file in this vfs */
	VFS_MIND         = 0x00002000 /* multi-segment .indirect */
	VFS_RBR          = 0x00004000 /* Release-behind when reading */
	VFS_RBW          = 0x00008000 /* Release-behind when writing */
	VFS_DISCONNECTED = 0x00010000 /* file mount not in use */
	VFS_SHUTDOWN     = 0x00020000 /* forced unmount for shutdown */
	VFS_VMOUNTOK     = 0x00040000 /* dir/file mnt permission flag */
	VFS_SUSER        = 0x00080000 /* client-side suser perm. flag */
	VFS_SOFT_MOUNT   = 0x00100000 /* file-over-file or directory over directory "soft" mount */
	VFS_UNMOUNTED    = 0x00200000 /* unmount completed, stale vnodes are left in the vfs */
	VFS_DEADMOUNT    = 0x00400000 /* softmount vfs should be disconnected at last vnode free */
	VFS_SNAPSHOT     = 0x00800000 /* snapshot mount */
	VFS_VCM_ON       = 0x01000000 /* VCM is currently active */
	VFS_VCM_MONITOR  = 0x02000000 /* VCM monitoring is active */
	VFS_ATIMEOFF     = 0x04000000 /* no atime updates during i/o */
	VFS_READMOSTLY   = 0x10000000 /* ROFS allows open for write */
	VFS_CIOR         = 0x20000000 /* O_CIOR mount */
	VFS_CIO          = 0x40000000 /* O_CIO mount */
	VFS_DIO          = 0x80000000 /* O_DIRECT mount */
)
