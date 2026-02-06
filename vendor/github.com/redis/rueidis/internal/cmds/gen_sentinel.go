// Code generated DO NOT EDIT

package cmds

type SentinelFailover Incomplete

func (b Builder) SentinelFailover() (c SentinelFailover) {
	c = SentinelFailover{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SENTINEL", "FAILOVER")
	return c
}

func (c SentinelFailover) Master(master string) SentinelFailoverMaster {
	c.cs.s = append(c.cs.s, master)
	return (SentinelFailoverMaster)(c)
}

type SentinelFailoverMaster Incomplete

func (c SentinelFailoverMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SentinelGetMasterAddrByName Incomplete

func (b Builder) SentinelGetMasterAddrByName() (c SentinelGetMasterAddrByName) {
	c = SentinelGetMasterAddrByName{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SENTINEL", "GET-MASTER-ADDR-BY-NAME")
	return c
}

func (c SentinelGetMasterAddrByName) Master(master string) SentinelGetMasterAddrByNameMaster {
	c.cs.s = append(c.cs.s, master)
	return (SentinelGetMasterAddrByNameMaster)(c)
}

type SentinelGetMasterAddrByNameMaster Incomplete

func (c SentinelGetMasterAddrByNameMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SentinelReplicas Incomplete

func (b Builder) SentinelReplicas() (c SentinelReplicas) {
	c = SentinelReplicas{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SENTINEL", "REPLICAS")
	return c
}

func (c SentinelReplicas) Master(master string) SentinelReplicasMaster {
	c.cs.s = append(c.cs.s, master)
	return (SentinelReplicasMaster)(c)
}

type SentinelReplicasMaster Incomplete

func (c SentinelReplicasMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SentinelSentinels Incomplete

func (b Builder) SentinelSentinels() (c SentinelSentinels) {
	c = SentinelSentinels{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SENTINEL", "SENTINELS")
	return c
}

func (c SentinelSentinels) Master(master string) SentinelSentinelsMaster {
	c.cs.s = append(c.cs.s, master)
	return (SentinelSentinelsMaster)(c)
}

type SentinelSentinelsMaster Incomplete

func (c SentinelSentinelsMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
