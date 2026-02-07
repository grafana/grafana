package rueidis

type bitmap struct {
	exts []uint64  // 24 bytes
	bits [3]uint64 // 24 bytes
}

func (b *bitmap) Init(n int) {
	if n > 192 {
		b.exts = make([]uint64, (n-192+63)/64)
	}
}

func (b *bitmap) Set(i int) {
	if i < 192 {
		b.bits[i/64] |= 1 << (i % 64)
	} else {
		b.exts[(i-192)/64] |= 1 << (i % 64)
	}
}

func (b *bitmap) Get(i int) bool {
	if i < 192 {
		return b.bits[i/64]&(1<<(i%64)) != 0
	}
	return b.exts[(i-192)/64]&(1<<(i%64)) != 0
}

func (b *bitmap) Len() int {
	return len(b.exts)*64 + 192
}
