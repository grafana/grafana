// Code generated DO NOT EDIT

package cmds

import "strconv"

type Auth Incomplete

func (b Builder) Auth() (c Auth) {
	c = Auth{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "AUTH")
	return c
}

func (c Auth) Username(username string) AuthUsername {
	c.cs.s = append(c.cs.s, username)
	return (AuthUsername)(c)
}

func (c Auth) Password(password string) AuthPassword {
	c.cs.s = append(c.cs.s, password)
	return (AuthPassword)(c)
}

type AuthPassword Incomplete

func (c AuthPassword) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type AuthUsername Incomplete

func (c AuthUsername) Password(password string) AuthPassword {
	c.cs.s = append(c.cs.s, password)
	return (AuthPassword)(c)
}

type ClientCaching Incomplete

func (b Builder) ClientCaching() (c ClientCaching) {
	c = ClientCaching{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "CACHING")
	return c
}

func (c ClientCaching) Yes() ClientCachingModeYes {
	c.cs.s = append(c.cs.s, "YES")
	return (ClientCachingModeYes)(c)
}

func (c ClientCaching) No() ClientCachingModeNo {
	c.cs.s = append(c.cs.s, "NO")
	return (ClientCachingModeNo)(c)
}

type ClientCachingModeNo Incomplete

func (c ClientCachingModeNo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientCachingModeYes Incomplete

func (c ClientCachingModeYes) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientCapa Incomplete

func (b Builder) ClientCapa() (c ClientCapa) {
	c = ClientCapa{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "CAPA")
	return c
}

func (c ClientCapa) Capability(capability ...string) ClientCapaCapability {
	c.cs.s = append(c.cs.s, capability...)
	return (ClientCapaCapability)(c)
}

type ClientCapaCapability Incomplete

func (c ClientCapaCapability) Capability(capability ...string) ClientCapaCapability {
	c.cs.s = append(c.cs.s, capability...)
	return c
}

func (c ClientCapaCapability) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientGetname Incomplete

func (b Builder) ClientGetname() (c ClientGetname) {
	c = ClientGetname{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "GETNAME")
	return c
}

func (c ClientGetname) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientGetredir Incomplete

func (b Builder) ClientGetredir() (c ClientGetredir) {
	c = ClientGetredir{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "GETREDIR")
	return c
}

func (c ClientGetredir) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientId Incomplete

func (b Builder) ClientId() (c ClientId) {
	c = ClientId{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "ID")
	return c
}

func (c ClientId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientInfo Incomplete

func (b Builder) ClientInfo() (c ClientInfo) {
	c = ClientInfo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "INFO")
	return c
}

func (c ClientInfo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKill Incomplete

func (b Builder) ClientKill() (c ClientKill) {
	c = ClientKill{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "KILL")
	return c
}

func (c ClientKill) IpPort(ipPort string) ClientKillIpPort {
	c.cs.s = append(c.cs.s, ipPort)
	return (ClientKillIpPort)(c)
}

func (c ClientKill) Id(clientId int64) ClientKillId {
	c.cs.s = append(c.cs.s, "ID", strconv.FormatInt(clientId, 10))
	return (ClientKillId)(c)
}

func (c ClientKill) TypeNormal() ClientKillTypeNormal {
	c.cs.s = append(c.cs.s, "TYPE", "NORMAL")
	return (ClientKillTypeNormal)(c)
}

func (c ClientKill) TypeMaster() ClientKillTypeMaster {
	c.cs.s = append(c.cs.s, "TYPE", "MASTER")
	return (ClientKillTypeMaster)(c)
}

func (c ClientKill) TypePrimary() ClientKillTypePrimary {
	c.cs.s = append(c.cs.s, "TYPE", "PRIMARY")
	return (ClientKillTypePrimary)(c)
}

func (c ClientKill) TypeSlave() ClientKillTypeSlave {
	c.cs.s = append(c.cs.s, "TYPE", "SLAVE")
	return (ClientKillTypeSlave)(c)
}

func (c ClientKill) TypeReplica() ClientKillTypeReplica {
	c.cs.s = append(c.cs.s, "TYPE", "REPLICA")
	return (ClientKillTypeReplica)(c)
}

func (c ClientKill) TypePubsub() ClientKillTypePubsub {
	c.cs.s = append(c.cs.s, "TYPE", "PUBSUB")
	return (ClientKillTypePubsub)(c)
}

func (c ClientKill) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKill) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKill) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKill) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKill) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKill) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKill) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKill) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKill) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKill) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKill) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKill) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKill) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKill) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKill) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKill) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKill) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKill) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKill) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKill) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKill) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKill) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKill) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKill) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKill) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKill) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKill) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKill) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKill) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKill) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKill) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKill) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillAddr Incomplete

func (c ClientKillAddr) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillAddr) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillAddr) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillAddr) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillAddr) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillAddr) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillAddr) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillAddr) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillAddr) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillAddr) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillAddr) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillAddr) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillAddr) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillAddr) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillAddr) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillAddr) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillAddr) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillAddr) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillAddr) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillAddr) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillAddr) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillAddr) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillAddr) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillAddr) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillAddr) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillAddr) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillAddr) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillAddr) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillAddr) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillAddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillCapa Incomplete

func (c ClientKillCapa) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillCapa) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillCapa) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillCapa) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillCapa) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillCapa) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillCapa) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillCapa) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillCapa) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillCapa) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillCapa) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillCapa) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillCapa) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillCapa) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillCapa) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillCapa) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillCapa) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillCapa) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillCapa) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillDb Incomplete

func (c ClientKillDb) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillDb) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillDb) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillDb) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillDb) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillDb) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillDb) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillDb) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillDb) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillDb) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillDb) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillDb) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillDb) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillDb) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillDb) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillDb) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillDb) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillDb) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillDb) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillDb) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillFlags Incomplete

func (c ClientKillFlags) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillFlags) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillFlags) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillFlags) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillFlags) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillFlags) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillFlags) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillFlags) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillFlags) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillFlags) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillFlags) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillFlags) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillFlags) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillFlags) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillFlags) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillFlags) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillFlags) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillFlags) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillFlags) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillFlags) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillFlags) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillFlags) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillFlags) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillId Incomplete

func (c ClientKillId) TypeNormal() ClientKillTypeNormal {
	c.cs.s = append(c.cs.s, "TYPE", "NORMAL")
	return (ClientKillTypeNormal)(c)
}

func (c ClientKillId) TypeMaster() ClientKillTypeMaster {
	c.cs.s = append(c.cs.s, "TYPE", "MASTER")
	return (ClientKillTypeMaster)(c)
}

func (c ClientKillId) TypePrimary() ClientKillTypePrimary {
	c.cs.s = append(c.cs.s, "TYPE", "PRIMARY")
	return (ClientKillTypePrimary)(c)
}

func (c ClientKillId) TypeSlave() ClientKillTypeSlave {
	c.cs.s = append(c.cs.s, "TYPE", "SLAVE")
	return (ClientKillTypeSlave)(c)
}

func (c ClientKillId) TypeReplica() ClientKillTypeReplica {
	c.cs.s = append(c.cs.s, "TYPE", "REPLICA")
	return (ClientKillTypeReplica)(c)
}

func (c ClientKillId) TypePubsub() ClientKillTypePubsub {
	c.cs.s = append(c.cs.s, "TYPE", "PUBSUB")
	return (ClientKillTypePubsub)(c)
}

func (c ClientKillId) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillId) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillId) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillId) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillId) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillId) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillId) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillId) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillId) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillId) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillId) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillId) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillId) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillId) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillId) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillId) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillId) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillId) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillId) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillId) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillId) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillId) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillId) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillId) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillId) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillId) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillId) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillId) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillId) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillId) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillId) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillIdle Incomplete

