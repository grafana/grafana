package fdelta

import "errors"

var zValue = [...]int{
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1, -1, -1, -1, -1, -1,
	-1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
	25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, -1, -1, -1, -1, 36,
	-1, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
	52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, -1, -1, -1, 63, -1,
}

type reader struct {
	A   []byte
	Pos uint32
}

func newReader(array []byte) *reader {
	return &reader{
		A:   array,
		Pos: 0,
	}
}

func (reader *reader) HaveBytes() bool {
	return int(reader.Pos) < len(reader.A)
}

func (reader *reader) GetByte() (byte, error) {
	if int(reader.Pos) > len(reader.A) {
		return 0, errors.New("out of bounds")
	}
	b := reader.A[reader.Pos]
	reader.Pos++
	return b, nil
}

func (reader *reader) GetChar() (rune, error) {
	b, err := reader.GetByte()
	if err != nil {
		return rune(-1), err
	}
	return rune(b), nil
}

func (reader *reader) GetInt() (uint32, error) {
	v := uint32(0)
	c := int(0)
	for reader.HaveBytes() {
		val, err := reader.GetByte()
		if err != nil {
			return 0, err
		}
		c = zValue[0x7f&val]
		if c < 0 {
			break
		}
		v = uint32((int32(v) << 6) + int32(c))
	}
	reader.Pos--
	return v, nil
}
