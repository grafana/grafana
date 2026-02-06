package fdelta

type rollingHash struct {
	a, b, i uint16
	z       []byte
}

func newRollingHash() *rollingHash {
	return &rollingHash{
		a: 0,
		b: 0,
		i: 0,
		z: make([]byte, nHashSize),
	}
}

func (rHash *rollingHash) Init(z []byte, pos int) {
	var a, b, x, i uint16

	for i = 0; i < nHashSize; i++ {
		x = uint16(z[pos+int(i)])
		a = ((a + x) & 0xffff)
		b = ((b + (nHashSize-i)*x) & 0xffff)
		rHash.z[i] = byte(x)
	}
	rHash.a = (a & 0xffff)
	rHash.b = (b & 0xffff)
	rHash.i = 0
}

func (rHash *rollingHash) Next(c byte) {
	old := uint16(rHash.z[rHash.i])
	rHash.z[rHash.i] = c
	rHash.i = ((rHash.i + 1) & (nHashSize - 1))
	rHash.a = (rHash.a - old + uint16(c))
	rHash.b = (rHash.b - nHashSize*old + rHash.a)
}

func (rHash *rollingHash) Value() uint32 {
	return uint32(rHash.a&0xffff) | (uint32(rHash.b&0xffff) << 16)
}
