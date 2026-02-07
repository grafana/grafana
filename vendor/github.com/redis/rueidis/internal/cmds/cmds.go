package cmds

import "strings"

const (
	optInTag = uint16(1 << 15)
	blockTag = uint16(1 << 14)
	readonly = uint16(1 << 13)
	noRetTag = uint16(1<<12) | readonly | pipeTag // make noRetTag can also be retried and auto pipelining
	mtGetTag = uint16(1<<11) | readonly           // make mtGetTag can also be retried
	scrRoTag = uint16(1<<10) | readonly           // make scrRoTag can also be retried
	unsubTag = uint16(1<<9) | noRetTag
	pipeTag  = uint16(1 << 8) // make blocking mode request can use auto pipelining
	// InitSlot indicates that the command be sent to any redis node in cluster
	InitSlot = uint16(1 << 14)
	// NoSlot indicates that the command has no key slot specified
	NoSlot = uint16(1 << 15)
)

var (
	// OptInCmd is predefined CLIENT CACHING YES
	OptInCmd = Completed{
		cs: newCommandSlice([]string{"CLIENT", "CACHING", "YES"}),
		cf: optInTag,
	}
	// OptInNopCmd is a predefined alternative for CLIENT CACHING YES in BCAST/OPTOUT mode.
	OptInNopCmd = Completed{
		cs: newCommandSlice([]string{"ECHO", ""}),
		cf: optInTag,
	}
	// MultiCmd is predefined MULTI
	MultiCmd = Completed{
		cs: newCommandSlice([]string{"MULTI"}),
	}
	// ExecCmd is predefined EXEC
	ExecCmd = Completed{
		cs: newCommandSlice([]string{"EXEC"}),
	}
	// RoleCmd is predefined ROLE
	RoleCmd = Completed{
		cs: newCommandSlice([]string{"ROLE"}),
		cf: pipeTag,
	}

	// UnsubscribeCmd is predefined UNSUBSCRIBE
	UnsubscribeCmd = Completed{
		cs: newCommandSlice([]string{"UNSUBSCRIBE"}),
		cf: unsubTag,
	}
	// PUnsubscribeCmd is predefined PUNSUBSCRIBE
	PUnsubscribeCmd = Completed{
		cs: newCommandSlice([]string{"PUNSUBSCRIBE"}),
		cf: unsubTag,
	}
	// SUnsubscribeCmd is predefined SUNSUBSCRIBE
	SUnsubscribeCmd = Completed{
		cs: newCommandSlice([]string{"SUNSUBSCRIBE"}),
		cf: unsubTag,
	}
	// PingCmd is predefined PING
	PingCmd = Completed{
		cs: newCommandSlice([]string{"PING"}),
	}
	// SlotCmd is predefined CLUSTER SLOTS
	SlotCmd = Completed{
		cs: newCommandSlice([]string{"CLUSTER", "SLOTS"}),
		cf: pipeTag,
	}
	// ShardsCmd is predefined CLUSTER SHARDS
	ShardsCmd = Completed{
		cs: newCommandSlice([]string{"CLUSTER", "SHARDS"}),
		cf: pipeTag,
	}
	// AskingCmd is predefined CLUSTER ASKING
	AskingCmd = Completed{
		cs: newCommandSlice([]string{"ASKING"}),
	}
	// SentinelSubscribe is predefined SUBSCRIBE ASKING
	SentinelSubscribe = Completed{
		cs: newCommandSlice([]string{"SUBSCRIBE", "+sentinel", "+slave", "-sdown", "+sdown", "+switch-master", "+reboot"}),
		cf: noRetTag,
	}
	// SentinelUnSubscribe is predefined UNSUBSCRIBE ASKING
	SentinelUnSubscribe = Completed{
		cs: newCommandSlice([]string{"UNSUBSCRIBE", "+sentinel", "+slave", "-sdown", "+sdown", "+switch-master", "+reboot"}),
		cf: unsubTag,
	}

	// DiscardCmd is predefined DISCARD
	DiscardCmd = Completed{
		cs: newCommandSlice([]string{"DISCARD"}),
	}
)

// ToBlock marks the command with blockTag
func ToBlock(c *Completed) {
	c.cf |= blockTag
}

// Incomplete represents an incomplete Redis command. It should then be completed by calling Build().
type Incomplete struct {
	cs *CommandSlice
	cf int16 // use int16 instead of uint16 to make a difference with Completed
	ks uint16
}

