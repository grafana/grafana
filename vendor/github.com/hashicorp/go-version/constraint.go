// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package version

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Constraint represents a single constraint for a version, such as
// ">= 1.0".
type Constraint struct {
	f        constraintFunc
	op       operator
	check    *Version
	original string
}

func (c *Constraint) Equals(con *Constraint) bool {
	return c.op == con.op && c.check.Equal(con.check)
}

// Constraints is a slice of constraints. We make a custom type so that
// we can add methods to it.
type Constraints []*Constraint

type constraintFunc func(v, c *Version) bool

var constraintOperators map[string]constraintOperation

type constraintOperation struct {
	op operator
	f  constraintFunc
}

var constraintRegexp *regexp.Regexp

func init() {
	constraintOperators = map[string]constraintOperation{
		"":   {op: equal, f: constraintEqual},
		"=":  {op: equal, f: constraintEqual},
		"!=": {op: notEqual, f: constraintNotEqual},
		">":  {op: greaterThan, f: constraintGreaterThan},
		"<":  {op: lessThan, f: constraintLessThan},
		">=": {op: greaterThanEqual, f: constraintGreaterThanEqual},
		"<=": {op: lessThanEqual, f: constraintLessThanEqual},
		"~>": {op: pessimistic, f: constraintPessimistic},
	}

	ops := make([]string, 0, len(constraintOperators))
	for k := range constraintOperators {
		ops = append(ops, regexp.QuoteMeta(k))
	}

	constraintRegexp = regexp.MustCompile(fmt.Sprintf(
		`^\s*(%s)\s*(%s)\s*$`,
		strings.Join(ops, "|"),
		VersionRegexpRaw))
}

// NewConstraint will parse one or more constraints from the given
// constraint string. The string must be a comma-separated list of
// constraints.
func NewConstraint(v string) (Constraints, error) {
	vs := strings.Split(v, ",")
	result := make([]*Constraint, len(vs))
	for i, single := range vs {
		c, err := parseSingle(single)
		if err != nil {
			return nil, err
		}

		result[i] = c
	}

	return Constraints(result), nil
}

// MustConstraints is a helper that wraps a call to a function
// returning (Constraints, error) and panics if error is non-nil.
func MustConstraints(c Constraints, err error) Constraints {
	if err != nil {
		panic(err)
	}

	return c
}

// Check tests if a version satisfies all the constraints.
func (cs Constraints) Check(v *Version) bool {
	for _, c := range cs {
		if !c.Check(v) {
			return false
		}
	}

	return true
}

// Equals compares Constraints with other Constraints
// for equality. This may not represent logical equivalence
// of compared constraints.
// e.g. even though '>0.1,>0.2' is logically equivalent
// to '>0.2' it is *NOT* treated as equal.
//
// Missing operator is treated as equal to '=', whitespaces
// are ignored and constraints are sorted before comaparison.
func (cs Constraints) Equals(c Constraints) bool {
	if len(cs) != len(c) {
		return false
	}

	// make copies to retain order of the original slices
	left := make(Constraints, len(cs))
	copy(left, cs)
	sort.Stable(left)
	right := make(Constraints, len(c))
	copy(right, c)
	sort.Stable(right)

	// compare sorted slices
	for i, con := range left {
		if !con.Equals(right[i]) {
			return false
		}
	}

	return true
}

func (cs Constraints) Len() int {
	return len(cs)
}

func (cs Constraints) Less(i, j int) bool {
	if cs[i].op < cs[j].op {
		return true
	}
	if cs[i].op > cs[j].op {
		return false
	}

	return cs[i].check.LessThan(cs[j].check)
}

func (cs Constraints) Swap(i, j int) {
	cs[i], cs[j] = cs[j], cs[i]
}

// Returns the string format of the constraints
func (cs Constraints) String() string {
	csStr := make([]string, len(cs))
	for i, c := range cs {
		csStr[i] = c.String()
	}

	return strings.Join(csStr, ",")
}

// Check tests if a constraint is validated by the given version.
func (c *Constraint) Check(v *Version) bool {
	return c.f(v, c.check)
}

// Prerelease returns true if the version underlying this constraint
// contains a prerelease field.
func (c *Constraint) Prerelease() bool {
	return len(c.check.Prerelease()) > 0
}

func (c *Constraint) String() string {
	return c.original
}

func parseSingle(v string) (*Constraint, error) {
	matches := constraintRegexp.FindStringSubmatch(v)
	if matches == nil {
		return nil, fmt.Errorf("Malformed constraint: %s", v)
	}

	check, err := NewVersion(matches[2])
	if err != nil {
		return nil, err
	}

	cop := constraintOperators[matches[1]]

	return &Constraint{
		f:        cop.f,
		op:       cop.op,
		check:    check,
		original: v,
	}, nil
}

func prereleaseCheck(v, c *Version) bool {
	switch vPre, cPre := v.Prerelease() != "", c.Prerelease() != ""; {
	case cPre && vPre:
		// A constraint with a pre-release can only match a pre-release version
		// with the same base segments.
		return v.equalSegments(c)

	case !cPre && vPre:
		// A constraint without a pre-release can only match a version without a
		// pre-release.
		return false

	case cPre && !vPre:
		// OK, except with the pessimistic operator
	case !cPre && !vPre:
		// OK
	}
	return true
}

//-------------------------------------------------------------------
// Constraint functions
//-------------------------------------------------------------------

type operator rune

const (
	equal            operator = '='
	notEqual         operator = '≠'
	greaterThan      operator = '>'
	lessThan         operator = '<'
	greaterThanEqual operator = '≥'
	lessThanEqual    operator = '≤'
	pessimistic      operator = '~'
)

func constraintEqual(v, c *Version) bool {
	return v.Equal(c)
}

func constraintNotEqual(v, c *Version) bool {
	return !v.Equal(c)
}

func constraintGreaterThan(v, c *Version) bool {
	return prereleaseCheck(v, c) && v.Compare(c) == 1
}

func constraintLessThan(v, c *Version) bool {
	return prereleaseCheck(v, c) && v.Compare(c) == -1
}

func constraintGreaterThanEqual(v, c *Version) bool {
	return prereleaseCheck(v, c) && v.Compare(c) >= 0
}

func constraintLessThanEqual(v, c *Version) bool {
	return prereleaseCheck(v, c) && v.Compare(c) <= 0
}

func constraintPessimistic(v, c *Version) bool {
	// Using a pessimistic constraint with a pre-release, restricts versions to pre-releases
	if !prereleaseCheck(v, c) || (c.Prerelease() != "" && v.Prerelease() == "") {
		return false
	}

	// If the version being checked is naturally less than the constraint, then there
	// is no way for the version to be valid against the constraint
	if v.LessThan(c) {
		return false
	}
	// We'll use this more than once, so grab the length now so it's a little cleaner
	// to write the later checks
	cs := len(c.segments)

	// If the version being checked has less specificity than the constraint, then there
	// is no way for the version to be valid against the constraint
	if cs > len(v.segments) {
		return false
	}

	// Check the segments in the constraint against those in the version. If the version
	// being checked, at any point, does not have the same values in each index of the
	// constraints segments, then it cannot be valid against the constraint.
	for i := 0; i < c.si-1; i++ {
		if v.segments[i] != c.segments[i] {
			return false
		}
	}

	// Check the last part of the segment in the constraint. If the version segment at
	// this index is less than the constraints segment at this index, then it cannot
	// be valid against the constraint
	if c.segments[cs-1] > v.segments[cs-1] {
		return false
	}

	// If nothing has rejected the version by now, it's valid
	return true
}
