package dynamic

import "bytes"

type indentBuffer struct {
	bytes.Buffer
	indent      string
	indentCount int
	comma       bool
}

func (b *indentBuffer) start() error {
	if b.indentCount >= 0 {
		b.indentCount++
		return b.newLine(false)
	}
	return nil
}

func (b *indentBuffer) sep() error {
	if b.indentCount >= 0 {
		_, err := b.WriteString(": ")
		return err
	} else {
		return b.WriteByte(':')
	}
}

func (b *indentBuffer) end() error {
	if b.indentCount >= 0 {
		b.indentCount--
		return b.newLine(false)
	}
	return nil
}

func (b *indentBuffer) maybeNext(first *bool) error {
	if *first {
		*first = false
		return nil
	} else {
		return b.next()
	}
}

func (b *indentBuffer) next() error {
	if b.indentCount >= 0 {
		return b.newLine(b.comma)
	} else if b.comma {
		return b.WriteByte(',')
	} else {
		return b.WriteByte(' ')
	}
}

func (b *indentBuffer) newLine(comma bool) error {
	if comma {
		err := b.WriteByte(',')
		if err != nil {
			return err
		}
	}

	err := b.WriteByte('\n')
	if err != nil {
		return err
	}

	for i := 0; i < b.indentCount; i++ {
		_, err := b.WriteString(b.indent)
		if err != nil {
			return err
		}
	}
	return nil
}
