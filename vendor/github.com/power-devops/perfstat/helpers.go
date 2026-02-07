//go:build aix
// +build aix

package perfstat

/*
#cgo LDFLAGS: -lperfstat

#include <libperfstat.h>
#include <sys/proc.h>
#include <sys/dr.h>

#include "c_helpers.h"
*/
import "C"

func perfstatcpu2cpu(n *C.perfstat_cpu_t) CPU {
	var c CPU
	c.Name = C.GoString(&n.name[0])
	c.User = int64(n.user)
	c.Sys = int64(n.sys)
	c.Idle = int64(n.idle)
	c.Wait = int64(n.wait)
	c.PSwitch = int64(n.pswitch)
	c.Syscall = int64(n.syscall)
	c.Sysread = int64(n.sysread)
	c.Syswrite = int64(n.syswrite)
	c.Sysfork = int64(n.sysfork)
	c.Sysexec = int64(n.sysexec)
	c.Readch = int64(n.readch)
	c.Writech = int64(n.writech)
	c.Bread = int64(n.bread)
	c.Bwrite = int64(n.bwrite)
	c.Lread = int64(n.lread)
	c.Lwrite = int64(n.lwrite)
	c.Phread = int64(n.phread)
	c.Phwrite = int64(n.phwrite)
	c.Iget = int64(n.iget)
	c.Namei = int64(n.namei)
	c.Dirblk = int64(n.dirblk)
	c.Msg = int64(n.msg)
	c.Sema = int64(n.sema)
	c.MinFaults = int64(n.minfaults)
	c.MajFaults = int64(n.majfaults)
	c.PUser = int64(n.puser)
	c.PSys = int64(n.psys)
	c.PIdle = int64(n.pidle)
	c.PWait = int64(n.pwait)
	c.RedispSD0 = int64(n.redisp_sd0)
	c.RedispSD1 = int64(n.redisp_sd1)
	c.RedispSD2 = int64(n.redisp_sd2)
	c.RedispSD3 = int64(n.redisp_sd3)
	c.RedispSD4 = int64(n.redisp_sd4)
	c.RedispSD5 = int64(n.redisp_sd5)
	c.MigrationPush = int64(n.migration_push)
	c.MigrationS3grq = int64(n.migration_S3grq)
	c.MigrationS3pul = int64(n.migration_S3pul)
	c.InvolCSwitch = int64(n.invol_cswitch)
	c.VolCSwitch = int64(n.vol_cswitch)
	c.RunQueue = int64(n.runque)
	c.Bound = int64(n.bound)
	c.DecrIntrs = int64(n.decrintrs)
	c.MpcRIntrs = int64(n.mpcrintrs)
	c.MpcSIntrs = int64(n.mpcsintrs)
	c.SoftIntrs = int64(n.softintrs)
	c.DevIntrs = int64(n.devintrs)
	c.PhantIntrs = int64(n.phantintrs)
	c.IdleDonatedPurr = int64(n.idle_donated_purr)
	c.IdleDonatedSpurr = int64(n.idle_donated_spurr)
	c.BusyDonatedPurr = int64(n.busy_donated_purr)
	c.BusyDonatedSpurr = int64(n.busy_donated_spurr)
	c.IdleStolenPurr = int64(n.idle_stolen_purr)
	c.IdleStolenSpurr = int64(n.idle_stolen_spurr)
	c.BusyStolenPurr = int64(n.busy_stolen_purr)
	c.BusyStolenSpurr = int64(n.busy_stolen_spurr)
	c.Hpi = int64(n.hpi)
	c.Hpit = int64(n.hpit)
	c.PUserSpurr = int64(n.puser_spurr)
	c.PSysSpurr = int64(n.psys_spurr)
	c.PIdleSpurr = int64(n.pidle_spurr)
	c.PWaitSpurr = int64(n.pwait_spurr)
	c.SpurrFlag = int32(n.spurrflag)
	c.LocalDispatch = int64(n.localdispatch)
	c.NearDispatch = int64(n.neardispatch)
	c.FarDispatch = int64(n.fardispatch)
	c.CSwitches = int64(n.cswitches)
	c.Version = int64(n.version)
	c.TbLast = int64(n.tb_last)
	c.State = int(n.state)
	c.VtbLast = int64(n.vtb_last)
	c.ICountLast = int64(n.icount_last)
	return c
}