func (c ClientKillIdle) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillIdle) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillIdle) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillIdle) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillIdle) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillIdle) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillIdle) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillIdle) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillIdle) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillIdle) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillIdle) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillIdle) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillIdle) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillIdle) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillIdle) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillIdle) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillIdle) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillIdle) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillIdle) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillIdle) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillIdle) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillIdle) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillIdle) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillIdle) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillIp Incomplete

func (c ClientKillIp) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillIp) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillIp) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillIp) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillIp) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillIp) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillIp) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillIp) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillIp) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillIp) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillIp) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillIp) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillIp) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillIp) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillIp) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillIp) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillIp) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillIp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillIpPort Incomplete

func (c ClientKillIpPort) Id(clientId int64) ClientKillId {
	c.cs.s = append(c.cs.s, "ID", strconv.FormatInt(clientId, 10))
	return (ClientKillId)(c)
}

func (c ClientKillIpPort) TypeNormal() ClientKillTypeNormal {
	c.cs.s = append(c.cs.s, "TYPE", "NORMAL")
	return (ClientKillTypeNormal)(c)
}

func (c ClientKillIpPort) TypeMaster() ClientKillTypeMaster {
	c.cs.s = append(c.cs.s, "TYPE", "MASTER")
	return (ClientKillTypeMaster)(c)
}

func (c ClientKillIpPort) TypePrimary() ClientKillTypePrimary {
	c.cs.s = append(c.cs.s, "TYPE", "PRIMARY")
	return (ClientKillTypePrimary)(c)
}

func (c ClientKillIpPort) TypeSlave() ClientKillTypeSlave {
	c.cs.s = append(c.cs.s, "TYPE", "SLAVE")
	return (ClientKillTypeSlave)(c)
}

func (c ClientKillIpPort) TypeReplica() ClientKillTypeReplica {
	c.cs.s = append(c.cs.s, "TYPE", "REPLICA")
	return (ClientKillTypeReplica)(c)
}

func (c ClientKillIpPort) TypePubsub() ClientKillTypePubsub {
	c.cs.s = append(c.cs.s, "TYPE", "PUBSUB")
	return (ClientKillTypePubsub)(c)
}

func (c ClientKillIpPort) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillIpPort) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillIpPort) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillIpPort) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillIpPort) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillIpPort) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillIpPort) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillIpPort) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillIpPort) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillIpPort) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillIpPort) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillIpPort) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillIpPort) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillIpPort) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillIpPort) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillIpPort) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillIpPort) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillIpPort) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillIpPort) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillIpPort) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillIpPort) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillIpPort) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillIpPort) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillIpPort) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillIpPort) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillIpPort) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillIpPort) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillIpPort) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillIpPort) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillIpPort) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillIpPort) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillIpPort) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillLaddr Incomplete

func (c ClientKillLaddr) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillLaddr) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillLaddr) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillLaddr) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillLaddr) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillLaddr) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillLaddr) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillLaddr) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillLaddr) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillLaddr) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillLaddr) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillLaddr) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillLaddr) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillLaddr) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillLaddr) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillLaddr) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillLaddr) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillLaddr) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillLaddr) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillLaddr) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillLaddr) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillLaddr) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillLaddr) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillLaddr) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillLaddr) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillLaddr) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillLaddr) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillLaddr) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillLaddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillLibName Incomplete

func (c ClientKillLibName) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillLibName) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillLibName) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillLibName) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillLibName) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillLibName) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillLibName) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillLibName) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillLibName) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillLibName) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillLibName) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillLibName) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillLibName) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillLibName) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillLibName) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillLibName) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillLibName) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillLibName) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillLibName) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillLibName) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillLibName) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillLibName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillLibVer Incomplete

func (c ClientKillLibVer) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillLibVer) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillLibVer) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillLibVer) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillLibVer) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillLibVer) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillLibVer) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillLibVer) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillLibVer) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillLibVer) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillLibVer) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillLibVer) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillLibVer) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillLibVer) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillLibVer) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillLibVer) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillLibVer) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillLibVer) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillLibVer) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillLibVer) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillLibVer) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillMaxage Incomplete

func (c ClientKillMaxage) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillMaxage) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillMaxage) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillMaxage) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillMaxage) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillMaxage) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillMaxage) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillMaxage) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillMaxage) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillMaxage) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillMaxage) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillMaxage) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillMaxage) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillMaxage) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillMaxage) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillMaxage) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillMaxage) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillMaxage) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillMaxage) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillMaxage) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillMaxage) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillMaxage) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillMaxage) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillMaxage) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillMaxage) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillMaxage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillName Incomplete

func (c ClientKillName) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillName) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillName) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillName) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillName) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillName) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillName) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillName) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillName) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillName) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillName) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillName) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillName) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillName) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillName) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillName) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillName) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillName) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillName) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillName) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillName) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillName) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillName) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillName) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotAddr Incomplete

func (c ClientKillNotAddr) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotAddr) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotAddr) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotAddr) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotAddr) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotAddr) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotAddr) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotAddr) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotAddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotCapa Incomplete

func (c ClientKillNotCapa) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotCapa) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotDb Incomplete

func (c ClientKillNotDb) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotDb) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotDb) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotFlags Incomplete

func (c ClientKillNotFlags) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotFlags) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotFlags) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotFlags) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotFlags) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotFlags) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotIdNotClientId Incomplete

func (c ClientKillNotIdNotClientId) NotClientId(notClientId ...int64) ClientKillNotIdNotClientId {
	for _, n := range notClientId {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return c
}

func (c ClientKillNotIdNotClientId) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotIdNotClientId) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotIdNotClientId) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotIdNotClientId) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotIdNotClientId) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotIdNotClientId) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotIdNotClientId) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotIdNotClientId) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotIdNotClientId) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotIdNotClientId) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotIdNotClientId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotIdNotId Incomplete

func (c ClientKillNotIdNotId) NotClientId(notClientId ...int64) ClientKillNotIdNotClientId {
	for _, n := range notClientId {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return (ClientKillNotIdNotClientId)(c)
}

type ClientKillNotIp Incomplete

func (c ClientKillNotIp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotLaddr Incomplete

func (c ClientKillNotLaddr) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotLaddr) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotLaddr) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotLaddr) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotLaddr) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotLaddr) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotLaddr) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotLaddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotLibName Incomplete

func (c ClientKillNotLibName) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotLibName) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotLibName) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotLibName) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotLibName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotLibVer Incomplete

func (c ClientKillNotLibVer) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotLibVer) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotLibVer) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotLibVer) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotName Incomplete

func (c ClientKillNotName) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotName) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotName) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotName) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotName) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotName) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotTypeMaster Incomplete

func (c ClientKillNotTypeMaster) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillNotTypeMaster) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotTypeMaster) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotTypeMaster) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotTypeMaster) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotTypeMaster) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotTypeMaster) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotTypeMaster) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotTypeMaster) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotTypeMaster) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotTypeMaster) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotTypeMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotTypeNormal Incomplete

func (c ClientKillNotTypeNormal) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillNotTypeNormal) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotTypeNormal) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotTypeNormal) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotTypeNormal) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotTypeNormal) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotTypeNormal) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotTypeNormal) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotTypeNormal) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotTypeNormal) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotTypeNormal) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotTypeNormal) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotTypePrimary Incomplete

func (c ClientKillNotTypePrimary) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillNotTypePrimary) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotTypePrimary) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotTypePrimary) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotTypePrimary) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotTypePrimary) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotTypePrimary) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotTypePrimary) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotTypePrimary) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotTypePrimary) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotTypePrimary) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotTypePrimary) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotTypePubsub Incomplete

