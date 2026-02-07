package numeric

var interleaveMagic = []uint64{
	0x5555555555555555,
	0x3333333333333333,
	0x0F0F0F0F0F0F0F0F,
	0x00FF00FF00FF00FF,
	0x0000FFFF0000FFFF,
	0x00000000FFFFFFFF,
	0xAAAAAAAAAAAAAAAA,
}

var interleaveShift = []uint{1, 2, 4, 8, 16}

// Interleave the first 32 bits of each uint64
// adapted from org.apache.lucene.util.BitUtil
// which was adapted from:
// http://graphics.stanford.edu/~seander/bithacks.html#InterleaveBMN
func Interleave(v1, v2 uint64) uint64 {
	v1 = (v1 | (v1 << interleaveShift[4])) & interleaveMagic[4]
	v1 = (v1 | (v1 << interleaveShift[3])) & interleaveMagic[3]
	v1 = (v1 | (v1 << interleaveShift[2])) & interleaveMagic[2]
	v1 = (v1 | (v1 << interleaveShift[1])) & interleaveMagic[1]
	v1 = (v1 | (v1 << interleaveShift[0])) & interleaveMagic[0]
	v2 = (v2 | (v2 << interleaveShift[4])) & interleaveMagic[4]
	v2 = (v2 | (v2 << interleaveShift[3])) & interleaveMagic[3]
	v2 = (v2 | (v2 << interleaveShift[2])) & interleaveMagic[2]
	v2 = (v2 | (v2 << interleaveShift[1])) & interleaveMagic[1]
	v2 = (v2 | (v2 << interleaveShift[0])) & interleaveMagic[0]
	return (v2 << 1) | v1
}

// Deinterleave the 32-bit value starting at position 0
// to get the other 32-bit value, shift it by 1 first
func Deinterleave(b uint64) uint64 {
	b &= interleaveMagic[0]
	b = (b ^ (b >> interleaveShift[0])) & interleaveMagic[1]
	b = (b ^ (b >> interleaveShift[1])) & interleaveMagic[2]
	b = (b ^ (b >> interleaveShift[2])) & interleaveMagic[3]
	b = (b ^ (b >> interleaveShift[3])) & interleaveMagic[4]
	b = (b ^ (b >> interleaveShift[4])) & interleaveMagic[5]
	return b
}