func perfstatcputotal2cputotal(n *C.perfstat_cpu_total_t) CPUTotal {
	var c CPUTotal
	c.NCpus = int(n.ncpus)
	c.NCpusCfg = int(n.ncpus_cfg)
	c.Description = C.GoString(&n.description[0])
	c.ProcessorHz = int64(n.processorHZ)
	c.User = int64(n.user)
	c.Sys = int64(n.sys)
	c.Idle = int64(n.idle)
	c.Wait = int64(n.wait)
	c.PSwitch = int64(n.pswitch)
	c.Syscall = int64(n.syscall)
	c.Sysread = int64(n.sysread)
	c.Syswrite = int64(n.syswrite)
	c.Sysfork = int64(n.sysfork)
	c.Sysexec = int64(n.sysexec)
	c.Readch = int64(n.readch)
	c.Writech = int64(n.writech)
	c.DevIntrs = int64(n.devintrs)
	c.SoftIntrs = int64(n.softintrs)
	c.Lbolt = int64(n.lbolt)
	c.LoadAvg1 = (float32(n.loadavg[0]) / (1 << C.SBITS))
	c.LoadAvg5 = (float32(n.loadavg[1]) / (1 << C.SBITS))
	c.LoadAvg15 = (float32(n.loadavg[2]) / (1 << C.SBITS))
	c.RunQueue = int64(n.runque)
	c.SwpQueue = int64(n.swpque)
	c.Bread = int64(n.bread)
	c.Bwrite = int64(n.bwrite)
	c.Lread = int64(n.lread)
	c.Lwrite = int64(n.lwrite)
	c.Phread = int64(n.phread)
	c.Phwrite = int64(n.phwrite)
	c.RunOcc = int64(n.runocc)
	c.SwpOcc = int64(n.swpocc)
	c.Iget = int64(n.iget)
	c.Namei = int64(n.namei)
	c.Dirblk = int64(n.dirblk)
	c.Msg = int64(n.msg)
	c.Sema = int64(n.sema)
	c.RcvInt = int64(n.rcvint)
	c.XmtInt = int64(n.xmtint)
	c.MdmInt = int64(n.mdmint)
	c.TtyRawInch = int64(n.tty_rawinch)
	c.TtyCanInch = int64(n.tty_caninch)
	c.TtyRawOutch = int64(n.tty_rawoutch)
	c.Ksched = int64(n.ksched)
	c.Koverf = int64(n.koverf)
	c.Kexit = int64(n.kexit)
	c.Rbread = int64(n.rbread)
	c.Rcread = int64(n.rcread)
	c.Rbwrt = int64(n.rbwrt)
	c.Rcwrt = int64(n.rcwrt)
	c.Traps = int64(n.traps)
	c.NCpusHigh = int64(n.ncpus_high)
	c.PUser = int64(n.puser)
	c.PSys = int64(n.psys)
	c.PIdle = int64(n.pidle)
	c.PWait = int64(n.pwait)
	c.DecrIntrs = int64(n.decrintrs)
	c.MpcRIntrs = int64(n.mpcrintrs)
	c.MpcSIntrs = int64(n.mpcsintrs)
	c.PhantIntrs = int64(n.phantintrs)
	c.IdleDonatedPurr = int64(n.idle_donated_purr)
	c.IdleDonatedSpurr = int64(n.idle_donated_spurr)
	c.BusyDonatedPurr = int64(n.busy_donated_purr)
	c.BusyDonatedSpurr = int64(n.busy_donated_spurr)
	c.IdleStolenPurr = int64(n.idle_stolen_purr)
	c.IdleStolenSpurr = int64(n.idle_stolen_spurr)
	c.BusyStolenPurr = int64(n.busy_stolen_purr)
	c.BusyStolenSpurr = int64(n.busy_stolen_spurr)
	c.IOWait = int32(n.iowait)
	c.PhysIO = int32(n.physio)
	c.TWait = int64(n.twait)
	c.Hpi = int64(n.hpi)
	c.Hpit = int64(n.hpit)
	c.PUserSpurr = int64(n.puser_spurr)
	c.PSysSpurr = int64(n.psys_spurr)
	c.PIdleSpurr = int64(n.pidle_spurr)
	c.PWaitSpurr = int64(n.pwait_spurr)
	c.SpurrFlag = int(n.spurrflag)
	c.Version = int64(n.version)
	c.TbLast = int64(n.tb_last)
	c.PurrCoalescing = int64(n.purr_coalescing)
	c.SpurrCoalescing = int64(n.spurr_coalescing)
	return c
}

func perfstatcpuutil2cpuutil(n *C.perfstat_cpu_util_t) CPUUtil {
	var c CPUUtil

	c.Version = int64(n.version)
	c.CpuID = C.GoString(&n.cpu_id[0])
	c.Entitlement = float32(n.entitlement)
	c.UserPct = float32(n.user_pct)
	c.KernPct = float32(n.kern_pct)
	c.IdlePct = float32(n.idle_pct)
	c.WaitPct = float32(n.wait_pct)
	c.PhysicalBusy = float32(n.physical_busy)
	c.PhysicalConsumed = float32(n.physical_consumed)
	c.FreqPct = float32(n.freq_pct)
	c.EntitlementPct = float32(n.entitlement_pct)
	c.BusyPct = float32(n.busy_pct)
	c.IdleDonatedPct = float32(n.idle_donated_pct)
	c.BusyDonatedPct = float32(n.busy_donated_pct)
	c.IdleStolenPct = float32(n.idle_stolen_pct)
	c.BusyStolenPct = float32(n.busy_stolen_pct)
	c.LUserPct = float32(n.l_user_pct)
	c.LKernPct = float32(n.l_kern_pct)
	c.LIdlePct = float32(n.l_idle_pct)
	c.LWaitPct = float32(n.l_wait_pct)
	c.DeltaTime = int64(n.delta_time)

	return c
}

