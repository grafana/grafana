// Code generated DO NOT EDIT

package cmds

import "strconv"

type Vadd Incomplete

func (b Builder) Vadd() (c Vadd) {
	c = Vadd{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VADD")
	return c
}

func (c Vadd) Key(key string) VaddKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VaddKey)(c)
}

type VaddCas Incomplete

func (c VaddCas) Noquant() VaddQuantizationNoquant {
	c.cs.s = append(c.cs.s, "NOQUANT")
	return (VaddQuantizationNoquant)(c)
}

func (c VaddCas) Q8() VaddQuantizationQ8 {
	c.cs.s = append(c.cs.s, "Q8")
	return (VaddQuantizationQ8)(c)
}

func (c VaddCas) Bin() VaddQuantizationBin {
	c.cs.s = append(c.cs.s, "BIN")
	return (VaddQuantizationBin)(c)
}

func (c VaddCas) Ef(buildExplorationFactor int64) VaddEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(buildExplorationFactor, 10))
	return (VaddEf)(c)
}

func (c VaddCas) Setattr(attributes string) VaddSetattr {
	c.cs.s = append(c.cs.s, "SETATTR", attributes)
	return (VaddSetattr)(c)
}

func (c VaddCas) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddCas) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddEf Incomplete

func (c VaddEf) Setattr(attributes string) VaddSetattr {
	c.cs.s = append(c.cs.s, "SETATTR", attributes)
	return (VaddSetattr)(c)
}

func (c VaddEf) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddEf) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddElement Incomplete

func (c VaddElement) Cas() VaddCas {
	c.cs.s = append(c.cs.s, "CAS")
	return (VaddCas)(c)
}

func (c VaddElement) Noquant() VaddQuantizationNoquant {
	c.cs.s = append(c.cs.s, "NOQUANT")
	return (VaddQuantizationNoquant)(c)
}

func (c VaddElement) Q8() VaddQuantizationQ8 {
	c.cs.s = append(c.cs.s, "Q8")
	return (VaddQuantizationQ8)(c)
}

func (c VaddElement) Bin() VaddQuantizationBin {
	c.cs.s = append(c.cs.s, "BIN")
	return (VaddQuantizationBin)(c)
}

func (c VaddElement) Ef(buildExplorationFactor int64) VaddEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(buildExplorationFactor, 10))
	return (VaddEf)(c)
}

func (c VaddElement) Setattr(attributes string) VaddSetattr {
	c.cs.s = append(c.cs.s, "SETATTR", attributes)
	return (VaddSetattr)(c)
}

func (c VaddElement) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddKey Incomplete

func (c VaddKey) Reduce(dim int64) VaddReduce {
	c.cs.s = append(c.cs.s, "REDUCE", strconv.FormatInt(dim, 10))
	return (VaddReduce)(c)
}

func (c VaddKey) Fp32() VaddNumFp32Fp32 {
	c.cs.s = append(c.cs.s, "FP32")
	return (VaddNumFp32Fp32)(c)
}

func (c VaddKey) Values(num int64) VaddNumValuesValues {
	c.cs.s = append(c.cs.s, "VALUES", strconv.FormatInt(num, 10))
	return (VaddNumValuesValues)(c)
}

type VaddM Incomplete

func (c VaddM) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddNumFp32Fp32 Incomplete

func (c VaddNumFp32Fp32) Vector(vector string) VaddNumFp32Vector {
	c.cs.s = append(c.cs.s, vector)
	return (VaddNumFp32Vector)(c)
}

type VaddNumFp32Vector Incomplete

func (c VaddNumFp32Vector) Element(element string) VaddElement {
	c.cs.s = append(c.cs.s, element)
	return (VaddElement)(c)
}

type VaddNumValuesValues Incomplete

func (c VaddNumValuesValues) Vector(vector ...float32) VaddNumValuesVector {
	for _, n := range vector {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(float64(n), 'f', -1, 64))
	}
	return (VaddNumValuesVector)(c)
}

