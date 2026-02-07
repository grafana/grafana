package sql

import (
	"fmt"
	"strings"
)

// EquivSets maintains column equivalency sets created
// by WHERE a = b filters.
type EquivSets struct {
	sets []ColSet
}

// Add adds a new equivalence set, compacting any intersections
// with existing sets.
func (e *EquivSets) Add(cols ColSet) {
	i := 0
	for i < len(e.sets) {
		set := e.sets[i]
		if cols.Intersects(set) {
			cols = cols.Union(set)
			e.sets[i] = e.sets[len(e.sets)-1]
			e.sets = e.sets[:len(e.sets)-1]
		} else {
			i++
		}
	}
	e.sets = append(e.sets, cols)
}

func (e *EquivSets) Len() int {
	if e == nil {
		return 0
	}
	return len(e.sets)
}

func (e *EquivSets) Sets() []ColSet {
	if e == nil {
		return nil
	}
	return e.sets
}

func (e *EquivSets) String() string {
	if e == nil {
		return "equiv()"
	}
	b := strings.Builder{}
	sep := ""
	for i, set := range e.sets {
		b.WriteString(fmt.Sprintf("%sequiv%s", sep, set))
		if i == 0 {
			sep = "; "
		}
	}
	return b.String()
}

// Key maintains a strict or lax dependency
type Key struct {
	cols    ColSet
	allCols ColSet
	strict  bool
}

func (k *Key) Empty() bool {
	return k.cols.Len() == 0
}

func (k *Key) implies(other Key) bool {
	if k.cols.SubsetOf(other.cols) {
		return k.strict || !other.strict
	}
	return false
}

// FuncDepSet encodes functional dependencies for a relational
// expression. Common uses for functional dependencies:
//   - Do a set of equality columns comprise a strict key? (lookup joins)
//   - Is there a strict key for a relation? (decorrelate scopes)
//   - What are the set of equivalent filters? (join planning)
//   - Do a set of grouping columns constitute a strict key
//     (only_full_group_by)
//
// The docs here provide a summary of how functional dependencies work:
// - https://github.com/cockroachdb/cockroach/blob/5a6aa768cd945118e795d1086ba6f6365f6d1284/pkg/sql/opt/props/func_dep.go#L420
//
// This object expects fields to be set in the following order:
// - notNull: what columns are non-nullable?
// - consts: what columns are constant?
// - equivs: transitive closure of column equivalence
// - keys: primary and secondary keys, simplified
//
// We use an abbreviated form to represent functional dependencies.
// Normally, we would encode determinant and dependency sets like
// (det)-->(dep). I only keep track of determinant sets, that are
// assumed to represent keys into the entire relation. This works
// for simple cases where fractional functional dependencies can
// be discarded. The limitation is clear when you consider joins,
// whose FD sets can include keys that only implicitly determine
// a fraction of the total input set. The first key always determines
// the entire relation, which seems good enough for many cases.
// Maintaining partials sets also requires much less bookkeeping.
//
// TODO: We used to not track dependency sets and only add keys that
// determined the entire relation. One observed downside of that approach
// is that left joins fail to convert equivalencies on the null-extended
// side to lax functional dependencies. For example, in the query below,
// the left join loses (a) == (m) because (m) can now be NULL:
//
// SELECT * from adbcd LEFT_JOIN mnpq WHERE a = m
//
// But we could maintain (m)~~>(n), which higher-level null enforcement
// (ex: GROUPING) can reclaim as equivalence. Although we now track partial
// dependency sets, this may still not be supported.
type FuncDepSet struct {
	// all columns in this relation
	all ColSet
	// non-null columns for relation
	notNull ColSet
	// tracks in-scope constants
	consts ColSet
	// tracks in-scope equivalent closure
	equivs *EquivSets
	// keys includes the set of primary and secondary keys
	// accumulated in the relation. The first key is the best
	// key we have seen so far, where strict > lax and shorter
	// is better.
	keys []Key
}

// StrictKey returns a set of columns that act as a row identifier.
// No two rows can have the same identifier, like (b) below. Unique keys
// are only strict if all columns are non-nullable. See LaxKey() for
// explanation.
//
//	b  c
//	----
//	1  1
//	2  1
func (f *FuncDepSet) StrictKey() (ColSet, bool) {
	if len(f.keys) == 0 || !f.keys[0].strict {
		return ColSet{}, false
	}
	return f.keys[0].cols, true
}