func perfstatdisktotal2disktotal(n C.perfstat_disk_total_t) DiskTotal {
	var d DiskTotal

	d.Number = int32(n.number)
	d.Size = int64(n.size)
	d.Free = int64(n.free)
	d.XRate = int64(n.xrate)
	d.Xfers = int64(n.xfers)
	d.Wblks = int64(n.wblks)
	d.Rblks = int64(n.rblks)
	d.Time = int64(n.time)
	d.Version = int64(n.version)
	d.Rserv = int64(n.rserv)
	d.MinRserv = int64(n.min_rserv)
	d.MaxRserv = int64(n.max_rserv)
	d.RTimeOut = int64(n.rtimeout)
	d.RFailed = int64(n.rfailed)
	d.Wserv = int64(n.wserv)
	d.MinWserv = int64(n.min_wserv)
	d.MaxWserv = int64(n.max_wserv)
	d.WTimeOut = int64(n.wtimeout)
	d.WFailed = int64(n.wfailed)
	d.WqDepth = int64(n.wq_depth)
	d.WqTime = int64(n.wq_time)
	d.WqMinTime = int64(n.wq_min_time)
	d.WqMaxTime = int64(n.wq_max_time)

	return d
}

func perfstatdiskadapter2diskadapter(n *C.perfstat_diskadapter_t) DiskAdapter {
	var d DiskAdapter

	d.Name = C.GoString(&n.name[0])
	d.Description = C.GoString(&n.description[0])
	d.Number = int32(n.number)
	d.Size = int64(n.size)
	d.Free = int64(n.free)
	d.XRate = int64(n.xrate)
	d.Xfers = int64(n.xfers)
	d.Rblks = int64(n.rblks)
	d.Wblks = int64(n.wblks)
	d.Time = int64(n.time)
	d.Version = int64(n.version)
	d.AdapterType = int64(n.adapter_type)
	d.DkBSize = int64(n.dk_bsize)
	d.DkRserv = int64(n.dk_rserv)
	d.DkWserv = int64(n.dk_wserv)
	d.MinRserv = int64(n.min_rserv)
	d.MaxRserv = int64(n.max_rserv)
	d.MinWserv = int64(n.min_wserv)
	d.MaxWserv = int64(n.max_wserv)
	d.WqDepth = int64(n.wq_depth)
	d.WqSampled = int64(n.wq_sampled)
	d.WqTime = int64(n.wq_time)
	d.WqMinTime = int64(n.wq_min_time)
	d.WqMaxTime = int64(n.wq_max_time)
	d.QFull = int64(n.q_full)
	d.QSampled = int64(n.q_sampled)

	return d
}

