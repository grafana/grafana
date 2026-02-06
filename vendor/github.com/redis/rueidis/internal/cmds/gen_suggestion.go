// Code generated DO NOT EDIT

package cmds

import "strconv"

type FtSugadd Incomplete

func (b Builder) FtSugadd() (c FtSugadd) {
	c = FtSugadd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FT.SUGADD")
	return c
}

func (c FtSugadd) Key(key string) FtSugaddKey {
	c.cs.s = append(c.cs.s, key)
	return (FtSugaddKey)(c)
}

type FtSugaddIncrementScoreIncr Incomplete

func (c FtSugaddIncrementScoreIncr) Payload(payload string) FtSugaddPayload {
	c.cs.s = append(c.cs.s, "PAYLOAD", payload)
	return (FtSugaddPayload)(c)
}

func (c FtSugaddIncrementScoreIncr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSugaddKey Incomplete

func (c FtSugaddKey) String(string string) FtSugaddString {
	c.cs.s = append(c.cs.s, string)
	return (FtSugaddString)(c)
}

type FtSugaddPayload Incomplete

func (c FtSugaddPayload) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSugaddScore Incomplete

func (c FtSugaddScore) Incr() FtSugaddIncrementScoreIncr {
	c.cs.s = append(c.cs.s, "INCR")
	return (FtSugaddIncrementScoreIncr)(c)
}

func (c FtSugaddScore) Payload(payload string) FtSugaddPayload {
	c.cs.s = append(c.cs.s, "PAYLOAD", payload)
	return (FtSugaddPayload)(c)
}

func (c FtSugaddScore) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSugaddString Incomplete

func (c FtSugaddString) Score(score float64) FtSugaddScore {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(score, 'f', -1, 64))
	return (FtSugaddScore)(c)
}

type FtSugdel Incomplete

func (b Builder) FtSugdel() (c FtSugdel) {
	c = FtSugdel{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FT.SUGDEL")
	return c
}

func (c FtSugdel) Key(key string) FtSugdelKey {
	c.cs.s = append(c.cs.s, key)
	return (FtSugdelKey)(c)
}

type FtSugdelKey Incomplete

func (c FtSugdelKey) String(string string) FtSugdelString {
	c.cs.s = append(c.cs.s, string)
	return (FtSugdelString)(c)
}

type FtSugdelString Incomplete

func (c FtSugdelString) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSugget Incomplete

func (b Builder) FtSugget() (c FtSugget) {
	c = FtSugget{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FT.SUGGET")
	return c
}

func (c FtSugget) Key(key string) FtSuggetKey {
	c.cs.s = append(c.cs.s, key)
	return (FtSuggetKey)(c)
}

type FtSuggetFuzzy Incomplete

func (c FtSuggetFuzzy) Withscores() FtSuggetWithscores {
	c.cs.s = append(c.cs.s, "WITHSCORES")
	return (FtSuggetWithscores)(c)
}

func (c FtSuggetFuzzy) Withpayloads() FtSuggetWithpayloads {
	c.cs.s = append(c.cs.s, "WITHPAYLOADS")
	return (FtSuggetWithpayloads)(c)
}

func (c FtSuggetFuzzy) Max(max int64) FtSuggetMax {
	c.cs.s = append(c.cs.s, "MAX", strconv.FormatInt(max, 10))
	return (FtSuggetMax)(c)
}

func (c FtSuggetFuzzy) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSuggetKey Incomplete

func (c FtSuggetKey) Prefix(prefix string) FtSuggetPrefix {
	c.cs.s = append(c.cs.s, prefix)
	return (FtSuggetPrefix)(c)
}

type FtSuggetMax Incomplete

func (c FtSuggetMax) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSuggetPrefix Incomplete

func (c FtSuggetPrefix) Fuzzy() FtSuggetFuzzy {
	c.cs.s = append(c.cs.s, "FUZZY")
	return (FtSuggetFuzzy)(c)
}

func (c FtSuggetPrefix) Withscores() FtSuggetWithscores {
	c.cs.s = append(c.cs.s, "WITHSCORES")
	return (FtSuggetWithscores)(c)
}

func (c FtSuggetPrefix) Withpayloads() FtSuggetWithpayloads {
	c.cs.s = append(c.cs.s, "WITHPAYLOADS")
	return (FtSuggetWithpayloads)(c)
}

func (c FtSuggetPrefix) Max(max int64) FtSuggetMax {
	c.cs.s = append(c.cs.s, "MAX", strconv.FormatInt(max, 10))
	return (FtSuggetMax)(c)
}

func (c FtSuggetPrefix) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSuggetWithpayloads Incomplete

func (c FtSuggetWithpayloads) Max(max int64) FtSuggetMax {
	c.cs.s = append(c.cs.s, "MAX", strconv.FormatInt(max, 10))
	return (FtSuggetMax)(c)
}

func (c FtSuggetWithpayloads) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSuggetWithscores Incomplete

func (c FtSuggetWithscores) Withpayloads() FtSuggetWithpayloads {
	c.cs.s = append(c.cs.s, "WITHPAYLOADS")
	return (FtSuggetWithpayloads)(c)
}

func (c FtSuggetWithscores) Max(max int64) FtSuggetMax {
	c.cs.s = append(c.cs.s, "MAX", strconv.FormatInt(max, 10))
	return (FtSuggetMax)(c)
}

func (c FtSuggetWithscores) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type FtSuglen Incomplete

func (b Builder) FtSuglen() (c FtSuglen) {
	c = FtSuglen{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "FT.SUGLEN")
	return c
}

func (c FtSuglen) Key(key string) FtSuglenKey {
	c.cs.s = append(c.cs.s, key)
	return (FtSuglenKey)(c)
}

type FtSuglenKey Incomplete

func (c FtSuglenKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