// Completed represents a completed Redis command, should be created by the Build() of command builder.
type Completed struct {
	cs *CommandSlice
	cf uint16 // cmd flag
	ks uint16 // key slot
}

// Pin prevents a Completed to be recycled
func (c Completed) Pin() Completed {
	c.cs.r = 1
	return c
}

// ToPipe returns a new command with pipeTag
func (c Completed) ToPipe() Completed {
	c.cf |= pipeTag
	return c
}

// IsEmpty checks if it is an empty command.
func (c *Completed) IsEmpty() bool {
	return c.cs == nil || len(c.cs.s) == 0
}

// IsOptIn checks if it is client side caching opt-int command.
func (c *Completed) IsOptIn() bool {
	return c.cf&optInTag == optInTag
}

// IsBlock checks if it is blocking command which needs to be process by dedicated connection.
func (c *Completed) IsBlock() bool {
	return c.cf&blockTag == blockTag
}

// NoReply checks if it is one of the SUBSCRIBE, PSUBSCRIBE, UNSUBSCRIBE or PUNSUBSCRIBE commands.
func (c *Completed) NoReply() bool {
	return c.cf&noRetTag == noRetTag
}

// IsUnsub checks if it is one of the UNSUBSCRIBE, PUNSUBSCRIBE, or SUNSUBSCRIBE commands.
func (c *Completed) IsUnsub() bool {
	return c.cf&unsubTag == unsubTag
}

// IsReadOnly checks if it is readonly command and can be retried when network error.
func (c *Completed) IsReadOnly() bool {
	return c.cf&readonly == readonly
}

// IsWrite checks if it is not readonly command.
func (c *Completed) IsWrite() bool {
	return !c.IsReadOnly()
}

// IsPipe checks if it is set pipeTag which prefers auto pipelining
func (c *Completed) IsPipe() bool {
	return c.cf&pipeTag == pipeTag
}

// Commands returns the commands as []string.
// Note that the returned []string should not be modified
// and should not be read after passing into the Client interface, because it will be recycled.
func (c *Completed) Commands() []string {
	return c.cs.s
}

// Slot returns the command key slot
func (c *Completed) Slot() uint16 {
	return c.ks
}

// SetSlot returns a new completed command with its key slot be overridden
func (c Completed) SetSlot(key string) Completed {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = slot(key)
	}
	return c
}

var Slot = slot

// Cacheable represents a completed Redis command which supports server-assisted client side caching,
// and it should be created by the Cache() of command builder.
type Cacheable Completed

// Pin prevents a Cacheable to be recycled
func (c Cacheable) Pin() Cacheable {
	c.cs.r = 1
	return c
}

// Slot returns the command key slot
func (c *Cacheable) Slot() uint16 {
	return c.ks
}

// Commands returns the commands as []string.
// Note that the returned []string should not be modified
// and should not be read after passing into the Client interface, because it will be recycled.
func (c *Cacheable) Commands() []string {
	return c.cs.s
}

// IsMGet returns if the command is MGET
func (c *Cacheable) IsMGet() bool {
	return c.cf == mtGetTag
}

// MGetCacheCmd returns the cache command of the MGET singular command
func MGetCacheCmd(c Cacheable) string {
	if c.cs.s[0][0] == 'J' {
		return "JSON.GET" + c.cs.s[len(c.cs.s)-1]
	}
	return "GET"
}

// MGetCacheKey returns the cache key of the MGET singular command
func MGetCacheKey(c Cacheable, i int) string {
	return c.cs.s[i+1]
}

// CacheKey returns the cache key used by the server-assisted client side caching
func CacheKey(c Cacheable) (key, command string) {
	if len(c.cs.s) == 2 {
		return c.cs.s[1], c.cs.s[0]
	}

	kp := 1

	if c.cf == scrRoTag {
		if c.cs.s[2] != "1" {
			panic(multiKeyCacheErr)
		}
		kp = 3
	}

	length := 0
	for i, v := range c.cs.s {
		if i == kp {
			continue
		}
		length += len(v)
	}
	sb := strings.Builder{}
	sb.Grow(length)
	for i, v := range c.cs.s {
		if i == kp {
			key = v
		} else {
			sb.WriteString(v)
		}
	}
	return key, sb.String()
}

// CompletedCS get the underlying *CommandSlice
func CompletedCS(c Completed) *CommandSlice {
	return c.cs
}

