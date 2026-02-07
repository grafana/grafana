// Code generated DO NOT EDIT

package cmds

import "strconv"

type TdigestAdd Incomplete

func (b Builder) TdigestAdd() (c TdigestAdd) {
	c = TdigestAdd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.ADD")
	return c
}

func (c TdigestAdd) Key(key string) TdigestAddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestAddKey)(c)
}

type TdigestAddKey Incomplete

func (c TdigestAddKey) Value(value float64) TdigestAddValuesValue {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(value, 'f', -1, 64))
	return (TdigestAddValuesValue)(c)
}

type TdigestAddValuesValue Incomplete

func (c TdigestAddValuesValue) Value(value float64) TdigestAddValuesValue {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(value, 'f', -1, 64))
	return c
}

func (c TdigestAddValuesValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestByrank Incomplete

func (b Builder) TdigestByrank() (c TdigestByrank) {
	c = TdigestByrank{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.BYRANK")
	return c
}

func (c TdigestByrank) Key(key string) TdigestByrankKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestByrankKey)(c)
}

type TdigestByrankKey Incomplete

func (c TdigestByrankKey) Rank(rank ...float64) TdigestByrankRank {
	for _, n := range rank {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return (TdigestByrankRank)(c)
}

type TdigestByrankRank Incomplete

func (c TdigestByrankRank) Rank(rank ...float64) TdigestByrankRank {
	for _, n := range rank {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return c
}

func (c TdigestByrankRank) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestByrevrank Incomplete

func (b Builder) TdigestByrevrank() (c TdigestByrevrank) {
	c = TdigestByrevrank{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.BYREVRANK")
	return c
}

func (c TdigestByrevrank) Key(key string) TdigestByrevrankKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestByrevrankKey)(c)
}

type TdigestByrevrankKey Incomplete

func (c TdigestByrevrankKey) ReverseRank(reverseRank ...float64) TdigestByrevrankReverseRank {
	for _, n := range reverseRank {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return (TdigestByrevrankReverseRank)(c)
}

type TdigestByrevrankReverseRank Incomplete

func (c TdigestByrevrankReverseRank) ReverseRank(reverseRank ...float64) TdigestByrevrankReverseRank {
	for _, n := range reverseRank {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return c
}

func (c TdigestByrevrankReverseRank) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestCdf Incomplete

func (b Builder) TdigestCdf() (c TdigestCdf) {
	c = TdigestCdf{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.CDF")
	return c
}

func (c TdigestCdf) Key(key string) TdigestCdfKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestCdfKey)(c)
}

type TdigestCdfKey Incomplete

func (c TdigestCdfKey) Value(value ...float64) TdigestCdfValue {
	for _, n := range value {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return (TdigestCdfValue)(c)
}

type TdigestCdfValue Incomplete

func (c TdigestCdfValue) Value(value ...float64) TdigestCdfValue {
	for _, n := range value {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return c
}

func (c TdigestCdfValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestCreate Incomplete

func (b Builder) TdigestCreate() (c TdigestCreate) {
	c = TdigestCreate{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.CREATE")
	return c
}

func (c TdigestCreate) Key(key string) TdigestCreateKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestCreateKey)(c)
}

type TdigestCreateCompression Incomplete

func (c TdigestCreateCompression) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestCreateKey Incomplete

func (c TdigestCreateKey) Compression(compression int64) TdigestCreateCompression {
	c.cs.s = append(c.cs.s, "COMPRESSION", strconv.FormatInt(compression, 10))
	return (TdigestCreateCompression)(c)
}

func (c TdigestCreateKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestInfo Incomplete

func (b Builder) TdigestInfo() (c TdigestInfo) {
	c = TdigestInfo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.INFO")
	return c
}

func (c TdigestInfo) Key(key string) TdigestInfoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestInfoKey)(c)
}

type TdigestInfoKey Incomplete

func (c TdigestInfoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestMax Incomplete

func (b Builder) TdigestMax() (c TdigestMax) {
	c = TdigestMax{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.MAX")
	return c
}

func (c TdigestMax) Key(key string) TdigestMaxKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestMaxKey)(c)
}

type TdigestMaxKey Incomplete

func (c TdigestMaxKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestMerge Incomplete

func (b Builder) TdigestMerge() (c TdigestMerge) {
	c = TdigestMerge{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.MERGE")
	return c
}

func (c TdigestMerge) DestinationKey(destinationKey string) TdigestMergeDestinationKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(destinationKey)
	} else {
		c.ks = check(c.ks, slot(destinationKey))
	}
	c.cs.s = append(c.cs.s, destinationKey)
	return (TdigestMergeDestinationKey)(c)
}

type TdigestMergeConfigCompression Incomplete

func (c TdigestMergeConfigCompression) Override() TdigestMergeOverride {
	c.cs.s = append(c.cs.s, "OVERRIDE")
	return (TdigestMergeOverride)(c)
}

func (c TdigestMergeConfigCompression) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestMergeDestinationKey Incomplete

func (c TdigestMergeDestinationKey) Numkeys(numkeys int64) TdigestMergeNumkeys {
	c.cs.s = append(c.cs.s, strconv.FormatInt(numkeys, 10))
	return (TdigestMergeNumkeys)(c)
}

type TdigestMergeNumkeys Incomplete

func (c TdigestMergeNumkeys) SourceKey(sourceKey ...string) TdigestMergeSourceKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range sourceKey {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range sourceKey {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, sourceKey...)
	return (TdigestMergeSourceKey)(c)
}

type TdigestMergeOverride Incomplete

func (c TdigestMergeOverride) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestMergeSourceKey Incomplete

func (c TdigestMergeSourceKey) SourceKey(sourceKey ...string) TdigestMergeSourceKey {
	if c.ks&NoSlot == NoSlot {
		for _, k := range sourceKey {
			c.ks = NoSlot | slot(k)
			break
		}
	} else {
		for _, k := range sourceKey {
			c.ks = check(c.ks, slot(k))
		}
	}
	c.cs.s = append(c.cs.s, sourceKey...)
	return c
}

func (c TdigestMergeSourceKey) Compression(compression int64) TdigestMergeConfigCompression {
	c.cs.s = append(c.cs.s, "COMPRESSION", strconv.FormatInt(compression, 10))
	return (TdigestMergeConfigCompression)(c)
}

func (c TdigestMergeSourceKey) Override() TdigestMergeOverride {
	c.cs.s = append(c.cs.s, "OVERRIDE")
	return (TdigestMergeOverride)(c)
}

func (c TdigestMergeSourceKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestMin Incomplete

func (b Builder) TdigestMin() (c TdigestMin) {
	c = TdigestMin{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.MIN")
	return c
}

func (c TdigestMin) Key(key string) TdigestMinKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestMinKey)(c)
}

type TdigestMinKey Incomplete

func (c TdigestMinKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestQuantile Incomplete

func (b Builder) TdigestQuantile() (c TdigestQuantile) {
	c = TdigestQuantile{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.QUANTILE")
	return c
}

func (c TdigestQuantile) Key(key string) TdigestQuantileKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestQuantileKey)(c)
}

type TdigestQuantileKey Incomplete

func (c TdigestQuantileKey) Quantile(quantile ...float64) TdigestQuantileQuantile {
	for _, n := range quantile {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return (TdigestQuantileQuantile)(c)
}

type TdigestQuantileQuantile Incomplete

func (c TdigestQuantileQuantile) Quantile(quantile ...float64) TdigestQuantileQuantile {
	for _, n := range quantile {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return c
}

func (c TdigestQuantileQuantile) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestRank Incomplete

func (b Builder) TdigestRank() (c TdigestRank) {
	c = TdigestRank{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.RANK")
	return c
}

func (c TdigestRank) Key(key string) TdigestRankKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestRankKey)(c)
}

type TdigestRankKey Incomplete

func (c TdigestRankKey) Value(value ...float64) TdigestRankValue {
	for _, n := range value {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return (TdigestRankValue)(c)
}

type TdigestRankValue Incomplete

func (c TdigestRankValue) Value(value ...float64) TdigestRankValue {
	for _, n := range value {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return c
}

func (c TdigestRankValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestReset Incomplete

func (b Builder) TdigestReset() (c TdigestReset) {
	c = TdigestReset{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.RESET")
	return c
}

func (c TdigestReset) Key(key string) TdigestResetKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestResetKey)(c)
}

type TdigestResetKey Incomplete

func (c TdigestResetKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestRevrank Incomplete

func (b Builder) TdigestRevrank() (c TdigestRevrank) {
	c = TdigestRevrank{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.REVRANK")
	return c
}

func (c TdigestRevrank) Key(key string) TdigestRevrankKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestRevrankKey)(c)
}

type TdigestRevrankKey Incomplete

func (c TdigestRevrankKey) Value(value ...float64) TdigestRevrankValue {
	for _, n := range value {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return (TdigestRevrankValue)(c)
}

type TdigestRevrankValue Incomplete

func (c TdigestRevrankValue) Value(value ...float64) TdigestRevrankValue {
	for _, n := range value {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(n, 'f', -1, 64))
	}
	return c
}

func (c TdigestRevrankValue) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestTrimmedMean Incomplete

func (b Builder) TdigestTrimmedMean() (c TdigestTrimmedMean) {
	c = TdigestTrimmedMean{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "TDIGEST.TRIMMED_MEAN")
	return c
}

func (c TdigestTrimmedMean) Key(key string) TdigestTrimmedMeanKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (TdigestTrimmedMeanKey)(c)
}

type TdigestTrimmedMeanHighCutQuantile Incomplete

func (c TdigestTrimmedMeanHighCutQuantile) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type TdigestTrimmedMeanKey Incomplete

func (c TdigestTrimmedMeanKey) LowCutQuantile(lowCutQuantile float64) TdigestTrimmedMeanLowCutQuantile {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(lowCutQuantile, 'f', -1, 64))
	return (TdigestTrimmedMeanLowCutQuantile)(c)
}

type TdigestTrimmedMeanLowCutQuantile Incomplete

func (c TdigestTrimmedMeanLowCutQuantile) HighCutQuantile(highCutQuantile float64) TdigestTrimmedMeanHighCutQuantile {
	c.cs.s = append(c.cs.s, strconv.FormatFloat(highCutQuantile, 'f', -1, 64))
	return (TdigestTrimmedMeanHighCutQuantile)(c)
}
