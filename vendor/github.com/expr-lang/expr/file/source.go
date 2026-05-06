package file

import "strings"

type Source struct {
	raw string
}

func NewSource(contents string) Source {
	return Source{
		raw: contents,
	}
}

func (s Source) String() string {
	return s.raw
}

func (s Source) Snippet(line int) (string, bool) {
	if s.raw == "" {
		return "", false
	}
	var start int
	for i := 1; i < line; i++ {
		pos := strings.IndexByte(s.raw[start:], '\n')
		if pos < 0 {
			return "", false
		}
		start += pos + 1
	}
	end := start + strings.IndexByte(s.raw[start:], '\n')
	if end < start {
		end = len(s.raw)
	}
	return s.raw[start:end], true
}
