package fdelta

import "errors"

const nHashSize = 16

// Create delta between origin and target byte slices.
func Create(origin, target []byte) []byte {
	zDelta := newWriter()
	lenOut := len(target)
	lenSrc := len(origin)
	lastRead := int(-1)
	i := int(0)

	zDelta.PutInt(uint32(lenOut))
	zDelta.PutChar('\n')

	if lenSrc <= nHashSize {
		zDelta.PutInt(uint32(lenOut))
		zDelta.PutChar(':')
		zDelta.PutArray(target, 0, lenOut)
		zDelta.PutInt(checksum(target))
		zDelta.PutChar(';')
		return zDelta.ToArray()
	}

	nHash := lenSrc / nHashSize
	collide := make([]int, nHash)
	landmark := make([]int, nHash)

	for i = 0; i < nHash; i++ {
		collide[i] = -1
		landmark[i] = -1
	}

	hv := int(0)
	h := newRollingHash()
	for i = 0; i < lenSrc-nHashSize; i += nHashSize {
		h.Init(origin, i)
		hv = int(h.Value() % uint32(nHash))
		collide[i/nHashSize] = landmark[hv]
		landmark[hv] = i / nHashSize
	}

	var _base, iSrc, iBlock, bestCnt, bestOfst, bestLitsz int

	for _base+nHashSize < lenOut {
		bestOfst = 0
		bestLitsz = 0
		h.Init(target, _base)
		i = 0
		bestCnt = 0
		for {
			limit := int(250)
			hv = int(h.Value() % uint32(nHash))
			iBlock = landmark[hv]
			for iBlock >= 0 {
				limit--
				if limit <= 0 {
					break
				}

				var cnt, ofst, litsz int
				var j, k, x, y int
				var sz int

				iSrc = iBlock * nHashSize

				x = iSrc
				y = _base + i
				j = 0
				for x < lenSrc && y < lenOut {
					if origin[x] != target[y] {
						break
					}
					x++
					y++
					j++
				}
				j--

				for k = 1; k < iSrc && k <= i; k++ {
					if origin[iSrc-k] != target[_base+i-k] {
						break
					}
				}
				k--

				ofst = iSrc - k
				cnt = j + k + 1
				litsz = i - k

				sz = digitCount(i-k) + digitCount(cnt) + digitCount(ofst) + 3
				if cnt >= sz && cnt > bestCnt {
					bestCnt = cnt
					bestOfst = iSrc - k
					bestLitsz = litsz
				}

				iBlock = collide[iBlock]
			}

			if bestCnt > 0 {
				if bestLitsz > 0 {
					zDelta.PutInt(uint32(bestLitsz))
					zDelta.PutChar(':')
					zDelta.PutArray(target, _base, _base+bestLitsz)
					_base += bestLitsz
				}

				_base += bestCnt
				zDelta.PutInt(uint32(bestCnt))
				zDelta.PutChar('@')
				zDelta.PutInt(uint32(bestOfst))
				zDelta.PutChar(',')
				if bestOfst+bestCnt-1 > lastRead {
					lastRead = bestOfst + bestCnt - 1
				}
				break
			}

			if _base+i+nHashSize >= lenOut {
				zDelta.PutInt(uint32(lenOut - _base))
				zDelta.PutChar(':')
				zDelta.PutArray(target, _base, lenOut)
				_base = lenOut
				break
			}

			h.Next(target[_base+i+nHashSize])
			i++
		}
	}

	if _base < lenOut {
		zDelta.PutInt(uint32(lenOut - _base))
		zDelta.PutChar(':')
		zDelta.PutArray(target, _base, lenOut)
	}

	zDelta.PutInt(checksum(target))
	zDelta.PutChar(';')
	return zDelta.ToArray()
}

// Apply delta to origin byte slice.
func Apply(origin, delta []byte) ([]byte, error) {
	var err error
	var ch rune
	limit := uint32(0)
	total := uint32(0)
	lenSrc := uint32(len(origin))
	lenDelta := uint32(len(delta))

	zDelta := newReader(delta)

	limit, err = zDelta.GetInt()
	if err != nil {
		return nil, err
	}

	ch, err = zDelta.GetChar()
	if err != nil {
		return nil, err
	}
	if ch != '\n' {
		return nil, errors.New("size integer not terminated by '\\n'")
	}

	zOut := newWriter()
	for zDelta.HaveBytes() {
		var cnt, ofst uint32
		cnt, err = zDelta.GetInt()
		if err != nil {
			return nil, err
		}

		ch, err = zDelta.GetChar()
		if err != nil {
			return nil, err
		}

		switch ch {
		case '@':
			ofst, err = zDelta.GetInt()
			if err != nil {
				return nil, err
			}

			ch, err = zDelta.GetChar()
			if err != nil {
				return nil, err
			}

			if zDelta.HaveBytes() && ch != ',' {
				return nil, errors.New("copy command not terminated by ','")
			}
			total += cnt
			if total > limit {
				return nil, errors.New("copy exceeds output file size")
			}
			if ofst+cnt > lenSrc {
				return nil, errors.New("copy extends past end of input")
			}
			zOut.PutArray(origin, int(ofst), int(ofst+cnt))

		case ':':
			total += cnt
			if total > limit {
				return nil, errors.New("insert command gives an output larger than predicted")
			}
			if cnt > lenDelta {
				return nil, errors.New("insert count exceeds size of delta")
			}
			zOut.PutArray(zDelta.A, int(zDelta.Pos), int(zDelta.Pos+cnt))
			zDelta.Pos += cnt

		case ';':
			output := zOut.ToArray()
			if cnt != checksum(output) {
				return nil, errors.New("bad checksum")
			}
			if total != limit {
				return nil, errors.New("generated size does not match predicted size")
			}
			return output, nil

		default:
			return nil, errors.New("unknown delta operator")
		}
	}
	return nil, errors.New("unterminated delta")
}

func checksum(arr []byte) uint32 {
	var sum0, sum1, sum2, sum, z uint32
	N := len(arr)

	for N >= 16 {
		sum0 += uint32(arr[z+0]) + uint32(arr[z+4]) + uint32(arr[z+8]) + uint32(arr[z+12])
		sum1 += uint32(arr[z+1]) + uint32(arr[z+5]) + uint32(arr[z+9]) + uint32(arr[z+13])
		sum2 += uint32(arr[z+2]) + uint32(arr[z+6]) + uint32(arr[z+10]) + uint32(arr[z+14])
		sum += uint32(arr[z+3]) + uint32(arr[z+7]) + uint32(arr[z+11]) + uint32(arr[z+15])
		z += 16
		N -= 16
	}

	for N >= 4 {
		sum0 += uint32(arr[z+0])
		sum1 += uint32(arr[z+1])
		sum2 += uint32(arr[z+2])
		sum += uint32(arr[z+3])
		z += 4
		N -= 4
	}

	sum += (sum2 << 8) + (sum1 << 16) + (sum0 << 24)

	switch N & 3 {
	case 3:
		sum += uint32(arr[z+2]) << 8
		sum += uint32(arr[z+1]) << 16
		sum += uint32(arr[z+0]) << 24
	case 2:
		sum += uint32(arr[z+1]) << 16
		sum += uint32(arr[z+0]) << 24
	case 1:
		sum += uint32(arr[z+0]) << 24
	}

	return sum
}

func digitCount(v int) int {
	i := int(1)
	x := int(64)

	for v >= x {
		i++
		x <<= 6
	}

	return i
}
