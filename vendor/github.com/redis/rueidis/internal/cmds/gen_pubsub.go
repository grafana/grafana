// Code generated DO NOT EDIT

package cmds

type Psubscribe Incomplete

func (b Builder) Psubscribe() (c Psubscribe) {
	c = Psubscribe{cs: get(), ks: b.ks, cf: int16(noRetTag)}
	c.cs.s = append(c.cs.s, "PSUBSCRIBE")
	return c
}

func (c Psubscribe) Pattern(pattern ...string) PsubscribePattern {
	c.cs.s = append(c.cs.s, pattern...)
	return (PsubscribePattern)(c)
}

type PsubscribePattern Incomplete

func (c PsubscribePattern) Pattern(pattern ...string) PsubscribePattern {
	c.cs.s = append(c.cs.s, pattern...)
	return c
}

func (c PsubscribePattern) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Publish Incomplete

func (b Builder) Publish() (c Publish) {
	c = Publish{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PUBLISH")
	return c
}

func (c Publish) Channel(channel string) PublishChannel {
	c.cs.s = append(c.cs.s, channel)
	return (PublishChannel)(c)
}

type PublishChannel Incomplete

func (c PublishChannel) Message(message string) PublishMessage {
	c.cs.s = append(c.cs.s, message)
	return (PublishMessage)(c)
}

type PublishMessage Incomplete

func (c PublishMessage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubChannels Incomplete

func (b Builder) PubsubChannels() (c PubsubChannels) {
	c = PubsubChannels{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PUBSUB", "CHANNELS")
	return c
}

func (c PubsubChannels) Pattern(pattern string) PubsubChannelsPattern {
	c.cs.s = append(c.cs.s, pattern)
	return (PubsubChannelsPattern)(c)
}

func (c PubsubChannels) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubChannelsPattern Incomplete

func (c PubsubChannelsPattern) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubHelp Incomplete

func (b Builder) PubsubHelp() (c PubsubHelp) {
	c = PubsubHelp{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PUBSUB", "HELP")
	return c
}

func (c PubsubHelp) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubNumpat Incomplete

func (b Builder) PubsubNumpat() (c PubsubNumpat) {
	c = PubsubNumpat{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PUBSUB", "NUMPAT")
	return c
}

func (c PubsubNumpat) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubNumsub Incomplete

func (b Builder) PubsubNumsub() (c PubsubNumsub) {
	c = PubsubNumsub{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PUBSUB", "NUMSUB")
	return c
}

func (c PubsubNumsub) Channel(channel ...string) PubsubNumsubChannel {
	c.cs.s = append(c.cs.s, channel...)
	return (PubsubNumsubChannel)(c)
}

func (c PubsubNumsub) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubNumsubChannel Incomplete

func (c PubsubNumsubChannel) Channel(channel ...string) PubsubNumsubChannel {
	c.cs.s = append(c.cs.s, channel...)
	return c
}

func (c PubsubNumsubChannel) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubShardchannels Incomplete

func (b Builder) PubsubShardchannels() (c PubsubShardchannels) {
	c = PubsubShardchannels{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PUBSUB", "SHARDCHANNELS")
	return c
}

func (c PubsubShardchannels) Pattern(pattern string) PubsubShardchannelsPattern {
	c.cs.s = append(c.cs.s, pattern)
	return (PubsubShardchannelsPattern)(c)
}

func (c PubsubShardchannels) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubShardchannelsPattern Incomplete

func (c PubsubShardchannelsPattern) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubShardnumsub Incomplete

func (b Builder) PubsubShardnumsub() (c PubsubShardnumsub) {
	c = PubsubShardnumsub{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PUBSUB", "SHARDNUMSUB")
	return c
}

func (c PubsubShardnumsub) Channel(channel ...string) PubsubShardnumsubChannel {
	if c.ks&NoSlot == NoSlot {
		for _, k := range channel {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range channel {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, channel...)
	return (PubsubShardnumsubChannel)(c)
}

func (c PubsubShardnumsub) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PubsubShardnumsubChannel Incomplete

func (c PubsubShardnumsubChannel) Channel(channel ...string) PubsubShardnumsubChannel {
	if c.ks&NoSlot == NoSlot {
		for _, k := range channel {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range channel {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, channel...)
	return c
}

func (c PubsubShardnumsubChannel) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Punsubscribe Incomplete

func (b Builder) Punsubscribe() (c Punsubscribe) {
	c = Punsubscribe{cs: get(), ks: b.ks, cf: int16(unsubTag)}
	c.cs.s = append(c.cs.s, "PUNSUBSCRIBE")
	return c
}

func (c Punsubscribe) Pattern(pattern ...string) PunsubscribePattern {
	c.cs.s = append(c.cs.s, pattern...)
	return (PunsubscribePattern)(c)
}

func (c Punsubscribe) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PunsubscribePattern Incomplete

func (c PunsubscribePattern) Pattern(pattern ...string) PunsubscribePattern {
	c.cs.s = append(c.cs.s, pattern...)
	return c
}

func (c PunsubscribePattern) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Spublish Incomplete

func (b Builder) Spublish() (c Spublish) {
	c = Spublish{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "SPUBLISH")
	return c
}

func (c Spublish) Channel(channel string) SpublishChannel {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(channel)
	} else {
		c.ks = check(c.ks, slot(channel))
	}
	c.cs.s = append(c.cs.s, channel)
	return (SpublishChannel)(c)
}

type SpublishChannel Incomplete

func (c SpublishChannel) Message(message string) SpublishMessage {
	c.cs.s = append(c.cs.s, message)
	return (SpublishMessage)(c)
}

type SpublishMessage Incomplete

func (c SpublishMessage) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Ssubscribe Incomplete

func (b Builder) Ssubscribe() (c Ssubscribe) {
	c = Ssubscribe{cs: get(), ks: b.ks, cf: int16(noRetTag)}
	c.cs.s = append(c.cs.s, "SSUBSCRIBE")
	return c
}

func (c Ssubscribe) Channel(channel ...string) SsubscribeChannel {
	if c.ks&NoSlot == NoSlot {
		for _, k := range channel {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range channel {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, channel...)
	return (SsubscribeChannel)(c)
}

type SsubscribeChannel Incomplete

func (c SsubscribeChannel) Channel(channel ...string) SsubscribeChannel {
	if c.ks&NoSlot == NoSlot {
		for _, k := range channel {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range channel {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, channel...)
	return c
}

func (c SsubscribeChannel) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Subscribe Incomplete

func (b Builder) Subscribe() (c Subscribe) {
	c = Subscribe{cs: get(), ks: b.ks, cf: int16(noRetTag)}
	c.cs.s = append(c.cs.s, "SUBSCRIBE")
	return c
}

func (c Subscribe) Channel(channel ...string) SubscribeChannel {
	c.cs.s = append(c.cs.s, channel...)
	return (SubscribeChannel)(c)
}

type SubscribeChannel Incomplete

func (c SubscribeChannel) Channel(channel ...string) SubscribeChannel {
	c.cs.s = append(c.cs.s, channel...)
	return c
}

func (c SubscribeChannel) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Sunsubscribe Incomplete

func (b Builder) Sunsubscribe() (c Sunsubscribe) {
	c = Sunsubscribe{cs: get(), ks: b.ks, cf: int16(unsubTag)}
	c.cs.s = append(c.cs.s, "SUNSUBSCRIBE")
	return c
}

func (c Sunsubscribe) Channel(channel ...string) SunsubscribeChannel {
	if c.ks&NoSlot == NoSlot {
		for _, k := range channel {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range channel {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, channel...)
	return (SunsubscribeChannel)(c)
}

func (c Sunsubscribe) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type SunsubscribeChannel Incomplete

func (c SunsubscribeChannel) Channel(channel ...string) SunsubscribeChannel {
	if c.ks&NoSlot == NoSlot {
		for _, k := range channel {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range channel {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, channel...)
	return c
}

func (c SunsubscribeChannel) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Unsubscribe Incomplete

func (b Builder) Unsubscribe() (c Unsubscribe) {
	c = Unsubscribe{cs: get(), ks: b.ks, cf: int16(unsubTag)}
	c.cs.s = append(c.cs.s, "UNSUBSCRIBE")
	return c
}

func (c Unsubscribe) Channel(channel ...string) UnsubscribeChannel {
	c.cs.s = append(c.cs.s, channel...)
	return (UnsubscribeChannel)(c)
}

func (c Unsubscribe) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type UnsubscribeChannel Incomplete

func (c UnsubscribeChannel) Channel(channel ...string) UnsubscribeChannel {
	c.cs.s = append(c.cs.s, channel...)
	return c
}

func (c UnsubscribeChannel) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
