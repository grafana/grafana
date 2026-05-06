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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillAddr) Build() Completed {
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillId) Build() Completed {
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillLaddr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillMaxage Incomplete

func (c ClientKillMaxage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillSkipmeNo Incomplete

func (c ClientKillSkipmeNo) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillSkipmeNo) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientKillSkipmeYes Incomplete

func (c ClientKillSkipmeYes) Maxage(maxage int64) ClientKillMaxage {
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypeNormal) Build() Completed {
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
}

func (c ClientKillTypeReplica) Build() Completed {
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
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxage, 10))
	return (ClientKillMaxage)(c)
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

func (c ClientList) Build() Completed {
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

type ClientListTypeMaster Incomplete

func (c ClientListTypeMaster) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
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

func (c ClientListTypeNormal) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClientListTypePubsub Incomplete

func (c ClientListTypePubsub) Id() ClientListIdId {
	c.cs.s = append(c.cs.s, "ID")
	return (ClientListIdId)(c)
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

func (c ClientListTypeReplica) Build() Completed {
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
	c.cs.s = append(c.cs.s, libname)
	return (ClientSetinfoAttrLibname)(c)
}

func (c ClientSetinfo) Libver(libver string) ClientSetinfoAttrLibver {
	c.cs.s = append(c.cs.s, libver)
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
