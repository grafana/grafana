// Code generated DO NOT EDIT

package cmds

type Pfadd Incomplete

func (b Builder) Pfadd() (c Pfadd) {
	c = Pfadd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PFADD")
	return c
}

func (c Pfadd) Key(key string) PfaddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (PfaddKey)(c)
}

type PfaddElement Incomplete

func (c PfaddElement) Element(element ...string) PfaddElement {
	c.cs.s = append(c.cs.s, element...)
	return c
}

func (c PfaddElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PfaddKey Incomplete

func (c PfaddKey) Element(element ...string) PfaddElement {
	c.cs.s = append(c.cs.s, element...)
	return (PfaddElement)(c)
}

func (c PfaddKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Pfcount Incomplete

func (b Builder) Pfcount() (c Pfcount) {
	c = Pfcount{cs: get(), ks: b.ks, cf: int16(readonly)}
	c.cs.s = append(c.cs.s, "PFCOUNT")
	return c
}

func (c Pfcount) Key(key ...string) PfcountKey {
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
	return (PfcountKey)(c)
}

type PfcountKey Incomplete

func (c PfcountKey) Key(key ...string) PfcountKey {
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

func (c PfcountKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Pfmerge Incomplete

func (b Builder) Pfmerge() (c Pfmerge) {
	c = Pfmerge{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "PFMERGE")
	return c
}

func (c Pfmerge) Destkey(destkey string) PfmergeDestkey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destkey)
	} else {
		c.ks = check(c.ks, slot(destkey))
	}
	c.cs.s = append(c.cs.s, destkey)
	return (PfmergeDestkey)(c)
}

type PfmergeDestkey Incomplete

func (c PfmergeDestkey) Sourcekey(sourcekey ...string) PfmergeSourcekey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range sourcekey {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range sourcekey {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, sourcekey...)
	return (PfmergeSourcekey)(c)
}

func (c PfmergeDestkey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type PfmergeSourcekey Incomplete

func (c PfmergeSourcekey) Sourcekey(sourcekey ...string) PfmergeSourcekey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range sourcekey {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range sourcekey {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, sourcekey...)
	return c
}

func (c PfmergeSourcekey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