type VaddNumValuesVector Incomplete

func (c VaddNumValuesVector) Vector(vector ...float32) VaddNumValuesVector {
	for _, n := range vector {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(float64(n), 'f', -1, 64))
	}
	return c
}

func (c VaddNumValuesVector) Element(element string) VaddElement {
	c.cs.s = append(c.cs.s, element)
	return (VaddElement)(c)
}

type VaddQuantizationBin Incomplete

func (c VaddQuantizationBin) Ef(buildExplorationFactor int64) VaddEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(buildExplorationFactor, 10))
	return (VaddEf)(c)
}

func (c VaddQuantizationBin) Setattr(attributes string) VaddSetattr {
	c.cs.s = append(c.cs.s, "SETATTR", attributes)
	return (VaddSetattr)(c)
}

func (c VaddQuantizationBin) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddQuantizationBin) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddQuantizationNoquant Incomplete

func (c VaddQuantizationNoquant) Ef(buildExplorationFactor int64) VaddEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(buildExplorationFactor, 10))
	return (VaddEf)(c)
}

func (c VaddQuantizationNoquant) Setattr(attributes string) VaddSetattr {
	c.cs.s = append(c.cs.s, "SETATTR", attributes)
	return (VaddSetattr)(c)
}

func (c VaddQuantizationNoquant) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddQuantizationNoquant) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddQuantizationQ8 Incomplete

func (c VaddQuantizationQ8) Ef(buildExplorationFactor int64) VaddEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(buildExplorationFactor, 10))
	return (VaddEf)(c)
}

func (c VaddQuantizationQ8) Setattr(attributes string) VaddSetattr {
	c.cs.s = append(c.cs.s, "SETATTR", attributes)
	return (VaddSetattr)(c)
}

func (c VaddQuantizationQ8) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddQuantizationQ8) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VaddReduce Incomplete

func (c VaddReduce) Fp32() VaddNumFp32Fp32 {
	c.cs.s = append(c.cs.s, "FP32")
	return (VaddNumFp32Fp32)(c)
}

func (c VaddReduce) Values(num int64) VaddNumValuesValues {
	c.cs.s = append(c.cs.s, "VALUES", strconv.FormatInt(num, 10))
	return (VaddNumValuesValues)(c)
}

type VaddSetattr Incomplete

func (c VaddSetattr) M(numlinks int64) VaddM {
	c.cs.s = append(c.cs.s, "M", strconv.FormatInt(numlinks, 10))
	return (VaddM)(c)
}

func (c VaddSetattr) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vcard Incomplete

func (b Builder) Vcard() (c Vcard) {
	c = Vcard{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VCARD")
	return c
}

func (c Vcard) Key(key string) VcardKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VcardKey)(c)
}

type VcardKey Incomplete

func (c VcardKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vdim Incomplete

func (b Builder) Vdim() (c Vdim) {
	c = Vdim{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VDIM")
	return c
}

func (c Vdim) Key(key string) VdimKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VdimKey)(c)
}

type VdimKey Incomplete

func (c VdimKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vemb Incomplete

func (b Builder) Vemb() (c Vemb) {
	c = Vemb{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VEMB")
	return c
}

func (c Vemb) Key(key string) VembKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VembKey)(c)
}

type VembElement Incomplete

func (c VembElement) Raw() VembRaw {
	c.cs.s = append(c.cs.s, "RAW")
	return (VembRaw)(c)
}

func (c VembElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VembKey Incomplete

func (c VembKey) Element(element string) VembElement {
	c.cs.s = append(c.cs.s, element)
	return (VembElement)(c)
}

type VembRaw Incomplete

func (c VembRaw) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vgetattr Incomplete

func (b Builder) Vgetattr() (c Vgetattr) {
	c = Vgetattr{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VGETATTR")
	return c
}

func (c Vgetattr) Key(key string) VgetattrKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VgetattrKey)(c)
}