func (c ClientKillNotTypePubsub) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillNotTypePubsub) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotTypePubsub) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotTypePubsub) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotTypePubsub) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotTypePubsub) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotTypePubsub) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotTypePubsub) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotTypePubsub) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotTypePubsub) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotTypePubsub) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotTypePubsub) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotTypeReplica Incomplete

func (c ClientKillNotTypeReplica) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillNotTypeReplica) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotTypeReplica) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotTypeReplica) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotTypeReplica) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotTypeReplica) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotTypeReplica) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotTypeReplica) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotTypeReplica) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotTypeReplica) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotTypeReplica) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotTypeReplica) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotTypeSlave Incomplete

func (c ClientKillNotTypeSlave) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillNotTypeSlave) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillNotTypeSlave) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotTypeSlave) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotTypeSlave) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotTypeSlave) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotTypeSlave) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotTypeSlave) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotTypeSlave) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotTypeSlave) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotTypeSlave) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotTypeSlave) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillNotUser Incomplete

func (c ClientKillNotUser) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillNotUser) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillNotUser) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillNotUser) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillNotUser) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillNotUser) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillNotUser) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillNotUser) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillNotUser) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillNotUser) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillSkipmeNo Incomplete

func (c ClientKillSkipmeNo) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillSkipmeNo) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillSkipmeNo) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillSkipmeNo) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillSkipmeNo) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillSkipmeNo) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillSkipmeNo) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillSkipmeNo) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillSkipmeNo) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillSkipmeNo) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillSkipmeNo) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillSkipmeNo) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillSkipmeNo) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillSkipmeNo) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillSkipmeNo) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillSkipmeNo) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillSkipmeNo) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillSkipmeNo) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillSkipmeNo) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillSkipmeNo) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillSkipmeNo) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillSkipmeNo) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillSkipmeNo) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillSkipmeNo) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillSkipmeNo) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillSkipmeNo) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillSkipmeNo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillSkipmeYes Incomplete

func (c ClientKillSkipmeYes) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillSkipmeYes) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillSkipmeYes) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillSkipmeYes) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillSkipmeYes) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillSkipmeYes) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillSkipmeYes) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillSkipmeYes) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillSkipmeYes) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillSkipmeYes) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillSkipmeYes) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillSkipmeYes) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillSkipmeYes) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillSkipmeYes) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillSkipmeYes) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillSkipmeYes) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillSkipmeYes) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillSkipmeYes) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillSkipmeYes) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillSkipmeYes) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillSkipmeYes) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillSkipmeYes) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillSkipmeYes) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillSkipmeYes) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillSkipmeYes) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillSkipmeYes) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillSkipmeYes) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillTypeMaster Incomplete

func (c ClientKillTypeMaster) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillTypeMaster) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillTypeMaster) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillTypeMaster) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillTypeMaster) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillTypeMaster) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypeMaster) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillTypeMaster) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillTypeMaster) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillTypeMaster) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillTypeMaster) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillTypeMaster) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillTypeMaster) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillTypeMaster) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillTypeMaster) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillTypeMaster) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillTypeMaster) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillTypeMaster) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillTypeMaster) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillTypeMaster) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillTypeMaster) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillTypeMaster) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillTypeMaster) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillTypeMaster) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillTypeMaster) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillTypeMaster) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillTypeMaster) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillTypeMaster) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillTypeMaster) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillTypeMaster) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillTypeMaster) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillTypeMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillTypeNormal Incomplete

func (c ClientKillTypeNormal) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillTypeNormal) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillTypeNormal) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillTypeNormal) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillTypeNormal) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillTypeNormal) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypeNormal) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillTypeNormal) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillTypeNormal) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillTypeNormal) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillTypeNormal) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillTypeNormal) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillTypeNormal) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillTypeNormal) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillTypeNormal) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillTypeNormal) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillTypeNormal) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillTypeNormal) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillTypeNormal) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillTypeNormal) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillTypeNormal) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillTypeNormal) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillTypeNormal) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillTypeNormal) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillTypeNormal) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillTypeNormal) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillTypeNormal) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillTypeNormal) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillTypeNormal) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillTypeNormal) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillTypeNormal) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillTypeNormal) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillTypePrimary Incomplete

func (c ClientKillTypePrimary) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillTypePrimary) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillTypePrimary) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillTypePrimary) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillTypePrimary) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillTypePrimary) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypePrimary) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillTypePrimary) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillTypePrimary) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillTypePrimary) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillTypePrimary) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillTypePrimary) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillTypePrimary) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillTypePrimary) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillTypePrimary) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillTypePrimary) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillTypePrimary) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillTypePrimary) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillTypePrimary) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillTypePrimary) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillTypePrimary) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillTypePrimary) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillTypePrimary) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillTypePrimary) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillTypePrimary) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillTypePrimary) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillTypePrimary) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillTypePrimary) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillTypePrimary) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillTypePrimary) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillTypePrimary) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillTypePrimary) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillTypePubsub Incomplete

func (c ClientKillTypePubsub) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillTypePubsub) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillTypePubsub) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillTypePubsub) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillTypePubsub) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillTypePubsub) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypePubsub) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillTypePubsub) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillTypePubsub) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillTypePubsub) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillTypePubsub) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillTypePubsub) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillTypePubsub) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillTypePubsub) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillTypePubsub) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillTypePubsub) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillTypePubsub) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillTypePubsub) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillTypePubsub) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillTypePubsub) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillTypePubsub) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillTypePubsub) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillTypePubsub) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillTypePubsub) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillTypePubsub) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillTypePubsub) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillTypePubsub) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillTypePubsub) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillTypePubsub) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillTypePubsub) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillTypePubsub) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillTypePubsub) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillTypeReplica Incomplete

func (c ClientKillTypeReplica) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillTypeReplica) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillTypeReplica) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillTypeReplica) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillTypeReplica) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillTypeReplica) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypeReplica) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillTypeReplica) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillTypeReplica) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillTypeReplica) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillTypeReplica) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillTypeReplica) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillTypeReplica) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillTypeReplica) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillTypeReplica) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillTypeReplica) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillTypeReplica) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillTypeReplica) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillTypeReplica) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillTypeReplica) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillTypeReplica) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillTypeReplica) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillTypeReplica) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillTypeReplica) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillTypeReplica) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillTypeReplica) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillTypeReplica) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillTypeReplica) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillTypeReplica) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillTypeReplica) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillTypeReplica) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillTypeReplica) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillTypeSlave Incomplete

func (c ClientKillTypeSlave) User(username string) ClientKillUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientKillUser)(c)
}

func (c ClientKillTypeSlave) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillTypeSlave) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillTypeSlave) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillTypeSlave) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillTypeSlave) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypeSlave) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillTypeSlave) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillTypeSlave) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillTypeSlave) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillTypeSlave) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillTypeSlave) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillTypeSlave) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillTypeSlave) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillTypeSlave) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillTypeSlave) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillTypeSlave) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillTypeSlave) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillTypeSlave) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillTypeSlave) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillTypeSlave) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillTypeSlave) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillTypeSlave) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillTypeSlave) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillTypeSlave) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillTypeSlave) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillTypeSlave) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillTypeSlave) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillTypeSlave) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillTypeSlave) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillTypeSlave) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillTypeSlave) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillUser Incomplete

func (c ClientKillUser) Addr(ipPort string) ClientKillAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientKillAddr)(c)
}

func (c ClientKillUser) Laddr(ipPort string) ClientKillLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientKillLaddr)(c)
}

