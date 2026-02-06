package fixedlen

import (
	"bufio"
	"bytes"
	"io"
	"unicode"

	"github.com/mithrandie/go-text"
)

const OutOfLine = -1

type PositionStatus int

const (
	PositionOut PositionStatus = iota
	PositionInValue
	PositionEndOfValue
	PositionInSpace
	PositionEndOfSpace
)

type Space struct {
	Start int
	End   int
}

type RecordSpaces []Space

func (r RecordSpaces) NextEnd(pos int) int {
	for _, s := range r {
		if pos <= s.End {
			return s.End
		}
	}
	return OutOfLine
}

func (r RecordSpaces) PrevStart(pos int) int {
	start := OutOfLine
	for _, s := range r {
		if pos < s.Start {
			break
		}
		start = s.Start
	}
	return start
}

func (r RecordSpaces) LineLen() int {
	l := 0
	if 0 < len(r) && r[len(r)-1].End == OutOfLine {
		l = r[len(r)-1].Start - 1
	}
	return l
}

func (r RecordSpaces) Status(pos int) PositionStatus {
	for _, s := range r {
		switch {
		case pos == s.Start-1:
			return PositionEndOfValue
		case pos < s.Start:
			return PositionInValue
		case pos == s.End:
			return PositionEndOfSpace
		case s.Start <= pos && pos < s.End:
			return PositionInSpace
		}
	}
	return PositionOut
}

type TableSpaces []RecordSpaces

func (t TableSpaces) InHeaderValue(pos int) bool {
	return t[0].Status(pos) == PositionInValue && t[0].Status(pos+1) == PositionInValue
}

func (t TableSpaces) NextSpaceEnd(pos int) int {
	min := OutOfLine
	for _, rs := range t {
		if end := rs.NextEnd(pos); end != OutOfLine {
			if min == OutOfLine || end < min {
				min = end
			}
		}
	}
	return min
}

func (t TableSpaces) PrevSpaceStart(pos int) int {
	max := OutOfLine
	for _, rs := range t {
		if start := rs.PrevStart(pos); start != OutOfLine {
			if max < start {
				max = start
			}
		}
	}
	return max
}

func (t TableSpaces) TableLen() int {
	l := 0
	for _, rs := range t {
		if ll := rs.LineLen(); l <= ll {
			l = ll
		}
	}
	return l
}

func (t TableSpaces) CountColumnStatus(pos int) (inValue int, endOfValue int, inSpace int, endOfSpace int, endOfLine int, outOfLine int) {
	for _, rs := range t {
		switch rs.Status(pos) {
		case PositionEndOfValue:
			endOfValue++
			if rs.Status(pos+1) == PositionOut {
				endOfLine++
			}
		case PositionInValue:
			inValue++
		case PositionEndOfSpace:
			endOfSpace++
		case PositionInSpace:
			inSpace++
		case PositionOut:
			outOfLine++
		}
	}
	return
}

type Delimiter struct {
	NoHeader bool
	Encoding text.Encoding

	reader *bufio.Reader

	lineBuf         bytes.Buffer
	spacesPerRecord int

	tableSpaces TableSpaces
	positions   DelimiterPositions
}

func NewDelimiter(r io.Reader, enc text.Encoding) (*Delimiter, error) {
	decoder, err := text.GetTransformDecoder(r, enc)
	if err != nil {
		return nil, err
	}

	return &Delimiter{
		Encoding:        enc,
		reader:          bufio.NewReader(decoder),
		spacesPerRecord: 5,
	}, nil
}

func (d *Delimiter) Delimit() ([]int, error) {
	d.tableSpaces = make(TableSpaces, 0, 100)

	for {
		recordSpaces, err := d.searchSpacesInLine()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		if len(recordSpaces) < 1 {
			continue
		}
		d.tableSpaces = append(d.tableSpaces, recordSpaces)
	}

	d.positions = make([]int, 0, d.spacesPerRecord)

	linePos := 1
	for {
		nextEnd := d.tableSpaces.NextSpaceEnd(linePos)
		if nextEnd == OutOfLine {
			d.positions = append(d.positions, d.tableSpaces.TableLen())
			break
		}

		d.searchPosition(nextEnd)
		linePos = nextEnd + 1
	}

	return d.positions, nil
}

func (d *Delimiter) searchPosition(end int) {
	begin := d.tableSpaces.PrevSpaceStart(end) - 1
	if begin <= d.positions.Last() {
		endInValue, _, _, _, _, _ := d.tableSpaces.CountColumnStatus(end)
		if (endInValue) < 1 {
			d.positions = append(d.positions, end)
		}
		return
	}

	if !d.NoHeader && d.tableSpaces.InHeaderValue(begin) {
		return
	}

	inValue, endOfValue, inSpace, endOfSpace, endOfLine, outOfLine := d.tableSpaces.CountColumnStatus(begin)

	if ((inValue+endOfValue+inSpace+endOfSpace-endOfLine)/9)+1 < (endOfLine + outOfLine) {
		return
	}

	if ((endOfValue+inSpace+endOfSpace)/9)+1 < inValue {
		return
	}

	if (inValue) < 1 {
		d.positions = append(d.positions, begin)
		return
	}

	endInValue, _, _, endOfEndSpace, _, _ := d.tableSpaces.CountColumnStatus(end)

	if (endInValue) < 1 {
		d.positions = append(d.positions, end)
		return
	}

	if endOfEndSpace < endOfValue {
		d.positions = append(d.positions, begin)
	} else {
		d.positions = append(d.positions, end)
	}
}

func (d *Delimiter) searchSpacesInLine() (RecordSpaces, error) {
	d.lineBuf.Reset()

	for {
		line, isPrefix, err := d.reader.ReadLine()
		if err != nil {
			return nil, err
		}

		d.lineBuf.Write(line)
		if !isPrefix {
			break
		}
	}

	spaces := make(RecordSpaces, 0, d.spacesPerRecord)
	linePos := 1
	startPos := 1
	inSpace := false
	for {
		c, _, err := d.lineBuf.ReadRune()
		if err != nil {
			if err == io.EOF {
				if 0 < startPos && !inSpace {
					startPos = linePos
				}
				break
			}
			return nil, err
		}

		if unicode.IsSpace(c) {
			if !inSpace {
				inSpace = true
				startPos = linePos
			}
		} else {
			if inSpace {
				inSpace = false
				if 1 < startPos {
					spaces = append(spaces, Space{
						Start: startPos,
						End:   linePos - 1,
					})
				}
			}
		}

		linePos = linePos + text.RuneByteSize(c, d.Encoding)
	}

	if 1 < startPos {
		spaces = append(spaces, Space{
			Start: startPos,
			End:   OutOfLine,
		})
	}
	if d.spacesPerRecord < len(spaces) {
		d.spacesPerRecord = len(spaces)
	}

	return spaces, nil
}
