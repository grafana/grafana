// Code generated DO NOT EDIT

package cmds

type Discard Incomplete

func (b Builder) Discard() (c Discard) {
	c = Discard{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "DISCARD")
	return c
}

func (c Discard) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Exec Incomplete

func (b Builder) Exec() (c Exec) {
	c = Exec{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "EXEC")
	return c
}

func (c Exec) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Multi Incomplete

func (b Builder) Multi() (c Multi) {
	c = Multi{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "MULTI")
	return c
}

func (c Multi) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Unwatch Incomplete

func (b Builder) Unwatch() (c Unwatch) {
	c = Unwatch{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "UNWATCH")
	return c
}

func (c Unwatch) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Watch Incomplete

func (b Builder) Watch() (c Watch) {
	c = Watch{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "WATCH")
	return c
}

func (c Watch) Key(key ...string) WatchKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return (WatchKey)(c)
}

type WatchKey Incomplete

func (c WatchKey) Key(key ...string) WatchKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range key {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range key {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, key...)
	return c
}

func (c WatchKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