func (c ClientKillUser) SkipmeYes() ClientKillSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientKillSkipmeYes)(c)
}

func (c ClientKillUser) SkipmeNo() ClientKillSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientKillSkipmeNo)(c)
}

func (c ClientKillUser) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillUser) Name(name string) ClientKillName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientKillName)(c)
}

func (c ClientKillUser) Idle(idle int64) ClientKillIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientKillIdle)(c)
}

func (c ClientKillUser) Flags(flags string) ClientKillFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientKillFlags)(c)
}

func (c ClientKillUser) LibName(libName string) ClientKillLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientKillLibName)(c)
}

func (c ClientKillUser) LibVer(libVer string) ClientKillLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientKillLibVer)(c)
}

func (c ClientKillUser) Db(db int64) ClientKillDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientKillDb)(c)
}

func (c ClientKillUser) Capa(capa string) ClientKillCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientKillCapa)(c)
}

func (c ClientKillUser) Ip(ip string) ClientKillIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientKillIp)(c)
}

func (c ClientKillUser) NotTypeNormal() ClientKillNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientKillNotTypeNormal)(c)
}

func (c ClientKillUser) NotTypeMaster() ClientKillNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientKillNotTypeMaster)(c)
}

func (c ClientKillUser) NotTypePrimary() ClientKillNotTypePrimary {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PRIMARY")
	return (ClientKillNotTypePrimary)(c)
}

func (c ClientKillUser) NotTypeSlave() ClientKillNotTypeSlave {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "SLAVE")
	return (ClientKillNotTypeSlave)(c)
}

func (c ClientKillUser) NotTypeReplica() ClientKillNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientKillNotTypeReplica)(c)
}

func (c ClientKillUser) NotTypePubsub() ClientKillNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientKillNotTypePubsub)(c)
}

func (c ClientKillUser) NotId() ClientKillNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientKillNotIdNotId)(c)
}

func (c ClientKillUser) NotUser(notUsername string) ClientKillNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientKillNotUser)(c)
}

func (c ClientKillUser) NotAddr(notAddr string) ClientKillNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientKillNotAddr)(c)
}

func (c ClientKillUser) NotLaddr(notLaddr string) ClientKillNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientKillNotLaddr)(c)
}

func (c ClientKillUser) NotName(notName string) ClientKillNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientKillNotName)(c)
}

func (c ClientKillUser) NotFlags(notFlags string) ClientKillNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientKillNotFlags)(c)
}

func (c ClientKillUser) NotLibName(notLibName string) ClientKillNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientKillNotLibName)(c)
}

func (c ClientKillUser) NotLibVer(notLibVer string) ClientKillNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientKillNotLibVer)(c)
}

func (c ClientKillUser) NotDb(notDb int64) ClientKillNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientKillNotDb)(c)
}

func (c ClientKillUser) NotCapa(notCapa string) ClientKillNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientKillNotCapa)(c)
}

func (c ClientKillUser) NotIp(notIp string) ClientKillNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientKillNotIp)(c)
}

func (c ClientKillUser) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientList Incomplete

func (b Builder) ClientList() (c ClientList) {
	c = ClientList{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "LIST")
	return c
}

func (c ClientList) TypeNormal() ClientListTypeNormal {
	c.cs.s = append(c.cs.s, "TYPE", "NORMAL")
	return (ClientListTypeNormal)(c)
}

func (c ClientList) TypeMaster() ClientListTypeMaster {
	c.cs.s = append(c.cs.s, "TYPE", "MASTER")
	return (ClientListTypeMaster)(c)
}

func (c ClientList) TypeReplica() ClientListTypeReplica {
	c.cs.s = append(c.cs.s, "TYPE", "REPLICA")
	return (ClientListTypeReplica)(c)
}

func (c ClientList) TypePubsub() ClientListTypePubsub {
	c.cs.s = append(c.cs.s, "TYPE", "PUBSUB")
	return (ClientListTypePubsub)(c)
}

func (c ClientList) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
}

func (c ClientList) User(username string) ClientListUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientListUser)(c)
}

func (c ClientList) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientList) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientList) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientList) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientList) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientList) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientList) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientList) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientList) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientList) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientList) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientList) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientList) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientList) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientList) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientList) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientList) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientList) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientList) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientList) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientList) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientList) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientList) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientList) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientList) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientList) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientList) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientList) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientList) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListAddr Incomplete

func (c ClientListAddr) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListAddr) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListAddr) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListAddr) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListAddr) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListAddr) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListAddr) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListAddr) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListAddr) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListAddr) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListAddr) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListAddr) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListAddr) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListAddr) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListAddr) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListAddr) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListAddr) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListAddr) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListAddr) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListAddr) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListAddr) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListAddr) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListAddr) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListAddr) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListAddr) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListAddr) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListAddr) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListAddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListCapa Incomplete

func (c ClientListCapa) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListCapa) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListCapa) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListCapa) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListCapa) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListCapa) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListCapa) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListCapa) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListCapa) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListCapa) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListCapa) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListCapa) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListCapa) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListCapa) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListCapa) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListCapa) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListCapa) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListDb Incomplete

func (c ClientListDb) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListDb) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListDb) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListDb) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListDb) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListDb) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListDb) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListDb) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListDb) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListDb) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListDb) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListDb) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListDb) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListDb) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListDb) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListDb) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListDb) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListDb) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListFlags Incomplete

func (c ClientListFlags) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListFlags) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListFlags) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListFlags) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListFlags) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListFlags) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListFlags) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListFlags) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListFlags) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListFlags) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListFlags) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListFlags) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListFlags) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListFlags) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListFlags) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListFlags) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListFlags) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListFlags) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListFlags) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListFlags) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListFlags) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListIdClientId Incomplete

func (c ClientListIdClientId) ClientId(clientId ...int64) ClientListIdClientId {
	for _, n := range clientId {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return c
}

func (c ClientListIdClientId) User(username string) ClientListUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientListUser)(c)
}

func (c ClientListIdClientId) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientListIdClientId) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListIdClientId) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListIdClientId) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListIdClientId) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListIdClientId) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListIdClientId) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListIdClientId) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListIdClientId) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListIdClientId) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListIdClientId) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListIdClientId) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListIdClientId) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListIdClientId) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListIdClientId) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListIdClientId) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListIdClientId) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListIdClientId) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListIdClientId) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListIdClientId) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListIdClientId) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListIdClientId) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListIdClientId) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListIdClientId) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListIdClientId) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListIdClientId) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListIdClientId) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListIdClientId) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListIdClientId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListIdId Incomplete

func (c ClientListIdId) ClientId(clientId ...int64) ClientListIdClientId {
	for _, n := range clientId {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return (ClientListIdClientId)(c)
}

type ClientListIdle Incomplete

func (c ClientListIdle) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListIdle) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListIdle) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListIdle) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListIdle) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListIdle) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListIdle) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListIdle) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListIdle) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListIdle) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListIdle) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListIdle) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListIdle) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListIdle) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListIdle) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListIdle) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListIdle) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListIdle) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListIdle) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListIdle) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListIdle) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListIdle) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListIp Incomplete

func (c ClientListIp) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListIp) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListIp) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListIp) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListIp) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListIp) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListIp) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListIp) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListIp) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListIp) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListIp) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListIp) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListIp) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListIp) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListIp) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListIp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListLaddr Incomplete