type VgetattrElement Incomplete

func (c VgetattrElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VgetattrKey Incomplete

func (c VgetattrKey) Element(element string) VgetattrElement {
	c.cs.s = append(c.cs.s, element)
	return (VgetattrElement)(c)
}

type Vinfo Incomplete

func (b Builder) Vinfo() (c Vinfo) {
	c = Vinfo{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VINFO")
	return c
}

func (c Vinfo) Key(key string) VinfoKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VinfoKey)(c)
}

type VinfoKey Incomplete

func (c VinfoKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vlinks Incomplete

func (b Builder) Vlinks() (c Vlinks) {
	c = Vlinks{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VLINKS")
	return c
}

func (c Vlinks) Key(key string) VlinksKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VlinksKey)(c)
}

type VlinksElement Incomplete

func (c VlinksElement) Withscores() VlinksWithscores {
	c.cs.s = append(c.cs.s, "WITHSCORES")
	return (VlinksWithscores)(c)
}

func (c VlinksElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VlinksKey Incomplete

func (c VlinksKey) Element(element string) VlinksElement {
	c.cs.s = append(c.cs.s, element)
	return (VlinksElement)(c)
}

type VlinksWithscores Incomplete

func (c VlinksWithscores) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vrandmember Incomplete

func (b Builder) Vrandmember() (c Vrandmember) {
	c = Vrandmember{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VRANDMEMBER")
	return c
}

func (c Vrandmember) Key(key string) VrandmemberKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VrandmemberKey)(c)
}

type VrandmemberCount Incomplete

func (c VrandmemberCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VrandmemberKey Incomplete

func (c VrandmemberKey) Count(count int64) VrandmemberCount {
	c.cs.s = append(c.cs.s, strconv.FormatInt(count, 10))
	return (VrandmemberCount)(c)
}

func (c VrandmemberKey) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type Vrem Incomplete

func (b Builder) Vrem() (c Vrem) {
	c = Vrem{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VREM")
	return c
}

func (c Vrem) Key(key string) VremKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VremKey)(c)
}

type VremElement Incomplete

func (c VremElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VremKey Incomplete

func (c VremKey) Element(element string) VremElement {
	c.cs.s = append(c.cs.s, element)
	return (VremElement)(c)
}

type Vsetattr Incomplete

func (b Builder) Vsetattr() (c Vsetattr) {
	c = Vsetattr{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VSETATTR")
	return c
}

func (c Vsetattr) Key(key string) VsetattrKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VsetattrKey)(c)
}

type VsetattrElement Incomplete

func (c VsetattrElement) Json(json string) VsetattrJson {
	c.cs.s = append(c.cs.s, json)
	return (VsetattrJson)(c)
}

type VsetattrJson Incomplete

func (c VsetattrJson) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsetattrKey Incomplete

func (c VsetattrKey) Element(element string) VsetattrElement {
	c.cs.s = append(c.cs.s, element)
	return (VsetattrElement)(c)
}

type Vsim Incomplete

func (b Builder) Vsim() (c Vsim) {
	c = Vsim{cs: get(), ks: b.ks}
	c.cs.s = append(c.cs.s, "VSIM")
	return c
}

func (c Vsim) Key(key string) VsimKey {
	if c.ks&NoSlot == NoSlot {
		c.ks = NoSlot | slot(key)
	} else {
		c.ks = check(c.ks, slot(key))
	}
	c.cs.s = append(c.cs.s, key)
	return (VsimKey)(c)
}

type VsimCount Incomplete

func (c VsimCount) Epsilon(delta float32) VsimEpsilon {
	c.cs.s = append(c.cs.s, "EPSILON", strconv.FormatFloat(float64(delta), 'f', -1, 64))
	return (VsimEpsilon)(c)
}

func (c VsimCount) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimCount) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimCount) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimCount) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimCount) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimCount) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimEf Incomplete

func (c VsimEf) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimEf) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimEf) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimEf) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimEf) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimEpsilon Incomplete

