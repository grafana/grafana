package fdelta

var zDigits = [...]rune{
	'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D',
	'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
	'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_', 'a', 'b', 'c', 'd', 'e',
	'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
	't', 'u', 'v', 'w', 'x', 'y', 'z', '~',
}

type writer struct {
	a []byte
}

func newWriter() *writer {
	return &writer{
		a: make([]byte, 0),
	}
}

func (writer *writer) PutChar(c rune) {
	writer.a = append(writer.a, byte(c))
}

func (writer *writer) PutInt(v uint32) {
	var i, j int
	zBuf := make([]uint32, 20)

	if v == 0 {
		writer.PutChar('0')
		return
	}

	for i = 0; v > 0; i++ {
		zBuf[i] = uint32(zDigits[v&0x3f])
		v >>= 6
	}

	for j = i - 1; j >= 0; j-- {
		writer.a = append(writer.a, byte(zBuf[j]))
	}
}

func (writer *writer) PutArray(a []byte, start, end int) {
	for i := start; i < end; i++ {
		writer.a = append(writer.a, a[i])
	}
}

func (writer *writer) ToArray() []byte {
	return writer.a
}