func (c ClientListLaddr) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListLaddr) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListLaddr) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListLaddr) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListLaddr) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListLaddr) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListLaddr) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListLaddr) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListLaddr) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListLaddr) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListLaddr) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListLaddr) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListLaddr) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListLaddr) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListLaddr) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListLaddr) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListLaddr) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListLaddr) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListLaddr) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListLaddr) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListLaddr) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListLaddr) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListLaddr) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListLaddr) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListLaddr) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListLaddr) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListLaddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListLibName Incomplete

func (c ClientListLibName) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListLibName) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListLibName) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListLibName) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListLibName) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListLibName) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListLibName) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListLibName) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListLibName) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListLibName) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListLibName) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListLibName) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListLibName) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListLibName) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListLibName) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListLibName) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListLibName) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListLibName) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListLibName) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListLibName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListLibVer Incomplete

func (c ClientListLibVer) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListLibVer) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListLibVer) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListLibVer) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListLibVer) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListLibVer) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListLibVer) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListLibVer) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListLibVer) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListLibVer) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListLibVer) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListLibVer) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListLibVer) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListLibVer) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListLibVer) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListLibVer) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListLibVer) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListLibVer) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListLibVer) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListMaxage Incomplete

func (c ClientListMaxage) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListMaxage) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListMaxage) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListMaxage) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListMaxage) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListMaxage) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListMaxage) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListMaxage) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListMaxage) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListMaxage) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListMaxage) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListMaxage) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListMaxage) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListMaxage) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListMaxage) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListMaxage) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListMaxage) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListMaxage) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListMaxage) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListMaxage) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListMaxage) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListMaxage) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListMaxage) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListMaxage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListName Incomplete

func (c ClientListName) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListName) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListName) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListName) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListName) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListName) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListName) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListName) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListName) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListName) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListName) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListName) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListName) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListName) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListName) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListName) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListName) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListName) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListName) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListName) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListName) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListName) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotAddr Incomplete

func (c ClientListNotAddr) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotAddr) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotAddr) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotAddr) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotAddr) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotAddr) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotAddr) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotAddr) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotAddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotCapa Incomplete

func (c ClientListNotCapa) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotCapa) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotDb Incomplete

func (c ClientListNotDb) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotDb) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotDb) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotFlags Incomplete

func (c ClientListNotFlags) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotFlags) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotFlags) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotFlags) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotFlags) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotFlags) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotIdNotClientId Incomplete

func (c ClientListNotIdNotClientId) NotClientId(notClientId ...int64) ClientListNotIdNotClientId {
	for _, n := range notClientId {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return c
}

func (c ClientListNotIdNotClientId) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListNotIdNotClientId) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListNotIdNotClientId) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotIdNotClientId) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotIdNotClientId) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotIdNotClientId) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotIdNotClientId) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotIdNotClientId) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotIdNotClientId) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotIdNotClientId) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotIdNotClientId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotIdNotId Incomplete

func (c ClientListNotIdNotId) NotClientId(notClientId ...int64) ClientListNotIdNotClientId {
	for _, n := range notClientId {
		c.cs.s = append(c.cs.s, strconv.FormatInt(n, 10))
	}
	return (ClientListNotIdNotClientId)(c)
}

type ClientListNotIp Incomplete

func (c ClientListNotIp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotLaddr Incomplete

func (c ClientListNotLaddr) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotLaddr) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotLaddr) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotLaddr) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotLaddr) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotLaddr) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotLaddr) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotLaddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotLibName Incomplete

func (c ClientListNotLibName) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotLibName) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotLibName) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotLibName) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotLibName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotLibVer Incomplete

func (c ClientListNotLibVer) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotLibVer) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotLibVer) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotLibVer) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotName Incomplete

func (c ClientListNotName) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotName) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotName) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotName) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotName) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotName) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotTypeMaster Incomplete

func (c ClientListNotTypeMaster) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListNotTypeMaster) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListNotTypeMaster) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListNotTypeMaster) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotTypeMaster) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotTypeMaster) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotTypeMaster) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotTypeMaster) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotTypeMaster) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotTypeMaster) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotTypeMaster) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotTypeMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotTypeNormal Incomplete

func (c ClientListNotTypeNormal) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListNotTypeNormal) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListNotTypeNormal) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListNotTypeNormal) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotTypeNormal) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotTypeNormal) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotTypeNormal) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotTypeNormal) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotTypeNormal) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotTypeNormal) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotTypeNormal) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotTypeNormal) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotTypePubsub Incomplete

func (c ClientListNotTypePubsub) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListNotTypePubsub) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListNotTypePubsub) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListNotTypePubsub) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotTypePubsub) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotTypePubsub) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotTypePubsub) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotTypePubsub) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotTypePubsub) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotTypePubsub) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotTypePubsub) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotTypePubsub) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotTypeReplica Incomplete

func (c ClientListNotTypeReplica) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListNotTypeReplica) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListNotTypeReplica) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListNotTypeReplica) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotTypeReplica) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotTypeReplica) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotTypeReplica) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotTypeReplica) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotTypeReplica) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotTypeReplica) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotTypeReplica) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotTypeReplica) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListNotUser Incomplete

func (c ClientListNotUser) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListNotUser) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListNotUser) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListNotUser) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListNotUser) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListNotUser) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListNotUser) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListNotUser) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListNotUser) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListNotUser) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListSkipmeNo Incomplete

func (c ClientListSkipmeNo) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListSkipmeNo) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListSkipmeNo) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListSkipmeNo) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListSkipmeNo) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListSkipmeNo) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListSkipmeNo) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListSkipmeNo) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListSkipmeNo) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListSkipmeNo) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListSkipmeNo) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListSkipmeNo) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListSkipmeNo) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListSkipmeNo) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListSkipmeNo) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListSkipmeNo) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListSkipmeNo) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListSkipmeNo) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListSkipmeNo) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListSkipmeNo) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListSkipmeNo) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListSkipmeNo) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListSkipmeNo) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListSkipmeNo) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListSkipmeNo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListSkipmeYes Incomplete

func (c ClientListSkipmeYes) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListSkipmeYes) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListSkipmeYes) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListSkipmeYes) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListSkipmeYes) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListSkipmeYes) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListSkipmeYes) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListSkipmeYes) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListSkipmeYes) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListSkipmeYes) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListSkipmeYes) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListSkipmeYes) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListSkipmeYes) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListSkipmeYes) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListSkipmeYes) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListSkipmeYes) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListSkipmeYes) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListSkipmeYes) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListSkipmeYes) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListSkipmeYes) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListSkipmeYes) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListSkipmeYes) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListSkipmeYes) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListSkipmeYes) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListSkipmeYes) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListTypeMaster Incomplete

func (c ClientListTypeMaster) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
}

func (c ClientListTypeMaster) User(username string) ClientListUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientListUser)(c)
}