func (c VsimEpsilon) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimEpsilon) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimEpsilon) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimEpsilon) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimEpsilon) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimEpsilon) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimFilter Incomplete

func (c VsimFilter) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimFilter) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimFilter) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimFilter) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimFilterEf Incomplete

func (c VsimFilterEf) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimFilterEf) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimFilterEf) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimKey Incomplete

func (c VsimKey) Ele() VsimQueryTypeEleEle {
	c.cs.s = append(c.cs.s, "ELE")
	return (VsimQueryTypeEleEle)(c)
}

func (c VsimKey) Fp32() VsimQueryTypeFp32Fp32 {
	c.cs.s = append(c.cs.s, "FP32")
	return (VsimQueryTypeFp32Fp32)(c)
}

func (c VsimKey) Values(num int64) VsimQueryTypeValuesValues {
	c.cs.s = append(c.cs.s, "VALUES", strconv.FormatInt(num, 10))
	return (VsimQueryTypeValuesValues)(c)
}

type VsimNothread Incomplete

func (c VsimNothread) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimQueryTypeEleEle Incomplete

func (c VsimQueryTypeEleEle) Element(element string) VsimQueryTypeEleElement {
	c.cs.s = append(c.cs.s, element)
	return (VsimQueryTypeEleElement)(c)
}

type VsimQueryTypeEleElement Incomplete

func (c VsimQueryTypeEleElement) Withscores() VsimWithscores {
	c.cs.s = append(c.cs.s, "WITHSCORES")
	return (VsimWithscores)(c)
}

func (c VsimQueryTypeEleElement) Withattribs() VsimWithattribs {
	c.cs.s = append(c.cs.s, "WITHATTRIBS")
	return (VsimWithattribs)(c)
}

func (c VsimQueryTypeEleElement) Count(num int64) VsimCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(num, 10))
	return (VsimCount)(c)
}

func (c VsimQueryTypeEleElement) Epsilon(delta float32) VsimEpsilon {
	c.cs.s = append(c.cs.s, "EPSILON", strconv.FormatFloat(float64(delta), 'f', -1, 64))
	return (VsimEpsilon)(c)
}

func (c VsimQueryTypeEleElement) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimQueryTypeEleElement) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimQueryTypeEleElement) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimQueryTypeEleElement) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimQueryTypeEleElement) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimQueryTypeEleElement) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimQueryTypeFp32Fp32 Incomplete

func (c VsimQueryTypeFp32Fp32) Vector(vector string) VsimQueryTypeFp32Vector {
	c.cs.s = append(c.cs.s, vector)
	return (VsimQueryTypeFp32Vector)(c)
}

type VsimQueryTypeFp32Vector Incomplete

func (c VsimQueryTypeFp32Vector) Withscores() VsimWithscores {
	c.cs.s = append(c.cs.s, "WITHSCORES")
	return (VsimWithscores)(c)
}

func (c VsimQueryTypeFp32Vector) Withattribs() VsimWithattribs {
	c.cs.s = append(c.cs.s, "WITHATTRIBS")
	return (VsimWithattribs)(c)
}

func (c VsimQueryTypeFp32Vector) Count(num int64) VsimCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(num, 10))
	return (VsimCount)(c)
}

func (c VsimQueryTypeFp32Vector) Epsilon(delta float32) VsimEpsilon {
	c.cs.s = append(c.cs.s, "EPSILON", strconv.FormatFloat(float64(delta), 'f', -1, 64))
	return (VsimEpsilon)(c)
}

func (c VsimQueryTypeFp32Vector) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimQueryTypeFp32Vector) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimQueryTypeFp32Vector) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimQueryTypeFp32Vector) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimQueryTypeFp32Vector) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimQueryTypeFp32Vector) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimQueryTypeValuesValues Incomplete

func (c VsimQueryTypeValuesValues) Vector(vector ...float32) VsimQueryTypeValuesVector {
	for _, n := range vector {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(float64(n), 'f', -1, 64))
	}
	return (VsimQueryTypeValuesVector)(c)
}

