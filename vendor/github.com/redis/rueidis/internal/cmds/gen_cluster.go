// Code generated DO NOT EDIT

package cmds

import "strconv"

type Asking Incomplete

func (b Builder) Asking() (c Asking) {
	c = Asking{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "ASKING")
	return c
}

func (c Asking) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterAddslots Incomplete

func (b Builder) ClusterAddslots() (c ClusterAddslots) {
	c = ClusterAddslots{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "ADDSLOTS")
	return c
}

func (c ClusterAddslots) Slot(slot ...int64) ClusterAddslotsSlot {
	for _, n := range slot {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return (ClusterAddslotsSlot)(c)
}

type ClusterAddslotsSlot Incomplete

func (c ClusterAddslotsSlot) Slot(slot ...int64) ClusterAddslotsSlot {
	for _, n := range slot {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return c
}

func (c ClusterAddslotsSlot) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterAddslotsrange Incomplete

func (b Builder) ClusterAddslotsrange() (c ClusterAddslotsrange) {
	c = ClusterAddslotsrange{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "ADDSLOTSRANGE")
	return c
}

func (c ClusterAddslotsrange) StartSlotEndSlot() ClusterAddslotsrangeStartSlotEndSlot {
	return (ClusterAddslotsrangeStartSlotEndSlot)(c)
}

type ClusterAddslotsrangeStartSlotEndSlot Incomplete

func (c ClusterAddslotsrangeStartSlotEndSlot) StartSlotEndSlot(startSlot int64, endSlot int64) ClusterAddslotsrangeStartSlotEndSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(startSlot, 10), strconv.FormatInt(endSlot, 10))
	return c
}

func (c ClusterAddslotsrangeStartSlotEndSlot) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterBumpepoch Incomplete

func (b Builder) ClusterBumpepoch() (c ClusterBumpepoch) {
	c = ClusterBumpepoch{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "BUMPEPOCH")
	return c
}

func (c ClusterBumpepoch) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterCountFailureReports Incomplete

func (b Builder) ClusterCountFailureReports() (c ClusterCountFailureReports) {
	c = ClusterCountFailureReports{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "COUNT-FAILURE-REPORTS")
	return c
}

func (c ClusterCountFailureReports) NodeId(nodeId string) ClusterCountFailureReportsNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterCountFailureReportsNodeId)(c)
}

type ClusterCountFailureReportsNodeId Incomplete

func (c ClusterCountFailureReportsNodeId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterCountkeysinslot Incomplete

func (b Builder) ClusterCountkeysinslot() (c ClusterCountkeysinslot) {
	c = ClusterCountkeysinslot{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "COUNTKEYSINSLOT")
	return c
}

func (c ClusterCountkeysinslot) Slot(slot int64) ClusterCountkeysinslotSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(slot, 10))
	return (ClusterCountkeysinslotSlot)(c)
}

type ClusterCountkeysinslotSlot Incomplete

func (c ClusterCountkeysinslotSlot) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterDelslots Incomplete

func (b Builder) ClusterDelslots() (c ClusterDelslots) {
	c = ClusterDelslots{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "DELSLOTS")
	return c
}

func (c ClusterDelslots) Slot(slot ...int64) ClusterDelslotsSlot {
	for _, n := range slot {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return (ClusterDelslotsSlot)(c)
}

type ClusterDelslotsSlot Incomplete

func (c ClusterDelslotsSlot) Slot(slot ...int64) ClusterDelslotsSlot {
	for _, n := range slot {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return c
}

func (c ClusterDelslotsSlot) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterDelslotsrange Incomplete

func (b Builder) ClusterDelslotsrange() (c ClusterDelslotsrange) {
	c = ClusterDelslotsrange{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "DELSLOTSRANGE")
	return c
}

func (c ClusterDelslotsrange) StartSlotEndSlot() ClusterDelslotsrangeStartSlotEndSlot {
	return (ClusterDelslotsrangeStartSlotEndSlot)(c)
}

type ClusterDelslotsrangeStartSlotEndSlot Incomplete

func (c ClusterDelslotsrangeStartSlotEndSlot) StartSlotEndSlot(startSlot int64, endSlot int64) ClusterDelslotsrangeStartSlotEndSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(startSlot, 10), strconv.FormatInt(endSlot, 10))
	return c
}

