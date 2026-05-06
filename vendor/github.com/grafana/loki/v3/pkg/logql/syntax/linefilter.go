package syntax

import (
	"github.com/grafana/loki/v3/pkg/logql/log"
	"github.com/grafana/loki/v3/pkg/util/encoding"
)

// Binary encoding of the LineFilter
// integer is varint encoded
// strings are variable-length encoded
//
// +---------+--------------+-------------+
// | Ty      | Match        | Op          |
// +---------+--------------+-------------+
// | value   | len  | value | len | value |
// +---------+--------------+-------------+

func (lf LineFilter) Equal(o LineFilter) bool {
	return lf.Ty == o.Ty &&
		lf.Match == o.Match &&
		lf.Op == o.Op
}

func (lf LineFilter) Size() int {
	return lenUint64(uint64(lf.Ty)) +
		lenUint64(uint64(len(lf.Match))) +
		len(lf.Match) +
		lenUint64(uint64(len(lf.Op))) +
		len(lf.Op)
}

func (lf LineFilter) MarshalTo(b []byte) (int, error) {
	buf := encoding.EncWith(b[:0])
	buf.PutUvarint(int(lf.Ty))
	buf.PutUvarintStr(lf.Match)
	buf.PutUvarintStr(lf.Op)
	return len(b), nil
}

func (lf *LineFilter) Unmarshal(b []byte) error {
	buf := encoding.DecWith(b)
	lf.Ty = log.LineMatchType(buf.Uvarint())
	lf.Match = buf.UvarintStr()
	lf.Op = buf.UvarintStr()
	return nil
}

// utility copied from implementation of binary.PutUvarint()
func lenUint64(x uint64) int {
	i := 0
	for x >= 0x80 {
		x >>= 7
		i++
	}
	return i + 1
}