// LaxKey returns a set of columns that act as a null-safe row identifier.
// For example, (b) below is a lax-key for (b,c), but not a strict key.
// A strict key treats NULLs as equal to one-another. A lax key permits
// the general NULL != NULL behavior. Filtering nulls from a relation can
// promote a lax key into a strict key.
//
//	b     c
//	----------
//	NULL  1
//	NULL  NULL
func (f *FuncDepSet) LaxKey() (ColSet, bool) {
	if len(f.keys) == 0 || f.keys[0].strict {
		return ColSet{}, false
	}
	return f.keys[0].cols, true
}

func (f *FuncDepSet) All() ColSet {
	return f.all
}

func (f *FuncDepSet) Empty() bool {
	return f.all.Empty()
}

func (f *FuncDepSet) NotNull() ColSet {
	return f.notNull
}

func (f *FuncDepSet) Equiv() *EquivSets {
	return f.equivs
}

func (f *FuncDepSet) CopyKeys() []Key {
	ret := make([]Key, len(f.keys))
	copy(ret, f.keys)
	return ret
}

func (f *FuncDepSet) HasMax1Row() bool {
	if len(f.keys) == 0 {
		return false
	}
	key := f.keys[0]
	return key.strict && key.Empty()
}

func (f *FuncDepSet) String() string {
	b := strings.Builder{}
	sep := ""
	if len(f.keys) > 0 {
		key := f.keys[0]
		lax := ""
		if !key.strict {
			lax = "lax-"
		}
		b.WriteString(fmt.Sprintf("%skey%s", lax, key.cols))
		sep = "; "
	}
	if !f.consts.Empty() {
		b.WriteString(fmt.Sprintf("%sconstant%s", sep, f.consts))
		sep = "; "
	}
	if f.equivs.Len() > 0 {
		b.WriteString(fmt.Sprintf("%s%s", sep, f.equivs))
		sep = "; "
	}
	if len(f.keys) < 2 {
		return b.String()
	}
	for _, k := range f.keys[1:] {
		var cols string
		if k.allCols == f.all {
			cols = k.cols.String()
		} else {
			cols = fmt.Sprintf("%s/%s", k.cols, k.allCols)
		}
		if k.strict {
			b.WriteString(fmt.Sprintf("%sfd%s", sep, cols))
		} else {
			b.WriteString(fmt.Sprintf("%slax-fd%s", sep, cols))
		}
		sep = "; "
	}
	return b.String()
}

func (f *FuncDepSet) Constants() ColSet {
	return f.consts
}

func (f *FuncDepSet) EquivalenceClosure(cols ColSet) ColSet {
	for _, set := range f.equivs.Sets() {
		if set.Intersects(cols) {
			cols = cols.Union(set)
		}
	}
	return cols
}

func (f *FuncDepSet) AddNotNullable(cols ColSet) {
	cols = f.simplifyCols(cols, nil)
	f.notNull = f.notNull.Union(cols)
}

func (f *FuncDepSet) AddConstants(cols ColSet) {
	f.consts = f.consts.Union(cols)
}

func (f *FuncDepSet) AddEquiv(i, j ColumnId) {
	cols := NewColSet(i, j)
	if f.equivs == nil {
		f.equivs = &EquivSets{}
	}
	f.AddEquivSet(cols)
}

func (f *FuncDepSet) AddEquivSet(cols ColSet) {
	if f.equivs == nil {
		f.equivs = &EquivSets{}
	}
	f.equivs.Add(cols)
	for _, set := range f.equivs.Sets() {
		// if one col in equiv set is constant, rest are too
		if set.Intersects(f.consts) {
			f.AddConstants(set)
		}
	}
}

func (f *FuncDepSet) AddKey(k Key) {
	switch k.strict {
	case true:
		f.AddStrictKey(k.cols)
	case false:
		f.AddLaxKey(k.cols)
	}
}

func (f *FuncDepSet) AddStrictKey(cols ColSet) {
	cols = f.simplifyCols(cols, nil)
	newKey := Key{cols: cols, allCols: f.all, strict: true}
	for i, key := range f.keys {
		if key.implies(newKey) {
			return
		}
		if newKey.implies(key) {
			f.keys[i] = newKey
			return
		}
	}
	f.keys = append(f.keys, newKey)

	if len(f.keys) > 1 {
		lead := f.keys[0]
		lead.cols = f.simplifyCols(lead.cols, nil)
		if !lead.strict || lead.strict && lead.cols.Len() > cols.Len() {
			// strict > lax
			// short > long
			f.keys[0], f.keys[len(f.keys)-1] = f.keys[len(f.keys)-1], lead
		}

	}
}