func (c ClusterDelslotsrangeStartSlotEndSlot) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterFailover Incomplete

func (b Builder) ClusterFailover() (c ClusterFailover) {
	c = ClusterFailover{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "FAILOVER")
	return c
}

func (c ClusterFailover) Force() ClusterFailoverOptionsForce {
	c.cs.s = append(c.cs.s, "FORCE")
	return (ClusterFailoverOptionsForce)(c)
}

func (c ClusterFailover) Takeover() ClusterFailoverOptionsTakeover {
	c.cs.s = append(c.cs.s, "TAKEOVER")
	return (ClusterFailoverOptionsTakeover)(c)
}

func (c ClusterFailover) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterFailoverOptionsForce Incomplete

func (c ClusterFailoverOptionsForce) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterFailoverOptionsTakeover Incomplete

func (c ClusterFailoverOptionsTakeover) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterFlushslots Incomplete

func (b Builder) ClusterFlushslots() (c ClusterFlushslots) {
	c = ClusterFlushslots{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "FLUSHSLOTS")
	return c
}

func (c ClusterFlushslots) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterForget Incomplete

func (b Builder) ClusterForget() (c ClusterForget) {
	c = ClusterForget{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "FORGET")
	return c
}

func (c ClusterForget) NodeId(nodeId string) ClusterForgetNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterForgetNodeId)(c)
}

type ClusterForgetNodeId Incomplete

func (c ClusterForgetNodeId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterGetkeysinslot Incomplete

func (b Builder) ClusterGetkeysinslot() (c ClusterGetkeysinslot) {
	c = ClusterGetkeysinslot{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "GETKEYSINSLOT")
	return c
}

func (c ClusterGetkeysinslot) Slot(slot int64) ClusterGetkeysinslotSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(slot, 10))
	return (ClusterGetkeysinslotSlot)(c)
}

type ClusterGetkeysinslotCount Incomplete

func (c ClusterGetkeysinslotCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterGetkeysinslotSlot Incomplete

func (c ClusterGetkeysinslotSlot) Count(count int64) ClusterGetkeysinslotCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (ClusterGetkeysinslotCount)(c)
}

type ClusterInfo Incomplete

func (b Builder) ClusterInfo() (c ClusterInfo) {
	c = ClusterInfo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "INFO")
	return c
}