func perfstatpartitionconfig2partitionconfig(n C.perfstat_partition_config_t) PartitionConfig {
	var p PartitionConfig
	p.Version = int64(n.version)
	p.Name = C.GoString(&n.partitionname[0])
	p.Node = C.GoString(&n.nodename[0])
	p.Conf.SmtCapable = (n.conf[0] & (1 << 7)) > 0
	p.Conf.SmtEnabled = (n.conf[0] & (1 << 6)) > 0
	p.Conf.LparCapable = (n.conf[0] & (1 << 5)) > 0
	p.Conf.LparEnabled = (n.conf[0] & (1 << 4)) > 0
	p.Conf.SharedCapable = (n.conf[0] & (1 << 3)) > 0
	p.Conf.SharedEnabled = (n.conf[0] & (1 << 2)) > 0
	p.Conf.DLparCapable = (n.conf[0] & (1 << 1)) > 0
	p.Conf.Capped = (n.conf[0] & (1 << 0)) > 0
	p.Conf.Kernel64bit = (n.conf[1] & (1 << 7)) > 0
	p.Conf.PoolUtilAuthority = (n.conf[1] & (1 << 6)) > 0
	p.Conf.DonateCapable = (n.conf[1] & (1 << 5)) > 0
	p.Conf.DonateEnabled = (n.conf[1] & (1 << 4)) > 0
	p.Conf.AmsCapable = (n.conf[1] & (1 << 3)) > 0
	p.Conf.AmsEnabled = (n.conf[1] & (1 << 2)) > 0
	p.Conf.PowerSave = (n.conf[1] & (1 << 1)) > 0
	p.Conf.AmeEnabled = (n.conf[1] & (1 << 0)) > 0
	p.Conf.SharedExtended = (n.conf[2] & (1 << 7)) > 0
	p.Number = int32(n.partitionnum)
	p.GroupID = int32(n.groupid)
	p.ProcessorFamily = C.GoString(&n.processorFamily[0])
	p.ProcessorModel = C.GoString(&n.processorModel[0])
	p.MachineID = C.GoString(&n.machineID[0])
	p.ProcessorMhz = float64(C.get_partition_mhz(n))
	p.NumProcessors.Online = int64(n.numProcessors.online)
	p.NumProcessors.Max = int64(n.numProcessors.max)
	p.NumProcessors.Min = int64(n.numProcessors.min)
	p.NumProcessors.Desired = int64(n.numProcessors.desired)
	p.OSName = C.GoString(&n.OSName[0])
	p.OSVersion = C.GoString(&n.OSVersion[0])
	p.OSBuild = C.GoString(&n.OSBuild[0])
	p.LCpus = int32(n.lcpus)
	p.SmtThreads = int32(n.smtthreads)
	p.Drives = int32(n.drives)
	p.NetworkAdapters = int32(n.nw_adapters)
	p.CpuCap.Online = int64(n.cpucap.online)
	p.CpuCap.Max = int64(n.cpucap.max)
	p.CpuCap.Min = int64(n.cpucap.min)
	p.CpuCap.Desired = int64(n.cpucap.desired)
	p.Weightage = int32(n.cpucap_weightage)
	p.EntCapacity = int32(n.entitled_proc_capacity)
	p.VCpus.Online = int64(n.vcpus.online)
	p.VCpus.Max = int64(n.vcpus.max)
	p.VCpus.Min = int64(n.vcpus.min)
	p.VCpus.Desired = int64(n.vcpus.desired)
	p.PoolID = int32(n.processor_poolid)
	p.ActiveCpusInPool = int32(n.activecpusinpool)
	p.PoolWeightage = int32(n.cpupool_weightage)
	p.SharedPCpu = int32(n.sharedpcpu)
	p.MaxPoolCap = int32(n.maxpoolcap)
	p.EntPoolCap = int32(n.entpoolcap)
	p.Mem.Online = int64(n.mem.online)
	p.Mem.Max = int64(n.mem.max)
	p.Mem.Min = int64(n.mem.min)
	p.Mem.Desired = int64(n.mem.desired)
	p.MemWeightage = int32(n.mem_weightage)
	p.TotalIOMemoryEntitlement = int64(n.totiomement)
	p.MemPoolID = int32(n.mempoolid)
	p.HyperPgSize = int64(n.hyperpgsize)
	p.ExpMem.Online = int64(n.exp_mem.online)
	p.ExpMem.Max = int64(n.exp_mem.max)
	p.ExpMem.Min = int64(n.exp_mem.min)
	p.ExpMem.Desired = int64(n.exp_mem.desired)
	p.TargetMemExpFactor = int64(n.targetmemexpfactor)
	p.TargetMemExpSize = int64(n.targetmemexpsize)
	p.SubProcessorMode = int32(n.subprocessor_mode)
	return p
}

func perfstatmemorytotal2memorytotal(n C.perfstat_memory_total_t) MemoryTotal {
	var m MemoryTotal
	m.VirtualTotal = int64(n.virt_total)
	m.RealTotal = int64(n.real_total)
	m.RealFree = int64(n.real_free)
	m.RealPinned = int64(n.real_pinned)
	m.RealInUse = int64(n.real_inuse)
	m.BadPages = int64(n.pgbad)
	m.PageFaults = int64(n.pgexct)
	m.PageIn = int64(n.pgins)
	m.PageOut = int64(n.pgouts)
	m.PgSpIn = int64(n.pgspins)
	m.PgSpOut = int64(n.pgspouts)
	m.Scans = int64(n.scans)
	m.Cycles = int64(n.cycles)
	m.PgSteals = int64(n.pgsteals)
	m.NumPerm = int64(n.numperm)
	m.PgSpTotal = int64(n.pgsp_total)
	m.PgSpFree = int64(n.pgsp_free)
	m.PgSpRsvd = int64(n.pgsp_rsvd)
	m.RealSystem = int64(n.real_system)
	m.RealUser = int64(n.real_user)
	m.RealProcess = int64(n.real_process)
	m.VirtualActive = int64(n.virt_active)
	m.IOME = int64(n.iome)
	m.IOMU = int64(n.iomu)
	m.IOHWM = int64(n.iohwm)
	m.PMem = int64(n.pmem)
	m.CompressedTotal = int64(n.comprsd_total)
	m.CompressedWSegPg = int64(n.comprsd_wseg_pgs)
	m.CPgIn = int64(n.cpgins)
	m.CPgOut = int64(n.cpgouts)
	m.TrueSize = int64(n.true_size)
	m.ExpandedMemory = int64(n.expanded_memory)
	m.CompressedWSegSize = int64(n.comprsd_wseg_size)
	m.TargetCPoolSize = int64(n.target_cpool_size)
	m.MaxCPoolSize = int64(n.max_cpool_size)
	m.MinUCPoolSize = int64(n.min_ucpool_size)
	m.CPoolSize = int64(n.cpool_size)
	m.UCPoolSize = int64(n.ucpool_size)
	m.CPoolInUse = int64(n.cpool_inuse)
	m.UCPoolInUse = int64(n.ucpool_inuse)
	m.Version = int64(n.version)
	m.RealAvailable = int64(n.real_avail)
	m.BytesCoalesced = int64(n.bytes_coalesced)
	m.BytesCoalescedMemPool = int64(n.bytes_coalesced_mempool)

	return m
}