func (f *FuncDepSet) AddLaxKey(cols ColSet) {
	nullableCols := cols.Difference(f.notNull)
	if nullableCols.Empty() {
		f.AddStrictKey(cols)
	}

	cols = f.simplifyCols(cols, nil)
	newKey := Key{cols: cols, allCols: f.all, strict: false}
	for i, key := range f.keys {
		if key.implies(newKey) {
			return
		}
		if newKey.implies(key) {
			f.keys[i] = newKey
			return
		}
	}
	f.keys = append(f.keys, newKey)
	if len(f.keys) > 1 && !f.keys[0].strict {
		// only try to improve if lax key
		lead := f.keys[0]
		lead.cols = f.simplifyCols(lead.cols, nil)
		if lead.cols.Len() > cols.Len() {
			f.keys[0], f.keys[len(f.keys)-1] = f.keys[len(f.keys)-1], lead
		}
	}
}

// simplifyCols uses equivalence and constant sets to minimize
// a key set
func (f *FuncDepSet) simplifyCols(key ColSet, subKeys []Key) ColSet {
	if key.Empty() {
		return key
	}
	// for each column, attempt to remove and verify
	// the remaining set does not determine it
	// i.e. check if removedCol is in closure of rest of set
	ret := key.Copy()
	var plucked ColSet
	for i, ok := key.Next(1); ok; i, ok = key.Next(i + 1) {
		ret.Remove(i)
		plucked.Add(i)
		notConst := !f.consts.Contains(i)
		if notConst && !f.inClosureOf(plucked, ret, subKeys) {
			// plucked is novel
			ret.Add(i)
		}
		plucked.Remove(i)
	}
	return ret
}

// ColsAreStrictKey returns true if the set of columns acts
// as a primary key into a relation.
func (f *FuncDepSet) ColsAreStrictKey(cols ColSet) bool {
	if len(f.keys) == 0 {
		return false
	}
	return f.inClosureOf(f.keys[0].cols, cols, nil)
}

// inClosureOf returns whether all the columns in `candidate` are uniquely determined by the columns in `source`.
// It computes this by checking whether `candidate` is contained within the transitive closure of `source`, over
// both equivalence rules (which state two columns must have the same value) and the functional dependencies
// specified by `fdsKeys` (each of which states that one or more columns determine one of more other columns.)
// Note that callers that don't want to consider functional dependencies (such as outer joins) can pass a nil value
// to `fdsKeys`.
func (f *FuncDepSet) inClosureOf(candidate, source ColSet, fdsKeys []Key) bool {
	if candidate.SubsetOf(source) {
		return true
	}
	var oldClosure ColSet
	newClosure := source.Copy()
	for !oldClosure.Equals(newClosure) {
		oldClosure = newClosure.Copy()
		for _, set := range f.equivs.Sets() {
			if set.Intersects(newClosure) {
				newClosure = newClosure.Union(set)
			}
		}
		for _, key := range fdsKeys {
			if key.cols.SubsetOf(newClosure) {
				newClosure = newClosure.Union(key.allCols)
			}
		}
	}
	if candidate.SubsetOf(newClosure) {
		return true
	}
	return false
}

func NewTablescanFDs(all ColSet, strict []ColSet, lax []ColSet, notNull ColSet) *FuncDepSet {
	ret := &FuncDepSet{all: all}
	ret.AddNotNullable(notNull)
	for _, key := range strict {
		ret.AddStrictKey(key)
	}
	for _, key := range lax {
		ret.AddLaxKey(key)
	}
	return ret
}

// NewCrossJoinFDs makes functional dependencies for a cross join
// between two relations.
func NewCrossJoinFDs(left, right *FuncDepSet) *FuncDepSet {
	ret := &FuncDepSet{all: left.all.Union(right.all)}
	ret.AddNotNullable(left.notNull)
	ret.AddNotNullable(right.notNull)
	ret.AddConstants(left.consts)
	ret.AddConstants(right.consts)
	for _, set := range left.equivs.Sets() {
		ret.AddEquivSet(set)
	}
	for _, set := range right.equivs.Sets() {
		ret.AddEquivSet(set)
	}
	// concatenate lead key, append others
	var lKey, rKey Key
	if len(left.keys) > 0 {
		lKey = left.keys[0]
	}
	if len(right.keys) > 0 {
		rKey = right.keys[0]
	}
	var jKey Key
	if lKey.Empty() && rKey.Empty() {
		return ret
	} else if lKey.Empty() {
		jKey = rKey
	} else if rKey.Empty() {
		jKey = lKey
	} else {
		jKey.cols = lKey.cols.Union(rKey.cols)
		jKey.allCols = ret.all
		jKey.strict = lKey.strict && rKey.strict
	}
	ret.keys = append(ret.keys, jKey)
	ret.keys = append(ret.keys, left.keys...)
	ret.keys = append(ret.keys, right.keys...)
	return ret
}