func (c ClientListTypeMaster) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientListTypeMaster) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListTypeMaster) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListTypeMaster) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListTypeMaster) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListTypeMaster) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListTypeMaster) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListTypeMaster) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListTypeMaster) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListTypeMaster) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListTypeMaster) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListTypeMaster) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListTypeMaster) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListTypeMaster) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListTypeMaster) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListTypeMaster) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListTypeMaster) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListTypeMaster) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListTypeMaster) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListTypeMaster) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListTypeMaster) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListTypeMaster) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListTypeMaster) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListTypeMaster) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListTypeMaster) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListTypeMaster) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListTypeMaster) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListTypeMaster) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListTypeMaster) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListTypeNormal Incomplete

func (c ClientListTypeNormal) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
}

func (c ClientListTypeNormal) User(username string) ClientListUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientListUser)(c)
}

func (c ClientListTypeNormal) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientListTypeNormal) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListTypeNormal) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListTypeNormal) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListTypeNormal) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListTypeNormal) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListTypeNormal) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListTypeNormal) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListTypeNormal) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListTypeNormal) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListTypeNormal) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListTypeNormal) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListTypeNormal) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListTypeNormal) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListTypeNormal) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListTypeNormal) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListTypeNormal) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListTypeNormal) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListTypeNormal) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListTypeNormal) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListTypeNormal) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListTypeNormal) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListTypeNormal) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListTypeNormal) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListTypeNormal) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListTypeNormal) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListTypeNormal) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListTypeNormal) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListTypeNormal) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListTypePubsub Incomplete

func (c ClientListTypePubsub) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
}

func (c ClientListTypePubsub) User(username string) ClientListUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientListUser)(c)
}

func (c ClientListTypePubsub) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientListTypePubsub) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListTypePubsub) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListTypePubsub) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListTypePubsub) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListTypePubsub) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListTypePubsub) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListTypePubsub) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListTypePubsub) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListTypePubsub) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListTypePubsub) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListTypePubsub) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListTypePubsub) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListTypePubsub) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListTypePubsub) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListTypePubsub) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListTypePubsub) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListTypePubsub) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListTypePubsub) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListTypePubsub) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListTypePubsub) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListTypePubsub) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListTypePubsub) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListTypePubsub) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListTypePubsub) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListTypePubsub) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListTypePubsub) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListTypePubsub) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListTypePubsub) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListTypeReplica Incomplete

func (c ClientListTypeReplica) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
}

func (c ClientListTypeReplica) User(username string) ClientListUser {
	c.cs.s = append(c.cs.s, "USER", username)
	return (ClientListUser)(c)
}

func (c ClientListTypeReplica) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientListTypeReplica) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListTypeReplica) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListTypeReplica) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListTypeReplica) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListTypeReplica) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListTypeReplica) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListTypeReplica) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListTypeReplica) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListTypeReplica) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListTypeReplica) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListTypeReplica) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListTypeReplica) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListTypeReplica) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListTypeReplica) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListTypeReplica) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListTypeReplica) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListTypeReplica) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListTypeReplica) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListTypeReplica) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListTypeReplica) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListTypeReplica) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListTypeReplica) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListTypeReplica) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListTypeReplica) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListTypeReplica) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListTypeReplica) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListTypeReplica) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListTypeReplica) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListUser Incomplete

func (c ClientListUser) Addr(ipPort string) ClientListAddr {
	c.cs.s = append(c.cs.s, "ADDR", ipPort)
	return (ClientListAddr)(c)
}

func (c ClientListUser) Laddr(ipPort string) ClientListLaddr {
	c.cs.s = append(c.cs.s, "LADDR", ipPort)
	return (ClientListLaddr)(c)
}

func (c ClientListUser) SkipmeYes() ClientListSkipmeYes {
	c.cs.s = append(c.cs.s, "SKIPME", "YES")
	return (ClientListSkipmeYes)(c)
}

func (c ClientListUser) SkipmeNo() ClientListSkipmeNo {
	c.cs.s = append(c.cs.s, "SKIPME", "NO")
	return (ClientListSkipmeNo)(c)
}

func (c ClientListUser) Maxage(maxage int64) ClientListMaxage {
	c.cs.s = append(c.cs.s, "MAXAGE", strconv.FormatInt(maxage, 10))
	return (ClientListMaxage)(c)
}

func (c ClientListUser) Name(name string) ClientListName {
	c.cs.s = append(c.cs.s, "NAME", name)
	return (ClientListName)(c)
}

func (c ClientListUser) Idle(idle int64) ClientListIdle {
	c.cs.s = append(c.cs.s, "IDLE", strconv.FormatInt(idle, 10))
	return (ClientListIdle)(c)
}

func (c ClientListUser) Flags(flags string) ClientListFlags {
	c.cs.s = append(c.cs.s, "FLAGS", flags)
	return (ClientListFlags)(c)
}

func (c ClientListUser) LibName(libName string) ClientListLibName {
	c.cs.s = append(c.cs.s, "LIB-NAME", libName)
	return (ClientListLibName)(c)
}

func (c ClientListUser) LibVer(libVer string) ClientListLibVer {
	c.cs.s = append(c.cs.s, "LIB-VER", libVer)
	return (ClientListLibVer)(c)
}

func (c ClientListUser) Db(db int64) ClientListDb {
	c.cs.s = append(c.cs.s, "DB", strconv.FormatInt(db, 10))
	return (ClientListDb)(c)
}

func (c ClientListUser) Capa(capa string) ClientListCapa {
	c.cs.s = append(c.cs.s, "CAPA", capa)
	return (ClientListCapa)(c)
}

func (c ClientListUser) Ip(ip string) ClientListIp {
	c.cs.s = append(c.cs.s, "IP", ip)
	return (ClientListIp)(c)
}

func (c ClientListUser) NotTypeNormal() ClientListNotTypeNormal {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "NORMAL")
	return (ClientListNotTypeNormal)(c)
}

func (c ClientListUser) NotTypeMaster() ClientListNotTypeMaster {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "MASTER")
	return (ClientListNotTypeMaster)(c)
}

func (c ClientListUser) NotTypeReplica() ClientListNotTypeReplica {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "REPLICA")
	return (ClientListNotTypeReplica)(c)
}

func (c ClientListUser) NotTypePubsub() ClientListNotTypePubsub {
	c.cs.s = append(c.cs.s, "NOT-TYPE", "PUBSUB")
	return (ClientListNotTypePubsub)(c)
}

func (c ClientListUser) NotId() ClientListNotIdNotId {
	c.cs.s = append(c.cs.s, "NOT-ID")
	return (ClientListNotIdNotId)(c)
}

func (c ClientListUser) NotUser(notUsername string) ClientListNotUser {
	c.cs.s = append(c.cs.s, "NOT-USER", notUsername)
	return (ClientListNotUser)(c)
}

func (c ClientListUser) NotAddr(notAddr string) ClientListNotAddr {
	c.cs.s = append(c.cs.s, "NOT-ADDR", notAddr)
	return (ClientListNotAddr)(c)
}

func (c ClientListUser) NotLaddr(notLaddr string) ClientListNotLaddr {
	c.cs.s = append(c.cs.s, "NOT-LADDR", notLaddr)
	return (ClientListNotLaddr)(c)
}

func (c ClientListUser) NotName(notName string) ClientListNotName {
	c.cs.s = append(c.cs.s, "NOT-NAME", notName)
	return (ClientListNotName)(c)
}

func (c ClientListUser) NotFlags(notFlags string) ClientListNotFlags {
	c.cs.s = append(c.cs.s, "NOT-FLAGS", notFlags)
	return (ClientListNotFlags)(c)
}