func (c ClusterInfo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterKeyslot Incomplete

func (b Builder) ClusterKeyslot() (c ClusterKeyslot) {
	c = ClusterKeyslot{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "KEYSLOT")
	return c
}

func (c ClusterKeyslot) Key(key string) ClusterKeyslotKey {
	c.cs.s = append(c.cs.s, key)
	return (ClusterKeyslotKey)(c)
}

type ClusterKeyslotKey Incomplete

func (c ClusterKeyslotKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterLinks Incomplete

func (b Builder) ClusterLinks() (c ClusterLinks) {
	c = ClusterLinks{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "LINKS")
	return c
}

func (c ClusterLinks) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterMeet Incomplete

func (b Builder) ClusterMeet() (c ClusterMeet) {
	c = ClusterMeet{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "MEET")
	return c
}

func (c ClusterMeet) Ip(ip string) ClusterMeetIp {
	c.cs.s = append(c.cs.s, ip)
	return (ClusterMeetIp)(c)
}

type ClusterMeetClusterBusPort Incomplete

func (c ClusterMeetClusterBusPort) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterMeetIp Incomplete

func (c ClusterMeetIp) Port(port int64) ClusterMeetPort {
	c.cs.s = append(c.cs.s, strconv.FormatInt(port, 10))
	return (ClusterMeetPort)(c)
}

type ClusterMeetPort Incomplete

func (c ClusterMeetPort) ClusterBusPort(clusterBusPort int64) ClusterMeetClusterBusPort {
	c.cs.s = append(c.cs.s, strconv.FormatInt(clusterBusPort, 10))
	return (ClusterMeetClusterBusPort)(c)
}

func (c ClusterMeetPort) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterMyid Incomplete

func (b Builder) ClusterMyid() (c ClusterMyid) {
	c = ClusterMyid{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "MYID")
	return c
}

func (c ClusterMyid) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterMyshardid Incomplete

func (b Builder) ClusterMyshardid() (c ClusterMyshardid) {
	c = ClusterMyshardid{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "MYSHARDID")
	return c
}

func (c ClusterMyshardid) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterNodes Incomplete

func (b Builder) ClusterNodes() (c ClusterNodes) {
	c = ClusterNodes{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "NODES")
	return c
}

func (c ClusterNodes) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterReplicas Incomplete

func (b Builder) ClusterReplicas() (c ClusterReplicas) {
	c = ClusterReplicas{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "REPLICAS")
	return c
}

func (c ClusterReplicas) NodeId(nodeId string) ClusterReplicasNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterReplicasNodeId)(c)
}

type ClusterReplicasNodeId Incomplete

func (c ClusterReplicasNodeId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterReplicate Incomplete

func (b Builder) ClusterReplicate() (c ClusterReplicate) {
	c = ClusterReplicate{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "REPLICATE")
	return c
}

func (c ClusterReplicate) NodeId(nodeId string) ClusterReplicateNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterReplicateNodeId)(c)
}

type ClusterReplicateNodeId Incomplete

func (c ClusterReplicateNodeId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterReset Incomplete

func (b Builder) ClusterReset() (c ClusterReset) {
	c = ClusterReset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "RESET")
	return c
}

func (c ClusterReset) Hard() ClusterResetResetTypeHard {
	c.cs.s = append(c.cs.s, "HARD")
	return (ClusterResetResetTypeHard)(c)
}

func (c ClusterReset) Soft() ClusterResetResetTypeSoft {
	c.cs.s = append(c.cs.s, "SOFT")
	return (ClusterResetResetTypeSoft)(c)
}

func (c ClusterReset) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterResetResetTypeHard Incomplete

func (c ClusterResetResetTypeHard) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterResetResetTypeSoft Incomplete

func (c ClusterResetResetTypeSoft) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSaveconfig Incomplete

func (b Builder) ClusterSaveconfig() (c ClusterSaveconfig) {
	c = ClusterSaveconfig{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SAVECONFIG")
	return c
}

func (c ClusterSaveconfig) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetConfigEpoch Incomplete

func (b Builder) ClusterSetConfigEpoch() (c ClusterSetConfigEpoch) {
	c = ClusterSetConfigEpoch{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SET-CONFIG-EPOCH")
	return c
}

func (c ClusterSetConfigEpoch) ConfigEpoch(configEpoch int64) ClusterSetConfigEpochConfigEpoch {
	c.cs.s = append(c.cs.s, strconv.FormatInt(configEpoch, 10))
	return (ClusterSetConfigEpochConfigEpoch)(c)
}

type ClusterSetConfigEpochConfigEpoch Incomplete

func (c ClusterSetConfigEpochConfigEpoch) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetslot Incomplete

func (b Builder) ClusterSetslot() (c ClusterSetslot) {
	c = ClusterSetslot{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SETSLOT")
	return c
}

func (c ClusterSetslot) Slot(slot int64) ClusterSetslotSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(slot, 10))
	return (ClusterSetslotSlot)(c)
}

type ClusterSetslotNodeId Incomplete

func (c ClusterSetslotNodeId) Timeout(timeout int64) ClusterSetslotTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (ClusterSetslotTimeout)(c)
}

