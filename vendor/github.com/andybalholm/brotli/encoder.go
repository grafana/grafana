package brotli

import "github.com/andybalholm/brotli/matchfinder"

// An Encoder implements the matchfinder.Encoder interface, writing in Brotli format.
type Encoder struct {
	wroteHeader bool
	bw          bitWriter
	distCache   []distanceCode
}

func (e *Encoder) Reset() {
	e.wroteHeader = false
	e.bw = bitWriter{}
}

func (e *Encoder) Encode(dst []byte, src []byte, matches []matchfinder.Match, lastBlock bool) []byte {
	e.bw.dst = dst
	if !e.wroteHeader {
		e.bw.writeBits(4, 15)
		e.wroteHeader = true
	}

	if len(src) == 0 {
		if lastBlock {
			e.bw.writeBits(2, 3) // islast + isempty
			e.bw.jumpToByteBoundary()
			return e.bw.dst
		}
		return dst
	}

	var literalHisto [256]uint32
	var commandHisto [704]uint32
	var distanceHisto [64]uint32
	literalCount := 0
	commandCount := 0
	distanceCount := 0

	if len(e.distCache) < len(matches) {
		e.distCache = make([]distanceCode, len(matches))
	}

	// first pass: build the histograms
	pos := 0

	// d is the ring buffer of the last 4 distances.
	d := [4]int{-10, -10, -10, -10}
	for i, m := range matches {
		if m.Unmatched > 0 {
			for _, c := range src[pos : pos+m.Unmatched] {
				literalHisto[c]++
			}
			literalCount += m.Unmatched
		}

		insertCode := getInsertLengthCode(uint(m.Unmatched))
		copyCode := getCopyLengthCode(uint(m.Length))
		if m.Length == 0 {
			// If the stream ends with unmatched bytes, we need a dummy copy length.
			copyCode = 2
		}
		command := combineLengthCodes(insertCode, copyCode, false)
		commandHisto[command]++
		commandCount++

		if command >= 128 && m.Length != 0 {
			var distCode distanceCode
			switch m.Distance {
			case d[3]:
				distCode.code = 0
			case d[2]:
				distCode.code = 1
			case d[1]:
				distCode.code = 2
			case d[0]:
				distCode.code = 3
			case d[3] - 1:
				distCode.code = 4
			case d[3] + 1:
				distCode.code = 5
			case d[3] - 2:
				distCode.code = 6
			case d[3] + 2:
				distCode.code = 7
			case d[3] - 3:
				distCode.code = 8
			case d[3] + 3:
				distCode.code = 9

				// In my testing, codes 10–15 actually reduced the compression ratio.

			default:
				distCode = getDistanceCode(m.Distance)
			}
			e.distCache[i] = distCode
			distanceHisto[distCode.code]++
			distanceCount++
			if distCode.code != 0 {
				d[0], d[1], d[2], d[3] = d[1], d[2], d[3], m.Distance
			}
		}

		pos += m.Unmatched + m.Length
	}

	storeMetaBlockHeaderBW(uint(len(src)), false, &e.bw)
	e.bw.writeBits(13, 0)

	var literalDepths [256]byte
	var literalBits [256]uint16
	buildAndStoreHuffmanTreeFastBW(literalHisto[:], uint(literalCount), 8, literalDepths[:], literalBits[:], &e.bw)

	var commandDepths [704]byte
	var commandBits [704]uint16
	buildAndStoreHuffmanTreeFastBW(commandHisto[:], uint(commandCount), 10, commandDepths[:], commandBits[:], &e.bw)

	var distanceDepths [64]byte
	var distanceBits [64]uint16
	buildAndStoreHuffmanTreeFastBW(distanceHisto[:], uint(distanceCount), 6, distanceDepths[:], distanceBits[:], &e.bw)

	pos = 0
	for i, m := range matches {
		insertCode := getInsertLengthCode(uint(m.Unmatched))
		copyCode := getCopyLengthCode(uint(m.Length))
		if m.Length == 0 {
			// If the stream ends with unmatched bytes, we need a dummy copy length.
			copyCode = 2
		}
		command := combineLengthCodes(insertCode, copyCode, false)
		e.bw.writeBits(uint(commandDepths[command]), uint64(commandBits[command]))
		if kInsExtra[insertCode] > 0 {
			e.bw.writeBits(uint(kInsExtra[insertCode]), uint64(m.Unmatched)-uint64(kInsBase[insertCode]))
		}
		if kCopyExtra[copyCode] > 0 {
			e.bw.writeBits(uint(kCopyExtra[copyCode]), uint64(m.Length)-uint64(kCopyBase[copyCode]))
		}

		if m.Unmatched > 0 {
			for _, c := range src[pos : pos+m.Unmatched] {
				e.bw.writeBits(uint(literalDepths[c]), uint64(literalBits[c]))
			}
		}

		if command >= 128 && m.Length != 0 {
			distCode := e.distCache[i]
			e.bw.writeBits(uint(distanceDepths[distCode.code]), uint64(distanceBits[distCode.code]))
			if distCode.nExtra > 0 {
				e.bw.writeBits(distCode.nExtra, distCode.extraBits)
			}
		}

		pos += m.Unmatched + m.Length
	}

	if lastBlock {
		e.bw.writeBits(2, 3) // islast + isempty
		e.bw.jumpToByteBoundary()
	}
	return e.bw.dst
}

type distanceCode struct {
	code      int
	nExtra    uint
	extraBits uint64
}

func getDistanceCode(distance int) distanceCode {
	d := distance + 3
	nbits := log2FloorNonZero(uint(d)) - 1
	prefix := (d >> nbits) & 1
	offset := (2 + prefix) << nbits
	distcode := int(2*(nbits-1)) + prefix + 16
	extra := d - offset
	return distanceCode{distcode, uint(nbits), uint64(extra)}
}