func perfstatnetinterfacetotal2netifacetotal(n C.perfstat_netinterface_total_t) NetIfaceTotal {
	var i NetIfaceTotal

	i.Number = int32(n.number)
	i.IPackets = int64(n.ipackets)
	i.IBytes = int64(n.ibytes)
	i.IErrors = int64(n.ierrors)
	i.OPackets = int64(n.opackets)
	i.OBytes = int64(n.obytes)
	i.OErrors = int64(n.oerrors)
	i.Collisions = int64(n.collisions)
	i.XmitDrops = int64(n.xmitdrops)
	i.Version = int64(n.version)

	return i
}

func perfstatdisk2disk(n *C.perfstat_disk_t) Disk {
	var d Disk

	d.Name = C.GoString(&n.name[0])
	d.Description = C.GoString(&n.description[0])
	d.VGName = C.GoString(&n.vgname[0])
	d.Size = int64(n.size)
	d.Free = int64(n.free)
	d.BSize = int64(n.bsize)
	d.XRate = int64(n.xrate)
	d.Xfers = int64(n.xfers)
	d.Wblks = int64(n.wblks)
	d.Rblks = int64(n.rblks)
	d.QDepth = int64(n.qdepth)
	d.Time = int64(n.time)
	d.Adapter = C.GoString(&n.adapter[0])
	d.PathsCount = int32(n.paths_count)
	d.QFull = int64(n.q_full)
	d.Rserv = int64(n.rserv)
	d.RTimeOut = int64(n.rtimeout)
	d.Rfailed = int64(n.rfailed)
	d.MinRserv = int64(n.min_rserv)
	d.MaxRserv = int64(n.max_rserv)
	d.Wserv = int64(n.wserv)
	d.WTimeOut = int64(n.wtimeout)
	d.Wfailed = int64(n.wfailed)
	d.MinWserv = int64(n.min_wserv)
	d.MaxWserv = int64(n.max_wserv)
	d.WqDepth = int64(n.wq_depth)
	d.WqSampled = int64(n.wq_sampled)
	d.WqTime = int64(n.wq_time)
	d.WqMinTime = int64(n.wq_min_time)
	d.WqMaxTime = int64(n.wq_max_time)
	d.QSampled = int64(n.q_sampled)
	d.Version = int64(n.version)
	d.PseudoDisk = (n.dk_type[0] & (1 << 7)) > 0
	d.VTDisk = (n.dk_type[0] & (1 << 6)) > 0

	return d
}

func perfstatdiskpath2diskpath(n *C.perfstat_diskpath_t) DiskPath {
	var d DiskPath

	d.Name = C.GoString(&n.name[0])
	d.XRate = int64(n.xrate)
	d.Xfers = int64(n.xfers)
	d.Rblks = int64(n.rblks)
	d.Wblks = int64(n.wblks)
	d.Time = int64(n.time)
	d.Adapter = C.GoString(&n.adapter[0])
	d.QFull = int64(n.q_full)
	d.Rserv = int64(n.rserv)
	d.RTimeOut = int64(n.rtimeout)
	d.Rfailed = int64(n.rfailed)
	d.MinRserv = int64(n.min_rserv)
	d.MaxRserv = int64(n.max_rserv)
	d.Wserv = int64(n.wserv)
	d.WTimeOut = int64(n.wtimeout)
	d.Wfailed = int64(n.wfailed)
	d.MinWserv = int64(n.min_wserv)
	d.MaxWserv = int64(n.max_wserv)
	d.WqDepth = int64(n.wq_depth)
	d.WqSampled = int64(n.wq_sampled)
	d.WqTime = int64(n.wq_time)
	d.WqMinTime = int64(n.wq_min_time)
	d.WqMaxTime = int64(n.wq_max_time)
	d.QSampled = int64(n.q_sampled)
	d.Version = int64(n.version)

	return d
}

func perfstatfcstat2fcadapter(n *C.perfstat_fcstat_t) FCAdapter {
	var f FCAdapter

	f.Version = int64(n.version)
	f.Name = C.GoString(&n.name[0])
	f.State = int32(n.state)
	f.InputRequests = int64(n.InputRequests)
	f.OutputRequests = int64(n.OutputRequests)
	f.InputBytes = int64(n.InputBytes)
	f.OutputBytes = int64(n.OutputBytes)
	f.EffMaxTransfer = int64(n.EffMaxTransfer)
	f.NoDMAResourceCnt = int64(n.NoDMAResourceCnt)
	f.NoCmdResourceCnt = int64(n.NoCmdResourceCnt)
	f.AttentionType = int32(n.AttentionType)
	f.SecondsSinceLastReset = int64(n.SecondsSinceLastReset)
	f.TxFrames = int64(n.TxFrames)
	f.TxWords = int64(n.TxWords)
	f.RxFrames = int64(n.RxFrames)
	f.RxWords = int64(n.RxWords)
	f.LIPCount = int64(n.LIPCount)
	f.NOSCount = int64(n.NOSCount)
	f.ErrorFrames = int64(n.ErrorFrames)
	f.DumpedFrames = int64(n.DumpedFrames)
	f.LinkFailureCount = int64(n.LinkFailureCount)
	f.LossofSyncCount = int64(n.LossofSyncCount)
	f.LossofSignal = int64(n.LossofSignal)
	f.PrimitiveSeqProtocolErrCount = int64(n.PrimitiveSeqProtocolErrCount)
	f.InvalidTxWordCount = int64(n.InvalidTxWordCount)
	f.InvalidCRCCount = int64(n.InvalidCRCCount)
	f.PortFcId = int64(n.PortFcId)
	f.PortSpeed = int64(n.PortSpeed)
	f.PortType = C.GoString(&n.PortType[0])
	f.PortWWN = int64(n.PortWWN)
	f.PortSupportedSpeed = int64(n.PortSupportedSpeed)
	f.AdapterType = int(n.adapter_type)
	f.VfcName = C.GoString(&n.vfc_name[0])
	f.ClientPartName = C.GoString(&n.client_part_name[0])

	return f
}

