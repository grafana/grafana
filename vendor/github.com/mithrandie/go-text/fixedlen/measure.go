package fixedlen

import "github.com/mithrandie/go-text"

type Measure struct {
	Encoding text.Encoding
	size     []int
}

func NewMeasure() *Measure {
	return &Measure{}
}

func (m *Measure) Measure(record []Field) {
	if m.size == nil {
		m.size = make([]int, len(record))
	}

	for i, v := range record {
		l := text.ByteSize(v.Contents, m.Encoding)
		if len(m.size) <= i {
			m.size = append(m.size, l)
		} else if m.size[i] < l {
			m.size[i] = l
		}
	}
}

func (m *Measure) GeneratePositions() DelimiterPositions {
	p := make([]int, 0, len(m.size))

	pos := 0
	for _, v := range m.size {
		pos = pos + v
		p = append(p, pos)
	}

	return p
}