// NewInnerJoinFDs makes functional dependencies for an inner join
// between two relations.
func NewInnerJoinFDs(left, right *FuncDepSet, filters [][2]ColumnId) *FuncDepSet {
	ret := &FuncDepSet{all: left.all.Union(right.all)}
	ret.AddNotNullable(left.notNull)
	ret.AddNotNullable(right.notNull)
	if left.HasMax1Row() {
		ret.AddConstants(left.all)
	} else {
		ret.AddConstants(left.consts)
	}
	if right.HasMax1Row() {
		ret.AddConstants(right.all)
	} else {
		ret.AddConstants(right.consts)
	}
	for _, set := range left.Equiv().Sets() {
		ret.AddEquivSet(set)
	}
	for _, set := range right.Equiv().Sets() {
		ret.AddEquivSet(set)
	}
	for _, f := range filters {
		ret.AddEquiv(f[0], f[1])
	}
	leftKeys := left.CopyKeys()
	rightKeys := right.CopyKeys()
	// concatenate lead key, append others
	var lKey, rKey Key
	if len(leftKeys) > 0 {
		lKey = leftKeys[0]
	}
	if len(rightKeys) > 0 {
		rKey = rightKeys[0]
	}
	var jKey Key
	if lKey.Empty() && rKey.Empty() {
		ret.AddKey(lKey)
		return ret
	} else if lKey.Empty() {
		jKey = rKey
	} else if rKey.Empty() {
		jKey = lKey
	} else {
		var subKeys []Key
		subKeys = append(subKeys, leftKeys...)
		subKeys = append(subKeys, rightKeys...)
		jKey.cols = ret.simplifyCols(lKey.cols.Union(rKey.cols), subKeys)
		jKey.allCols = ret.all
		jKey.strict = lKey.strict && rKey.strict
	}
	ret.AddKey(jKey)
	for _, k := range leftKeys {
		ret.keys = append(ret.keys, k)
	}
	for _, k := range rightKeys {
		ret.keys = append(ret.keys, k)
	}

	return ret
}

func NewFilterFDs(fds *FuncDepSet, notNull ColSet, constant ColSet, equiv [][2]ColumnId) *FuncDepSet {
	ret := &FuncDepSet{all: fds.All()}
	ret.AddNotNullable(fds.notNull.Union(notNull))
	ret.AddConstants(fds.Constants().Union(constant))
	for _, e := range fds.equivs.Sets() {
		ret.AddEquivSet(e)
	}
	for _, e := range equiv {
		ret.AddEquiv(e[0], e[1])
	}
	for _, k := range fds.keys {
		ret.AddKey(k)
	}
	return ret
}

func NewLookupFDs(fds *FuncDepSet, idxCols ColSet, notNull ColSet, constants ColSet, equiv *EquivSets) *FuncDepSet {
	ret := &FuncDepSet{all: fds.All()}
	ret.AddNotNullable(fds.notNull.Union(notNull))
	ret.AddConstants(fds.Constants().Union(constants))
	for _, e := range fds.equivs.Sets() {
		ret.AddEquivSet(e)
	}
	for _, set := range equiv.Sets() {
		ret.AddEquivSet(set)
	}
	ret.AddLaxKey(idxCols)
	return ret
}