func perfstatlogicalvolume2logicalvolume(n *C.perfstat_logicalvolume_t) LogicalVolume {
	var l LogicalVolume

	l.Name = C.GoString(&n.name[0])
	l.VGName = C.GoString(&n.vgname[0])
	l.OpenClose = int64(n.open_close)
	l.State = int64(n.state)
	l.MirrorPolicy = int64(n.mirror_policy)
	l.MirrorWriteConsistency = int64(n.mirror_write_consistency)
	l.WriteVerify = int64(n.write_verify)
	l.PPsize = int64(n.ppsize)
	l.LogicalPartitions = int64(n.logical_partitions)
	l.Mirrors = int32(n.mirrors)
	l.IOCnt = int64(n.iocnt)
	l.KBReads = int64(n.kbreads)
	l.KBWrites = int64(n.kbwrites)
	l.Version = int64(n.version)

	return l
}

func perfstatvolumegroup2volumegroup(n *C.perfstat_volumegroup_t) VolumeGroup {
	var v VolumeGroup

	v.Name = C.GoString(&n.name[0])
	v.TotalDisks = int64(n.total_disks)
	v.ActiveDisks = int64(n.active_disks)
	v.TotalLogicalVolumes = int64(n.total_logical_volumes)
	v.OpenedLogicalVolumes = int64(n.opened_logical_volumes)
	v.IOCnt = int64(n.iocnt)
	v.KBReads = int64(n.kbreads)
	v.KBWrites = int64(n.kbwrites)
	v.Version = int64(n.version)
	v.VariedState = int(n.variedState)

	return v
}

func perfstatmemorypage2memorypage(n *C.perfstat_memory_page_t) MemoryPage {
	var m MemoryPage

	m.PSize = int64(n.psize)
	m.RealTotal = int64(n.real_total)
	m.RealFree = int64(n.real_free)
	m.RealPinned = int64(n.real_pinned)
	m.RealInUse = int64(n.real_inuse)
	m.PgExct = int64(n.pgexct)
	m.PgIns = int64(n.pgins)
	m.PgOuts = int64(n.pgouts)
	m.PgSpIns = int64(n.pgspins)
	m.PgSpOuts = int64(n.pgspouts)
	m.Scans = int64(n.scans)
	m.Cycles = int64(n.cycles)
	m.PgSteals = int64(n.pgsteals)
	m.NumPerm = int64(n.numperm)
	m.NumPgSp = int64(n.numpgsp)
	m.RealSystem = int64(n.real_system)
	m.RealUser = int64(n.real_user)
	m.RealProcess = int64(n.real_process)
	m.VirtActive = int64(n.virt_active)
	m.ComprsdTotal = int64(n.comprsd_total)
	m.ComprsdWsegPgs = int64(n.comprsd_wseg_pgs)
	m.CPgIns = int64(n.cpgins)
	m.CPgOuts = int64(n.cpgouts)
	m.CPoolInUse = int64(n.cpool_inuse)
	m.UCPoolSize = int64(n.ucpool_size)
	m.ComprsdWsegSize = int64(n.comprsd_wseg_size)
	m.Version = int64(n.version)
	m.RealAvail = int64(n.real_avail)

	return m
}

func perfstatnetbuffer2netbuffer(n *C.perfstat_netbuffer_t) NetBuffer {
	var b NetBuffer

	b.Name = C.GoString(&n.name[0])
	b.InUse = int64(n.inuse)
	b.Calls = int64(n.calls)
	b.Delayed = int64(n.delayed)
	b.Free = int64(n.free)
	b.Failed = int64(n.failed)
	b.HighWatermark = int64(n.highwatermark)
	b.Freed = int64(n.freed)
	b.Version = int64(n.version)

	return b
}