// CacheableCS get the underlying *CommandSlice
func CacheableCS(c Cacheable) *CommandSlice {
	return c.cs
}

// NewCompleted creates an arbitrary Completed command.
func NewCompleted(ss []string) Completed {
	return Completed{cs: newCommandSlice(ss)}
}

// NewBlockingCompleted creates an arbitrary blocking Completed command.
func NewBlockingCompleted(ss []string) Completed {
	return Completed{cs: newCommandSlice(ss), cf: blockTag}
}

// NewReadOnlyCompleted creates an arbitrary readonly Completed command.
func NewReadOnlyCompleted(ss []string) Completed {
	return Completed{cs: newCommandSlice(ss), cf: readonly}
}

// NewMGetCompleted creates an arbitrary readonly Completed command.
func NewMGetCompleted(ss []string) Completed {
	return Completed{cs: newCommandSlice(ss), cf: mtGetTag}
}

// MGets groups keys by their slot and returns multi MGET commands
func MGets(keys []string) map[uint16]Completed {
	return slotMCMDs("MGET", keys, mtGetTag)
}

// MDels groups keys by their slot and returns multi DEL commands
func MDels(keys []string) map[uint16]Completed {
	return slotMCMDs("DEL", keys, 0)
}

// MSets groups keys by their slot and returns multi MSET commands
func MSets(kvs map[string]string) map[uint16]Completed {
	return slotMSets("MSET", kvs)
}

// MSetNXs groups keys by their slot and returns multi MSETNX commands
func MSetNXs(kvs map[string]string) map[uint16]Completed {
	return slotMSets("MSETNX", kvs)
}

// JsonMGets groups keys by their slot and returns multi JSON.MGET commands
func JsonMGets(keys []string, path string) map[uint16]Completed {
	ret := slotMCMDs("JSON.MGET", keys, mtGetTag)
	for _, jsonmget := range ret {
		jsonmget.cs.s = append(jsonmget.cs.s, path)
		jsonmget.cs.l++
	}
	return ret
}

// JsonMSets groups keys by their slot and returns multi JSON.MSET commands
func JsonMSets(kvs map[string]string, path string) map[uint16]Completed {
	ret := make(map[uint16]Completed, 8)
	for key, value := range kvs {
		var cs *CommandSlice
		ks := slot(key)
		if cp, ok := ret[ks]; ok {
			cs = cp.cs
		} else {
			cs = get()
			cs.s = append(cs.s, "JSON.MSET")
			cs.l = 1
			ret[ks] = Completed{cs: cs, ks: ks}
		}
		cs.s = append(cs.s, key, path, value)
		cs.l += 3
	}
	return ret
}

func slotMCMDs(cmd string, keys []string, cf uint16) map[uint16]Completed {
	ret := make(map[uint16]Completed, 8)
	for _, key := range keys {
		var cs *CommandSlice
		ks := slot(key)
		if cp, ok := ret[ks]; ok {
			cs = cp.cs
		} else {
			cs = get()
			cs.s = append(cs.s, cmd)
			cs.l = 1
			ret[ks] = Completed{cs: cs, cf: cf, ks: ks}
		}
		cs.s = append(cs.s, key)
		cs.l++
	}
	return ret
}

func slotMSets(cmd string, kvs map[string]string) map[uint16]Completed {
	ret := make(map[uint16]Completed, 8)
	for key, value := range kvs {
		var cs *CommandSlice
		ks := slot(key)
		if cp, ok := ret[ks]; ok {
			cs = cp.cs
		} else {
			cs = get()
			cs.s = append(cs.s, cmd)
			cs.l = 1
			ret[ks] = Completed{cs: cs, ks: ks}
		}
		cs.s = append(cs.s, key, value)
		cs.l += 2
	}
	return ret
}

// NewMultiCompleted creates multiple arbitrary Completed commands.
func NewMultiCompleted(cs [][]string) []Completed {
	ret := make([]Completed, len(cs))
	for i, c := range cs {
		ret[i] = NewCompleted(c)
	}
	return ret
}

func check(prev, new uint16) uint16 {
	if prev == InitSlot || prev == new {
		return new
	}
	panic(multiKeySlotErr)
}

const multiKeySlotErr = "multi key command with different key slots are not allowed"
const multiKeyCacheErr = "client side caching for scripting only supports numkeys=1"
