package base64vlq

import "io"

const encodeStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

const (
	vlqBaseShift       = 5
	vlqBase            = 1 << vlqBaseShift
	vlqBaseMask        = vlqBase - 1
	vlqSignBit         = 1
	vlqContinuationBit = vlqBase
)

var decodeMap [256]byte

func init() {
	for i := 0; i < len(encodeStd); i++ {
		decodeMap[encodeStd[i]] = byte(i)
	}
}

func toVLQSigned(n int32) int32 {
	if n < 0 {
		return -n<<1 + 1
	}
	return n << 1
}

func fromVLQSigned(n int32) int32 {
	isNeg := n&vlqSignBit != 0
	n >>= 1
	if isNeg {
		return -n
	}
	return n
}

type Encoder struct {
	w io.ByteWriter
}

func NewEncoder(w io.ByteWriter) *Encoder {
	return &Encoder{
		w: w,
	}
}

func (enc Encoder) Encode(n int32) error {
	n = toVLQSigned(n)
	for digit := int32(vlqContinuationBit); digit&vlqContinuationBit != 0; {
		digit = n & vlqBaseMask
		n >>= vlqBaseShift
		if n > 0 {
			digit |= vlqContinuationBit
		}

		err := enc.w.WriteByte(encodeStd[digit])
		if err != nil {
			return err
		}
	}
	return nil
}

type Decoder struct {
	r io.ByteReader
}

func NewDecoder(r io.ByteReader) Decoder {
	return Decoder{
		r: r,
	}
}

func (dec Decoder) Decode() (n int32, err error) {
	shift := uint(0)
	for continuation := true; continuation; {
		c, err := dec.r.ReadByte()
		if err != nil {
			return 0, err
		}

		c = decodeMap[c]
		continuation = c&vlqContinuationBit != 0
		n += int32(c&vlqBaseMask) << shift
		shift += vlqBaseShift
	}
	return fromVLQSigned(n), nil
}