func (c ClientListUser) NotLibName(notLibName string) ClientListNotLibName {
	c.cs.s = append(c.cs.s, "NOT-LIB-NAME", notLibName)
	return (ClientListNotLibName)(c)
}

func (c ClientListUser) NotLibVer(notLibVer string) ClientListNotLibVer {
	c.cs.s = append(c.cs.s, "NOT-LIB-VER", notLibVer)
	return (ClientListNotLibVer)(c)
}

func (c ClientListUser) NotDb(notDb int64) ClientListNotDb {
	c.cs.s = append(c.cs.s, "NOT-DB", strconv.FormatInt(notDb, 10))
	return (ClientListNotDb)(c)
}

func (c ClientListUser) NotCapa(notCapa string) ClientListNotCapa {
	c.cs.s = append(c.cs.s, "NOT-CAPA", notCapa)
	return (ClientListNotCapa)(c)
}

func (c ClientListUser) NotIp(notIp string) ClientListNotIp {
	c.cs.s = append(c.cs.s, "NOT-IP", notIp)
	return (ClientListNotIp)(c)
}

func (c ClientListUser) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientNoEvict Incomplete

func (b Builder) ClientNoEvict() (c ClientNoEvict) {
	c = ClientNoEvict{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "NO-EVICT")
	return c
}

func (c ClientNoEvict) On() ClientNoEvictEnabledOn {
	c.cs.s = append(c.cs.s, "ON")
	return (ClientNoEvictEnabledOn)(c)
}

func (c ClientNoEvict) Off() ClientNoEvictEnabledOff {
	c.cs.s = append(c.cs.s, "OFF")
	return (ClientNoEvictEnabledOff)(c)
}

type ClientNoEvictEnabledOff Incomplete

func (c ClientNoEvictEnabledOff) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientNoEvictEnabledOn Incomplete

func (c ClientNoEvictEnabledOn) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientNoTouch Incomplete

func (b Builder) ClientNoTouch() (c ClientNoTouch) {
	c = ClientNoTouch{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "NO-TOUCH")
	return c
}

func (c ClientNoTouch) On() ClientNoTouchEnabledOn {
	c.cs.s = append(c.cs.s, "ON")
	return (ClientNoTouchEnabledOn)(c)
}

func (c ClientNoTouch) Off() ClientNoTouchEnabledOff {
	c.cs.s = append(c.cs.s, "OFF")
	return (ClientNoTouchEnabledOff)(c)
}

type ClientNoTouchEnabledOff Incomplete

func (c ClientNoTouchEnabledOff) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientNoTouchEnabledOn Incomplete

func (c ClientNoTouchEnabledOn) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientPause Incomplete

func (b Builder) ClientPause() (c ClientPause) {
	c = ClientPause{cs: get(), ks: b.ks, cf: int16(blockTag)}
	c.cs.s = append(c.cs.s, "CLIENT", "PAUSE")
	return c
}

func (c ClientPause) Timeout(timeout int64) ClientPauseTimeout {
	c.cs.s = append(c.cs.s, strconv.FormatInt(timeout, 10))
	return (ClientPauseTimeout)(c)
}

type ClientPauseModeAll Incomplete

func (c ClientPauseModeAll) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientPauseModeWrite Incomplete

func (c ClientPauseModeWrite) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientPauseTimeout Incomplete

func (c ClientPauseTimeout) Write() ClientPauseModeWrite {
	c.cs.s = append(c.cs.s, "WRITE")
	return (ClientPauseModeWrite)(c)
}

func (c ClientPauseTimeout) All() ClientPauseModeAll {
	c.cs.s = append(c.cs.s, "ALL")
	return (ClientPauseModeAll)(c)
}

func (c ClientPauseTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientReply Incomplete

func (b Builder) ClientReply() (c ClientReply) {
	c = ClientReply{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "REPLY")
	return c
}

func (c ClientReply) On() ClientReplyReplyModeOn {
	c.cs.s = append(c.cs.s, "ON")
	return (ClientReplyReplyModeOn)(c)
}

func (c ClientReply) Off() ClientReplyReplyModeOff {
	c.cs.s = append(c.cs.s, "OFF")
	return (ClientReplyReplyModeOff)(c)
}

func (c ClientReply) Skip() ClientReplyReplyModeSkip {
	c.cs.s = append(c.cs.s, "SKIP")
	return (ClientReplyReplyModeSkip)(c)
}

type ClientReplyReplyModeOff Incomplete

func (c ClientReplyReplyModeOff) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientReplyReplyModeOn Incomplete

func (c ClientReplyReplyModeOn) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientReplyReplyModeSkip Incomplete

func (c ClientReplyReplyModeSkip) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientSetinfo Incomplete

func (b Builder) ClientSetinfo() (c ClientSetinfo) {
	c = ClientSetinfo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "SETINFO")
	return c
}

func (c ClientSetinfo) Libname(libname string) ClientSetinfoAttrLibname {
	c.cs.s = append(c.cs.s, "LIB-NAME", libname)
	return (ClientSetinfoAttrLibname)(c)
}

func (c ClientSetinfo) Libver(libver string) ClientSetinfoAttrLibver {
	c.cs.s = append(c.cs.s, "LIB-VER", libver)
	return (ClientSetinfoAttrLibver)(c)
}

type ClientSetinfoAttrLibname Incomplete

func (c ClientSetinfoAttrLibname) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientSetinfoAttrLibver Incomplete

func (c ClientSetinfoAttrLibver) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientSetname Incomplete

func (b Builder) ClientSetname() (c ClientSetname) {
	c = ClientSetname{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "SETNAME")
	return c
}

func (c ClientSetname) ConnectionName(connectionName string) ClientSetnameConnectionName {
	c.cs.s = append(c.cs.s, connectionName)
	return (ClientSetnameConnectionName)(c)
}

type ClientSetnameConnectionName Incomplete

func (c ClientSetnameConnectionName) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTracking Incomplete

func (b Builder) ClientTracking() (c ClientTracking) {
	c = ClientTracking{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "TRACKING")
	return c
}

func (c ClientTracking) On() ClientTrackingStatusOn {
	c.cs.s = append(c.cs.s, "ON")
	return (ClientTrackingStatusOn)(c)
}

func (c ClientTracking) Off() ClientTrackingStatusOff {
	c.cs.s = append(c.cs.s, "OFF")
	return (ClientTrackingStatusOff)(c)
}

type ClientTrackingBcast Incomplete

func (c ClientTrackingBcast) Optin() ClientTrackingOptin {
	c.cs.s = append(c.cs.s, "OPTIN")
	return (ClientTrackingOptin)(c)
}

func (c ClientTrackingBcast) Optout() ClientTrackingOptout {
	c.cs.s = append(c.cs.s, "OPTOUT")
	return (ClientTrackingOptout)(c)
}

func (c ClientTrackingBcast) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingBcast) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingNoloop Incomplete

func (c ClientTrackingNoloop) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingOptin Incomplete

func (c ClientTrackingOptin) Optout() ClientTrackingOptout {
	c.cs.s = append(c.cs.s, "OPTOUT")
	return (ClientTrackingOptout)(c)
}

func (c ClientTrackingOptin) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingOptin) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingOptout Incomplete

func (c ClientTrackingOptout) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingOptout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingPrefix Incomplete

func (c ClientTrackingPrefix) Prefix(prefix string) ClientTrackingPrefix {
	c.cs.s = append(c.cs.s, "PREFIX", prefix)
	return c
}

func (c ClientTrackingPrefix) Bcast() ClientTrackingBcast {
	c.cs.s = append(c.cs.s, "BCAST")
	return (ClientTrackingBcast)(c)
}