func perfstatnetinterface2netiface(n *C.perfstat_netinterface_t) NetIface {
	var i NetIface

	i.Name = C.GoString(&n.name[0])
	i.Description = C.GoString(&n.description[0])
	i.Type = uint8(n._type)
	i.MTU = int64(n.mtu)
	i.IPackets = int64(n.ipackets)
	i.IBytes = int64(n.ibytes)
	i.IErrors = int64(n.ierrors)
	i.OPackets = int64(n.opackets)
	i.OBytes = int64(n.obytes)
	i.OErrors = int64(n.oerrors)
	i.Collisions = int64(n.collisions)
	i.Bitrate = int64(n.bitrate)
	i.XmitDrops = int64(n.xmitdrops)
	i.Version = int64(n.version)
	i.IfIqDrops = int64(n.if_iqdrops)
	i.IfArpDrops = int64(n.if_arpdrops)

	return i
}

func perfstatnetadapter2netadapter(n *C.perfstat_netadapter_t) NetAdapter {
	var i NetAdapter

	i.Version = int64(n.version)
	i.Name = C.GoString(&n.name[0])
	i.TxPackets = int64(n.tx_packets)
	i.TxBytes = int64(n.tx_bytes)
	i.TxInterrupts = int64(n.tx_interrupts)
	i.TxErrors = int64(n.tx_errors)
	i.TxPacketsDropped = int64(n.tx_packets_dropped)
	i.TxQueueSize = int64(n.tx_queue_size)
	i.TxQueueLen = int64(n.tx_queue_len)
	i.TxQueueOverflow = int64(n.tx_queue_overflow)
	i.TxBroadcastPackets = int64(n.tx_broadcast_packets)
	i.TxMulticastPackets = int64(n.tx_multicast_packets)
	i.TxCarrierSense = int64(n.tx_carrier_sense)
	i.TxDMAUnderrun = int64(n.tx_DMA_underrun)
	i.TxLostCTSErrors = int64(n.tx_lost_CTS_errors)
	i.TxMaxCollisionErrors = int64(n.tx_max_collision_errors)
	i.TxLateCollisionErrors = int64(n.tx_late_collision_errors)
	i.TxDeferred = int64(n.tx_deferred)
	i.TxTimeoutErrors = int64(n.tx_timeout_errors)
	i.TxSingleCollisionCount = int64(n.tx_single_collision_count)
	i.TxMultipleCollisionCount = int64(n.tx_multiple_collision_count)
	i.RxPackets = int64(n.rx_packets)
	i.RxBytes = int64(n.rx_bytes)
	i.RxInterrupts = int64(n.rx_interrupts)
	i.RxErrors = int64(n.rx_errors)
	i.RxPacketsDropped = int64(n.rx_packets_dropped)
	i.RxBadPackets = int64(n.rx_bad_packets)
	i.RxMulticastPackets = int64(n.rx_multicast_packets)
	i.RxBroadcastPackets = int64(n.rx_broadcast_packets)
	i.RxCRCErrors = int64(n.rx_CRC_errors)
	i.RxDMAOverrun = int64(n.rx_DMA_overrun)
	i.RxAlignmentErrors = int64(n.rx_alignment_errors)
	i.RxNoResourceErrors = int64(n.rx_noresource_errors)
	i.RxCollisionErrors = int64(n.rx_collision_errors)
	i.RxPacketTooShortErrors = int64(n.rx_packet_tooshort_errors)
	i.RxPacketTooLongErrors = int64(n.rx_packet_toolong_errors)
	i.RxPacketDiscardedByAdapter = int64(n.rx_packets_discardedbyadapter)
	i.AdapterType = int32(n.adapter_type)

	return i
}

func perfstatpagingspace2pagingspace(n *C.perfstat_pagingspace_t) PagingSpace {
	var i PagingSpace

	i.Name = C.GoString(&n.name[0])
	i.Type = uint8(n._type)
	i.VGName = C.GoString(C.get_ps_vgname(n))
	i.Hostname = C.GoString(C.get_ps_hostname(n))
	i.Filename = C.GoString(C.get_ps_filename(n))
	i.LPSize = int64(n.lp_size)
	i.MBSize = int64(n.mb_size)
	i.MBUsed = int64(n.mb_used)
	i.IOPending = int64(n.io_pending)
	i.Active = uint8(n.active)
	i.Automatic = uint8(n.automatic)
	i.Version = int64(n.version)

	return i
}

func perfstatprocess2process(n *C.perfstat_process_t) Process {
	var i Process

	i.Version = int64(n.version)
	i.PID = int64(n.pid)
	i.ProcessName = C.GoString(&n.proc_name[0])
	i.Priority = int32(n.proc_priority)
	i.NumThreads = int64(n.num_threads)
	i.UID = int64(n.proc_uid)
	i.ClassID = int64(n.proc_classid)
	i.Size = int64(n.proc_size)
	i.RealMemData = int64(n.proc_real_mem_data)
	i.RealMemText = int64(n.proc_real_mem_text)
	i.VirtMemData = int64(n.proc_virt_mem_data)
	i.VirtMemText = int64(n.proc_virt_mem_text)
	i.SharedLibDataSize = int64(n.shared_lib_data_size)
	i.HeapSize = int64(n.heap_size)
	i.RealInUse = int64(n.real_inuse)
	i.VirtInUse = int64(n.virt_inuse)
	i.Pinned = int64(n.pinned)
	i.PgSpInUse = int64(n.pgsp_inuse)
	i.FilePages = int64(n.filepages)
	i.RealInUseMap = int64(n.real_inuse_map)
	i.VirtInUseMap = int64(n.virt_inuse_map)
	i.PinnedInUseMap = int64(n.pinned_inuse_map)
	i.UCpuTime = float64(n.ucpu_time)
	i.SCpuTime = float64(n.scpu_time)
	i.LastTimeBase = int64(n.last_timebase)
	i.InBytes = int64(n.inBytes)
	i.OutBytes = int64(n.outBytes)
	i.InOps = int64(n.inOps)
	i.OutOps = int64(n.outOps)

	return i
}