func (c ClusterSetslotNodeId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetslotSlot Incomplete

func (c ClusterSetslotSlot) Importing() ClusterSetslotSubcommandImporting {
	c.cs.s = append(c.cs.s, "IMPORTING")
	return (ClusterSetslotSubcommandImporting)(c)
}

func (c ClusterSetslotSlot) Migrating() ClusterSetslotSubcommandMigrating {
	c.cs.s = append(c.cs.s, "MIGRATING")
	return (ClusterSetslotSubcommandMigrating)(c)
}

func (c ClusterSetslotSlot) Stable() ClusterSetslotSubcommandStable {
	c.cs.s = append(c.cs.s, "STABLE")
	return (ClusterSetslotSubcommandStable)(c)
}

func (c ClusterSetslotSlot) Node() ClusterSetslotSubcommandNode {
	c.cs.s = append(c.cs.s, "NODE")
	return (ClusterSetslotSubcommandNode)(c)
}

type ClusterSetslotSubcommandImporting Incomplete

func (c ClusterSetslotSubcommandImporting) NodeId(nodeId string) ClusterSetslotNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterSetslotNodeId)(c)
}

func (c ClusterSetslotSubcommandImporting) Timeout(timeout int64) ClusterSetslotTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (ClusterSetslotTimeout)(c)
}

func (c ClusterSetslotSubcommandImporting) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetslotSubcommandMigrating Incomplete

func (c ClusterSetslotSubcommandMigrating) NodeId(nodeId string) ClusterSetslotNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterSetslotNodeId)(c)
}

func (c ClusterSetslotSubcommandMigrating) Timeout(timeout int64) ClusterSetslotTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (ClusterSetslotTimeout)(c)
}

func (c ClusterSetslotSubcommandMigrating) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetslotSubcommandNode Incomplete

func (c ClusterSetslotSubcommandNode) NodeId(nodeId string) ClusterSetslotNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterSetslotNodeId)(c)
}

func (c ClusterSetslotSubcommandNode) Timeout(timeout int64) ClusterSetslotTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (ClusterSetslotTimeout)(c)
}

func (c ClusterSetslotSubcommandNode) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetslotSubcommandStable Incomplete

func (c ClusterSetslotSubcommandStable) NodeId(nodeId string) ClusterSetslotNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterSetslotNodeId)(c)
}

func (c ClusterSetslotSubcommandStable) Timeout(timeout int64) ClusterSetslotTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT", strconv.FormatInt(timeout, 10))
	return (ClusterSetslotTimeout)(c)
}

func (c ClusterSetslotSubcommandStable) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSetslotTimeout Incomplete

