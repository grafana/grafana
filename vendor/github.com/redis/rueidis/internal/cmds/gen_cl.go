// Code generated DO NOT EDIT

package cmds

import "strconv"

type ClThrottle Incomplete

func (b Builder) ClThrottle() (c ClThrottle) {
	c = ClThrottle{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "CL.THROTTLE")
	return c
}

func (c ClThrottle) Key(key string) ClThrottleKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (ClThrottleKey)(c)
}

type ClThrottleCountPerPeriod Incomplete

func (c ClThrottleCountPerPeriod) Period(period int64) ClThrottlePeriod {
	c.cs.s = append(c.cs.s, strconv.FormatInt(period, 10))
	return (ClThrottlePeriod)(c)
}

type ClThrottleKey Incomplete

func (c ClThrottleKey) MaxBurst(maxBurst int64) ClThrottleMaxBurst {
	c.cs.s = append(c.cs.s, strconv.FormatInt(maxBurst, 10))
	return (ClThrottleMaxBurst)(c)
}

type ClThrottleMaxBurst Incomplete

func (c ClThrottleMaxBurst) CountPerPeriod(countPerPeriod int64) ClThrottleCountPerPeriod {
	c.cs.s = append(c.cs.s, strconv.FormatInt(countPerPeriod, 10))
	return (ClThrottleCountPerPeriod)(c)
}

type ClThrottlePeriod Incomplete

func (c ClThrottlePeriod) Quantity(quantity int64) ClThrottleQuantity {
	c.cs.s = append(c.cs.s, strconv.FormatInt(quantity, 10))
	return (ClThrottleQuantity)(c)
}

func (c ClThrottlePeriod) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type ClThrottleQuantity Incomplete

func (c ClThrottleQuantity) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