type VsimQueryTypeValuesVector Incomplete

func (c VsimQueryTypeValuesVector) Vector(vector ...float32) VsimQueryTypeValuesVector {
	for _, n := range vector {
		c.cs.s = append(c.cs.s, strconv.FormatFloat(float64(n), 'f', -1, 64))
	}
	return c
}

func (c VsimQueryTypeValuesVector) Withscores() VsimWithscores {
	c.cs.s = append(c.cs.s, "WITHSCORES")
	return (VsimWithscores)(c)
}

func (c VsimQueryTypeValuesVector) Withattribs() VsimWithattribs {
	c.cs.s = append(c.cs.s, "WITHATTRIBS")
	return (VsimWithattribs)(c)
}

func (c VsimQueryTypeValuesVector) Count(num int64) VsimCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(num, 10))
	return (VsimCount)(c)
}

func (c VsimQueryTypeValuesVector) Epsilon(delta float32) VsimEpsilon {
	c.cs.s = append(c.cs.s, "EPSILON", strconv.FormatFloat(float64(delta), 'f', -1, 64))
	return (VsimEpsilon)(c)
}

func (c VsimQueryTypeValuesVector) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimQueryTypeValuesVector) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimQueryTypeValuesVector) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimQueryTypeValuesVector) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimQueryTypeValuesVector) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimQueryTypeValuesVector) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimTruth Incomplete

func (c VsimTruth) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimTruth) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimWithattribs Incomplete

func (c VsimWithattribs) Count(num int64) VsimCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(num, 10))
	return (VsimCount)(c)
}

func (c VsimWithattribs) Epsilon(delta float32) VsimEpsilon {
	c.cs.s = append(c.cs.s, "EPSILON", strconv.FormatFloat(float64(delta), 'f', -1, 64))
	return (VsimEpsilon)(c)
}

func (c VsimWithattribs) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimWithattribs) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimWithattribs) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimWithattribs) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimWithattribs) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimWithattribs) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}

type VsimWithscores Incomplete

func (c VsimWithscores) Withattribs() VsimWithattribs {
	c.cs.s = append(c.cs.s, "WITHATTRIBS")
	return (VsimWithattribs)(c)
}

func (c VsimWithscores) Count(num int64) VsimCount {
	c.cs.s = append(c.cs.s, "COUNT", strconv.FormatInt(num, 10))
	return (VsimCount)(c)
}

func (c VsimWithscores) Epsilon(delta float32) VsimEpsilon {
	c.cs.s = append(c.cs.s, "EPSILON", strconv.FormatFloat(float64(delta), 'f', -1, 64))
	return (VsimEpsilon)(c)
}

func (c VsimWithscores) Ef(searchExplorationFactor int64) VsimEf {
	c.cs.s = append(c.cs.s, "EF", strconv.FormatInt(searchExplorationFactor, 10))
	return (VsimEf)(c)
}

func (c VsimWithscores) Filter(expression string) VsimFilter {
	c.cs.s = append(c.cs.s, "FILTER", expression)
	return (VsimFilter)(c)
}

func (c VsimWithscores) FilterEf(maxFilteringEffort int64) VsimFilterEf {
	c.cs.s = append(c.cs.s, "FILTER-EF", strconv.FormatInt(maxFilteringEffort, 10))
	return (VsimFilterEf)(c)
}

func (c VsimWithscores) Truth() VsimTruth {
	c.cs.s = append(c.cs.s, "TRUTH")
	return (VsimTruth)(c)
}

func (c VsimWithscores) Nothread() VsimNothread {
	c.cs.s = append(c.cs.s, "NOTHREAD")
	return (VsimNothread)(c)
}

func (c VsimWithscores) Build() Completed {
	c.cs.Build()
	return Completed{cs: c.cs, cf: uint16(c.cf), ks: c.ks}
}