func (c ClusterSetslotTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterShards Incomplete

func (b Builder) ClusterShards() (c ClusterShards) {
	c = ClusterShards{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SHARDS")
	return c
}

func (c ClusterShards) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlaves Incomplete

func (b Builder) ClusterSlaves() (c ClusterSlaves) {
	c = ClusterSlaves{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SLAVES")
	return c
}

func (c ClusterSlaves) NodeId(nodeId string) ClusterSlavesNodeId {
	c.cs.s = append(c.cs.s, nodeId)
	return (ClusterSlavesNodeId)(c)
}

type ClusterSlavesNodeId Incomplete

func (c ClusterSlavesNodeId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlotStats Incomplete

func (b Builder) ClusterSlotStats() (c ClusterSlotStats) {
	c = ClusterSlotStats{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SLOT-STATS")
	return c
}

func (c ClusterSlotStats) Slotsrange() ClusterSlotStatsFilterSlotsrangeSlotsrange {
	c.cs.s = append(c.cs.s, "SLOTSRANGE")
	return (ClusterSlotStatsFilterSlotsrangeSlotsrange)(c)
}

func (c ClusterSlotStats) Orderby() ClusterSlotStatsFilterOrderbyOrderby {
	c.cs.s = append(c.cs.s, "ORDERBY")
	return (ClusterSlotStatsFilterOrderbyOrderby)(c)
}

type ClusterSlotStatsFilterOrderbyLimit Incomplete

func (c ClusterSlotStatsFilterOrderbyLimit) Asc() ClusterSlotStatsFilterOrderbyOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (ClusterSlotStatsFilterOrderbyOrderAsc)(c)
}

func (c ClusterSlotStatsFilterOrderbyLimit) Desc() ClusterSlotStatsFilterOrderbyOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (ClusterSlotStatsFilterOrderbyOrderDesc)(c)
}

func (c ClusterSlotStatsFilterOrderbyLimit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlotStatsFilterOrderbyMetric Incomplete

func (c ClusterSlotStatsFilterOrderbyMetric) Limit(limit int64) ClusterSlotStatsFilterOrderbyLimit {
	c.cs.s = append(c.cs.s, strconv.FormatInt(limit, 10))
	return (ClusterSlotStatsFilterOrderbyLimit)(c)
}

func (c ClusterSlotStatsFilterOrderbyMetric) Asc() ClusterSlotStatsFilterOrderbyOrderAsc {
	c.cs.s = append(c.cs.s, "ASC")
	return (ClusterSlotStatsFilterOrderbyOrderAsc)(c)
}

func (c ClusterSlotStatsFilterOrderbyMetric) Desc() ClusterSlotStatsFilterOrderbyOrderDesc {
	c.cs.s = append(c.cs.s, "DESC")
	return (ClusterSlotStatsFilterOrderbyOrderDesc)(c)
}

func (c ClusterSlotStatsFilterOrderbyMetric) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlotStatsFilterOrderbyOrderAsc Incomplete

func (c ClusterSlotStatsFilterOrderbyOrderAsc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlotStatsFilterOrderbyOrderDesc Incomplete

func (c ClusterSlotStatsFilterOrderbyOrderDesc) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlotStatsFilterOrderbyOrderby Incomplete

func (c ClusterSlotStatsFilterOrderbyOrderby) Metric(metric string) ClusterSlotStatsFilterOrderbyMetric {
	c.cs.s = append(c.cs.s, metric)
	return (ClusterSlotStatsFilterOrderbyMetric)(c)
}

type ClusterSlotStatsFilterSlotsrangeEndSlot Incomplete

func (c ClusterSlotStatsFilterSlotsrangeEndSlot) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClusterSlotStatsFilterSlotsrangeSlotsrange Incomplete

func (c ClusterSlotStatsFilterSlotsrangeSlotsrange) StartSlot(startSlot int64) ClusterSlotStatsFilterSlotsrangeStartSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(startSlot, 10))
	return (ClusterSlotStatsFilterSlotsrangeStartSlot)(c)
}

type ClusterSlotStatsFilterSlotsrangeStartSlot Incomplete

func (c ClusterSlotStatsFilterSlotsrangeStartSlot) EndSlot(endSlot int64) ClusterSlotStatsFilterSlotsrangeEndSlot {
	c.cs.s = append(c.cs.s, strconv.FormatInt(endSlot, 10))
	return (ClusterSlotStatsFilterSlotsrangeEndSlot)(c)
}

type ClusterSlots Incomplete

func (b Builder) ClusterSlots() (c ClusterSlots) {
	c = ClusterSlots{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLUSTER", "SLOTS")
	return c
}

func (c ClusterSlots) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Readonly Incomplete

func (b Builder) Readonly() (c Readonly) {
	c = Readonly{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "READONLY")
	return c
}

func (c Readonly) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Readwrite Incomplete

func (b Builder) Readwrite() (c Readwrite) {
	c = Readwrite{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "READWRITE")
	return c
}

func (c Readwrite) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