// NewProjectFDs returns a new functional dependency set projecting
// a subset of cols.
func NewProjectFDs(fds *FuncDepSet, cols ColSet, distinct bool) *FuncDepSet {
	ret := &FuncDepSet{all: cols}
	ret.AddNotNullable(fds.notNull.Intersection(cols))

	if keptConst := fds.consts.Intersection(cols); !keptConst.Empty() {
		ret.AddConstants(keptConst)
	}

	if distinct {
		ret.AddStrictKey(cols)
	}

	// mapping deleted->equiv helps us keep keys whose removed cols
	// have projected equivalents
	equivMapping := make(map[ColumnId]ColumnId)
	for _, set := range fds.equivs.Sets() {
		if set.SubsetOf(cols) {
			if ret.equivs == nil {
				ret.equivs = &EquivSets{}
			}
			ret.AddEquivSet(set)
		} else {
			toKeep := set.Intersection(cols)
			if toKeep.Empty() {
				continue
			}
			if toRemove := set.Difference(cols); !toRemove.Empty() {
				for i, ok := toRemove.Next(1); ok; i, ok = toRemove.Next(i + 1) {
					equivMapping[i], _ = toKeep.Next(1)
				}
			}
			if toKeep.Len() > 1 {
				ret.AddEquivSet(toKeep)
			}
		}
	}

	for _, key := range fds.keys {
		if key.cols.SubsetOf(cols) {
			ret.AddKey(key)
			continue
		}
		toRemove := key.cols.Difference(cols)
		newKey := key.cols.Intersection(cols)
		allOk := true
		var replace ColumnId
		for i, ok := toRemove.Next(1); ok; i, ok = toRemove.Next(i + 1) {
			replace, allOk = equivMapping[i]
			if !allOk {
				break
			}
			newKey.Add(replace)
		}
		if allOk {
			ret.AddKey(Key{strict: key.strict, allCols: ret.all, cols: newKey})
		}
	}

	return ret
}

func NewMax1RowFDs(cols, notNull ColSet) *FuncDepSet {
	ret := &FuncDepSet{all: cols, consts: cols, notNull: notNull}
	ret.AddStrictKey(ColSet{})
	return ret
}

func NewLeftJoinFDs(left, right *FuncDepSet, filters [][2]ColumnId) *FuncDepSet {
	leftKey, leftStrict := left.StrictKey()
	leftColsAreInnerJoinKey := false
	if leftStrict {
		// leftcols are strict key
		j := NewInnerJoinFDs(left, right, filters)
		leftColsAreInnerJoinKey = j.inClosureOf(j.keys[0].cols, left.all, nil)
	}

	leftKeys := left.CopyKeys()
	rightKeys := right.CopyKeys()
	var lKey, rKey Key
	if len(leftKeys) > 0 {
		lKey = leftKeys[0]
		leftKeys = leftKeys[1:]
	}
	if len(rightKeys) > 0 {
		rKey = rightKeys[0]
		rightKeys = rightKeys[1:]
	}
	var jKey Key
	if lKey.Empty() && rKey.Empty() {
		jKey = lKey
	} else if lKey.Empty() {
		jKey = rKey
	} else if rKey.Empty() {
		jKey = lKey
	} else {
		jKey.cols = lKey.cols.Union(rKey.cols)
		jKey.strict = lKey.strict && rKey.strict
	}

	ret := &FuncDepSet{all: left.all.Union(right.all)}
	// left constants and equiv are safe
	ret.AddNotNullable(left.notNull)
	ret.AddConstants(left.consts)
	if left.HasMax1Row() {
		var leftConst ColSet
		// leftCols in filter are constant
		for i := range filters {
			col := filters[i][0]
			leftConst.Add(col)
		}
		ret.AddConstants(leftConst)
	}
	// only left equiv holds
	for _, equiv := range left.equivs.Sets() {
		ret.AddEquivSet(equiv)
	}

	if leftStrict && leftColsAreInnerJoinKey {
		strictKey := Key{strict: true, allCols: ret.all, cols: leftKey}
		ret.keys = append(ret.keys, strictKey)
		if !strictKey.implies(rKey) {
			ret.keys = append(ret.keys, rKey)
		}
	} else {
		ret.keys = append(ret.keys, jKey)
	}

	// no filter equivs are valid
	// TODO if right columns are non-nullable in ON filter, equivs hold
	// technically we could do (r)~~>(l), but is this useful?

	// right-side keys become lax unless all non-nullable in original
	for _, key := range rightKeys {
		if !key.cols.SubsetOf(right.notNull) {
			key.strict = false
		}
		if !ret.keys[0].implies(key) {
			ret.keys = append(ret.keys, key)
		}
	}
	for _, key := range leftKeys {
		if !ret.keys[0].implies(key) {
			ret.keys = append(ret.keys, key)
		}
	}
	// key w cols from both sides discarded unless strict key for whole rel
	// TODO max1Row condition
	return ret
}