func (c ClientTrackingPrefix) Optin() ClientTrackingOptin {
	c.cs.s = append(c.cs.s, "OPTIN")
	return (ClientTrackingOptin)(c)
}

func (c ClientTrackingPrefix) Optout() ClientTrackingOptout {
	c.cs.s = append(c.cs.s, "OPTOUT")
	return (ClientTrackingOptout)(c)
}

func (c ClientTrackingPrefix) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingPrefix) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingRedirect Incomplete

func (c ClientTrackingRedirect) Prefix() ClientTrackingPrefix {
	return (ClientTrackingPrefix)(c)
}

func (c ClientTrackingRedirect) Bcast() ClientTrackingBcast {
	c.cs.s = append(c.cs.s, "BCAST")
	return (ClientTrackingBcast)(c)
}

func (c ClientTrackingRedirect) Optin() ClientTrackingOptin {
	c.cs.s = append(c.cs.s, "OPTIN")
	return (ClientTrackingOptin)(c)
}

func (c ClientTrackingRedirect) Optout() ClientTrackingOptout {
	c.cs.s = append(c.cs.s, "OPTOUT")
	return (ClientTrackingOptout)(c)
}

func (c ClientTrackingRedirect) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingRedirect) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingStatusOff Incomplete

func (c ClientTrackingStatusOff) Redirect(clientId int64) ClientTrackingRedirect {
	c.cs.s = append(c.cs.s, "REDIRECT", strconv.FormatInt(clientId, 10))
	return (ClientTrackingRedirect)(c)
}

func (c ClientTrackingStatusOff) Prefix() ClientTrackingPrefix {
	return (ClientTrackingPrefix)(c)
}

func (c ClientTrackingStatusOff) Bcast() ClientTrackingBcast {
	c.cs.s = append(c.cs.s, "BCAST")
	return (ClientTrackingBcast)(c)
}

func (c ClientTrackingStatusOff) Optin() ClientTrackingOptin {
	c.cs.s = append(c.cs.s, "OPTIN")
	return (ClientTrackingOptin)(c)
}

func (c ClientTrackingStatusOff) Optout() ClientTrackingOptout {
	c.cs.s = append(c.cs.s, "OPTOUT")
	return (ClientTrackingOptout)(c)
}

func (c ClientTrackingStatusOff) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingStatusOff) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackingStatusOn Incomplete

func (c ClientTrackingStatusOn) Redirect(clientId int64) ClientTrackingRedirect {
	c.cs.s = append(c.cs.s, "REDIRECT", strconv.FormatInt(clientId, 10))
	return (ClientTrackingRedirect)(c)
}

func (c ClientTrackingStatusOn) Prefix() ClientTrackingPrefix {
	return (ClientTrackingPrefix)(c)
}

func (c ClientTrackingStatusOn) Bcast() ClientTrackingBcast {
	c.cs.s = append(c.cs.s, "BCAST")
	return (ClientTrackingBcast)(c)
}

func (c ClientTrackingStatusOn) Optin() ClientTrackingOptin {
	c.cs.s = append(c.cs.s, "OPTIN")
	return (ClientTrackingOptin)(c)
}

func (c ClientTrackingStatusOn) Optout() ClientTrackingOptout {
	c.cs.s = append(c.cs.s, "OPTOUT")
	return (ClientTrackingOptout)(c)
}

func (c ClientTrackingStatusOn) Noloop() ClientTrackingNoloop {
	c.cs.s = append(c.cs.s, "NOLOOP")
	return (ClientTrackingNoloop)(c)
}

func (c ClientTrackingStatusOn) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientTrackinginfo Incomplete

func (b Builder) ClientTrackinginfo() (c ClientTrackinginfo) {
	c = ClientTrackinginfo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "TRACKINGINFO")
	return c
}

func (c ClientTrackinginfo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientUnblock Incomplete

func (b Builder) ClientUnblock() (c ClientUnblock) {
	c = ClientUnblock{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "UNBLOCK")
	return c
}

func (c ClientUnblock) ClientId(clientId int64) ClientUnblockClientId {
	c.cs.s = append(c.cs.s, strconv.FormatInt(clientId, 10))
	return (ClientUnblockClientId)(c)
}

type ClientUnblockClientId Incomplete

func (c ClientUnblockClientId) Timeout() ClientUnblockUnblockTypeTimeout {
	c.cs.s = append(c.cs.s, "TIMEOUT")
	return (ClientUnblockUnblockTypeTimeout)(c)
}

func (c ClientUnblockClientId) Error() ClientUnblockUnblockTypeError {
	c.cs.s = append(c.cs.s, "ERROR")
	return (ClientUnblockUnblockTypeError)(c)
}

func (c ClientUnblockClientId) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientUnblockUnblockTypeError Incomplete

func (c ClientUnblockUnblockTypeError) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientUnblockUnblockTypeTimeout Incomplete

func (c ClientUnblockUnblockTypeTimeout) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientUnpause Incomplete

func (b Builder) ClientUnpause() (c ClientUnpause) {
	c = ClientUnpause{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CLIENT", "UNPAUSE")
	return c
}

func (c ClientUnpause) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Echo Incomplete

func (b Builder) Echo() (c Echo) {
	c = Echo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "ECHO")
	return c
}

func (c Echo) Message(message string) EchoMessage {
	c.cs.s = append(c.cs.s, message)
	return (EchoMessage)(c)
}

type EchoMessage Incomplete

func (c EchoMessage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Hello Incomplete

func (b Builder) Hello() (c Hello) {
	c = Hello{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "HELLO")
	return c
}

func (c Hello) Protover(protover int64) HelloArgumentsProtover {
	c.cs.s = append(c.cs.s, strconv.FormatInt(protover, 10))
	return (HelloArgumentsProtover)(c)
}

func (c Hello) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HelloArgumentsAuth Incomplete

func (c HelloArgumentsAuth) Setname(clientname string) HelloArgumentsSetname {
	c.cs.s = append(c.cs.s, "SETNAME", clientname)
	return (HelloArgumentsSetname)(c)
}

func (c HelloArgumentsAuth) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HelloArgumentsProtover Incomplete

func (c HelloArgumentsProtover) Auth(username string, password string) HelloArgumentsAuth {
	c.cs.s = append(c.cs.s, "AUTH", username, password)
	return (HelloArgumentsAuth)(c)
}

func (c HelloArgumentsProtover) Setname(clientname string) HelloArgumentsSetname {
	c.cs.s = append(c.cs.s, "SETNAME", clientname)
	return (HelloArgumentsSetname)(c)
}

func (c HelloArgumentsProtover) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type HelloArgumentsSetname Incomplete

func (c HelloArgumentsSetname) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Ping Incomplete

func (b Builder) Ping() (c Ping) {
	c = Ping{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PING")
	return c
}

func (c Ping) Message(message string) PingMessage {
	c.cs.s = append(c.cs.s, message)
	return (PingMessage)(c)
}

func (c Ping) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PingMessage Incomplete

func (c PingMessage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Quit Incomplete

func (b Builder) Quit() (c Quit) {
	c = Quit{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "QUIT")
	return c
}

func (c Quit) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Reset Incomplete

func (b Builder) Reset() (c Reset) {
	c = Reset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "RESET")
	return c
}

func (c Reset) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Select Incomplete

func (b Builder) Select() (c Select) {
	c = Select{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SELECT")
	return c
}

func (c Select) Index(index int64) SelectIndex {
	c.cs.s = append(c.cs.s, strconv.FormatInt(index, 10))
	return (SelectIndex)(c)
}

type SelectIndex Incomplete

func (c SelectIndex) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