func perfstatthread2thread(n *C.perfstat_thread_t) Thread {
	var i Thread

	i.TID = int64(n.tid)
	i.PID = int64(n.pid)
	i.CpuID = int64(n.cpuid)
	i.UCpuTime = float64(n.ucpu_time)
	i.SCpuTime = float64(n.scpu_time)
	i.LastTimeBase = int64(n.last_timebase)
	i.Version = int64(n.version)

	return i
}

func fsinfo2filesystem(n *C.struct_fsinfo) FileSystem {
	var i FileSystem

	i.Device = C.GoString(n.devname)
	i.MountPoint = C.GoString(n.fsname)
	i.FSType = int(n.fstype)
	i.Flags = uint(n.flags)
	i.TotalBlocks = int64(n.totalblks)
	i.FreeBlocks = int64(n.freeblks)
	i.TotalInodes = int64(n.totalinodes)
	i.FreeInodes = int64(n.freeinodes)

	return i
}

func lparinfo2partinfo(n C.lpar_info_format2_t) PartitionInfo {
	var i PartitionInfo

	i.Version = int(n.version)
	i.OnlineMemory = uint64(n.online_memory)
	i.TotalDispatchTime = uint64(n.tot_dispatch_time)
	i.PoolIdleTime = uint64(n.pool_idle_time)
	i.DispatchLatency = uint64(n.dispatch_latency)
	i.LparFlags = uint(n.lpar_flags)
	i.PCpusInSys = uint(n.pcpus_in_sys)
	i.OnlineVCpus = uint(n.online_vcpus)
	i.OnlineLCpus = uint(n.online_lcpus)
	i.PCpusInPool = uint(n.pcpus_in_pool)
	i.UnallocCapacity = uint(n.unalloc_capacity)
	i.EntitledCapacity = uint(n.entitled_capacity)
	i.VariableWeight = uint(n.variable_weight)
	i.UnallocWeight = uint(n.unalloc_weight)
	i.MinReqVCpuCapacity = uint(n.min_req_vcpu_capacity)
	i.GroupId = uint8(n.group_id)
	i.PoolId = uint8(n.pool_id)
	i.ShCpusInSys = uint(n.shcpus_in_sys)
	i.MaxPoolCapacity = uint(n.max_pool_capacity)
	i.EntitledPoolCapacity = uint(n.entitled_pool_capacity)
	i.PoolMaxTime = uint64(n.pool_max_time)
	i.PoolBusyTime = uint64(n.pool_busy_time)
	i.PoolScaledBusyTime = uint64(n.pool_scaled_busy_time)
	i.ShCpuTotalTime = uint64(n.shcpu_tot_time)
	i.ShCpuBusyTime = uint64(n.shcpu_busy_time)
	i.ShCpuScaledBusyTime = uint64(n.shcpu_scaled_busy_time)
	i.EntMemCapacity = uint64(n.ent_mem_capacity)
	i.PhysMem = uint64(n.phys_mem)
	i.VrmPoolPhysMem = uint64(n.vrm_pool_physmem)
	i.HypPageSize = uint(n.hyp_pagesize)
	i.VrmPoolId = int(n.vrm_pool_id)
	i.VrmGroupId = int(n.vrm_group_id)
	i.VarMemWeight = int(n.var_mem_weight)
	i.UnallocVarMemWeight = int(n.unalloc_var_mem_weight)
	i.UnallocEntMemCapacity = uint64(n.unalloc_ent_mem_capacity)
	i.TrueOnlineMemory = uint64(n.true_online_memory)
	i.AmeOnlineMemory = uint64(n.ame_online_memory)
	i.AmeType = uint8(n.ame_type)
	i.SpecExecMode = uint8(n.spec_exec_mode)
	i.AmeFactor = uint(n.ame_factor)
	i.EmPartMajorCode = uint(n.em_part_major_code)
	i.EmPartMinorCode = uint(n.em_part_minor_code)
	i.BytesCoalesced = uint64(n.bytes_coalesced)
	i.BytesCoalescedMemPool = uint64(n.bytes_coalesced_mempool)
	i.PurrCoalescing = uint64(n.purr_coalescing)
	i.SpurrCoalescing = uint64(n.spurr_coalescing)

	return i
}
