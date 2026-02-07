package stats

import (
	"strconv"
)

type intParser struct {
	err error
}

func (p *intParser) ParseInt(s string, base int) int {
	if p.err != nil {
		return 0
	}
	var n int64
	n, p.err = strconv.ParseInt(s, base, 0)
	return int(n)
}

func (p *intParser) ParseInt64(s string, base int) int64 {
	if p.err != nil {
		return 0
	}
	var n int64
	n, p.err = strconv.ParseInt(s, base, 64)
	return n
}

func (p *intParser) ParseUint64(s string, base int) uint64 {
	if p.err != nil {
		return 0
	}
	var n uint64
	n, p.err = strconv.ParseUint(s, base, 64)
	return n
}

func (p *intParser) Err() error {
	return p.err
}
