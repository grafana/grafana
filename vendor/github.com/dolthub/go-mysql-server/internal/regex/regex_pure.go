package regex

import (
	"context"
	"fmt"
	"regexp"

	"gopkg.in/src-d/go-errors.v1"
)

type Regex interface {
	SetRegexString(ctx context.Context, regexStr string, flags RegexFlags) error
	SetMatchString(ctx context.Context, matchStr string) error
	IndexOf(ctx context.Context, start int, occurrence int, endIndex bool) (int, error)
	Matches(ctx context.Context, start int, occurrence int) (bool, error)
	Replace(ctx context.Context, replacementStr string, position int, occurrence int) (string, error)
	Substring(ctx context.Context, start int, occurrence int) (string, bool, error)
	Close() error
}

var (
	ErrRegexNotYetSet = errors.NewKind("SetRegexString must be called before any other function")
	ErrMatchNotYetSet = errors.NewKind("SetMatchString must be called as there is nothing to match against")
	ErrInvalidRegex   = errors.NewKind("the given regular expression is invalid")
)

type RegexFlags uint32

const (
	RegexFlags_None                     RegexFlags = 0
	RegexFlags_Case_Insensitive         RegexFlags = 2
	RegexFlags_Comments                 RegexFlags = 4
	RegexFlags_Dot_All                  RegexFlags = 32
	RegexFlags_Literal                  RegexFlags = 16
	RegexFlags_Multiline                RegexFlags = 8
	RegexFlags_Unix_Lines               RegexFlags = 1
	RegexFlags_Unicode_Word             RegexFlags = 256
	RegexFlags_Error_On_Unknown_Escapes RegexFlags = 512
)

func CreateRegex(stringBufferInBytes uint32) Regex {
	return &privateRegex{}
}

type privateRegex struct {
	re   *regexp.Regexp
	str  string
	sset bool

	done  bool
	start int
	locs  [][]int
}

var _ Regex = (*privateRegex)(nil)

func (pr *privateRegex) SetRegexString(ctx context.Context, regexStr string, flags RegexFlags) (err error) {
	// i : RegexFlags_Case_Insensitive
	// m : RegexFlags_Multiline
	// s : RegexFlags_Dot_All
	//     RegexFlags_Unix_Lines
	var flg = "(?"
	if flags&RegexFlags_Case_Insensitive != 0 {
		flg += "i"
	}
	if flags&RegexFlags_Multiline != 0 {
		flg += "m"
	}
	if flags&RegexFlags_Dot_All != 0 {
		flg += "s"
	}
	if len(flg) > 2 {
		flg += ")"
	} else {
		flg = ""
	}

	pr.done = false
	pr.sset = false
	pr.re, err = regexp.Compile(flg + regexStr)
	if err != nil {
		return ErrInvalidRegex.New()
	}
	return nil
}

func (pr *privateRegex) SetMatchString(ctx context.Context, matchStr string) (err error) {
	if pr.re == nil {
		return ErrRegexNotYetSet.New()
	}
	pr.done = false
	pr.str = matchStr
	pr.sset = true
	return nil
}

func (pr *privateRegex) do(start int) error {
	if start < 1 {
		start = 1
	}
	if !pr.done || pr.start != start {
		if pr.re == nil {
			return ErrRegexNotYetSet.New()
		}
		if !pr.sset {
			return ErrMatchNotYetSet.New()
		}
		pr.locs = pr.re.FindAllStringIndex(pr.str[start-1:], -1)
		pr.start = start
		pr.done = true
	}
	return nil
}

func (pr *privateRegex) location(occurrence int) []int {
	occurrence--
	if occurrence < 0 {
		occurrence = 0
	}
	if len(pr.locs) < occurrence+1 {
		return nil
	}
	return pr.locs[occurrence]
}

func (pr *privateRegex) IndexOf(ctx context.Context, start int, occurrence int, endIndex bool) (int, error) {
	err := pr.do(start)
	if err != nil {
		return 0, err
	}
	loc := pr.location(occurrence)
	if loc == nil {
		return 0, nil
	}
	pos := loc[0]
	if endIndex {
		pos = loc[1]
	}
	return pos + pr.start, nil
}

func (pr *privateRegex) Matches(ctx context.Context, start int, occurrence int) (bool, error) {
	err := pr.do(start + 1) // start+1: issue #10 (https://github.com/dolthub/go-icu-regex/issues/10)
	if err != nil {
		return false, err
	}
	loc := pr.location(occurrence)
	return loc != nil, nil
}

func (pr *privateRegex) Replace(ctx context.Context, replacement string, start int, occurrence int) (string, error) {
	err := pr.do(start)
	if err != nil {
		return "", err
	}

	var locs [][]int
	if occurrence == 0 {
		locs = pr.locs
	} else {
		loc := pr.location(occurrence)
		if loc != nil {
			locs = [][]int{loc}
		}
	}
	offs := pr.start - 1
	pos := offs
	ret := []byte(pr.str[:pos])
	for _, loc := range locs {
		ret = fmt.Appendf(ret, "%s%s", pr.str[pos:loc[0]+offs], replacement)
		pos = loc[1] + offs
	}
	ret = fmt.Append(ret, pr.str[pos:])
	return string(ret), nil

	loc := pr.location(occurrence)
	if loc == nil {
		return pr.str, nil
	}
	return pr.str[:loc[0]+pr.start-1] + replacement + pr.str[loc[1]+pr.start-1:], nil
}

func (pr *privateRegex) Substring(ctx context.Context, start int, occurrence int) (string, bool, error) {
	err := pr.do(start)
	if err != nil {
		return "", false, err
	}
	loc := pr.location(occurrence)
	if loc == nil {
		return "", false, nil
	}
	return pr.str[loc[0]+pr.start-1 : loc[1]+pr.start-1], true, nil
}

func (pr *privateRegex) Close() (err error) {
	pr.re = nil
	pr.str = ""
	pr.done = false
	pr.locs = nil
	return nil
}
