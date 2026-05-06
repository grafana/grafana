package rueidis

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"sync"
)

var errChunked = errors.New("unbounded redis message")
var errOldNull = errors.New("RESP2 null")

const (
	typeBlobString     = byte('$')
	typeSimpleString   = byte('+')
	typeSimpleErr      = byte('-')
	typeInteger        = byte(':')
	typeNull           = byte('_')
	typeEnd            = byte('.')
	typeFloat          = byte(',')
	typeBool           = byte('#')
	typeBlobErr        = byte('!')
	typeVerbatimString = byte('=')
	typeBigNumber      = byte('(')
	typeArray          = byte('*')
	typeMap            = byte('%')
	typeSet            = byte('~')
	typeAttribute      = byte('|')
	typePush           = byte('>')
	typeChunk          = byte(';')
)

var typeNames = make(map[byte]string, 16)

type reader func(i *bufio.Reader) (RedisMessage, error)

var readers = [256]reader{}

func init() {
	readers[typeBlobString] = readBlobString
	readers[typeSimpleString] = readSimpleString
	readers[typeSimpleErr] = readSimpleString
	readers[typeInteger] = readInteger
	readers[typeNull] = readNull
	readers[typeFloat] = readSimpleString
	readers[typeBool] = readBoolean
	readers[typeBlobErr] = readBlobString
	readers[typeVerbatimString] = readBlobString
	readers[typeBigNumber] = readSimpleString
	readers[typeArray] = readArray
	readers[typeMap] = readMap
	readers[typeSet] = readArray
	readers[typeAttribute] = readMap
	readers[typePush] = readArray
	readers[typeEnd] = readNull

	typeNames[typeBlobString] = "blob string"
	typeNames[typeSimpleString] = "simple string"
	typeNames[typeSimpleErr] = "simple error"
	typeNames[typeInteger] = "int64"
	typeNames[typeNull] = "null"
	typeNames[typeFloat] = "float64"
	typeNames[typeBool] = "boolean"
	typeNames[typeBlobErr] = "blob error"
	typeNames[typeVerbatimString] = "verbatim string"
	typeNames[typeBigNumber] = "big number"
	typeNames[typeArray] = "array"
	typeNames[typeMap] = "map"
	typeNames[typeSet] = "set"
	typeNames[typeAttribute] = "attribute"
	typeNames[typePush] = "push"
	typeNames[typeEnd] = "null"
}

func readSimpleString(i *bufio.Reader) (m RedisMessage, err error) {
	m.string, err = readS(i)
	return
}

func readBlobString(i *bufio.Reader) (m RedisMessage, err error) {
	m.string, err = readB(i)
	if err == errChunked {
		sb := strings.Builder{}
		for {
			if _, err = i.Discard(1); err != nil { // discard the ';'
				return RedisMessage{}, err
			}
			length, err := readI(i)
			if err != nil {
				return RedisMessage{}, err
			}
			if length == 0 {
				return RedisMessage{string: sb.String()}, nil
			}
			sb.Grow(int(length))
			if _, err = io.CopyN(&sb, i, length); err != nil {
				return RedisMessage{}, err
			}
			if _, err = i.Discard(2); err != nil {
				return RedisMessage{}, err
			}
		}
	}
	return
}

func readInteger(i *bufio.Reader) (m RedisMessage, err error) {
	m.integer, err = readI(i)
	return
}

func readBoolean(i *bufio.Reader) (m RedisMessage, err error) {
	b, err := i.ReadByte()
	if err != nil {
		return RedisMessage{}, err
	}
	if b == 't' {
		m.integer = 1
	}
	_, err = i.Discard(2)
	return
}

func readNull(i *bufio.Reader) (m RedisMessage, err error) {
	_, err = i.Discard(2)
	return
}

func readArray(i *bufio.Reader) (m RedisMessage, err error) {
	length, err := readI(i)
	if err == nil {
		if length == -1 {
			return m, errOldNull
		}
		m.values, err = readA(i, length)
	} else if err == errChunked {
		m.values, err = readE(i)
	}
	return m, err
}

func readMap(i *bufio.Reader) (m RedisMessage, err error) {
	length, err := readI(i)
	if err == nil {
		m.values, err = readA(i, length*2)
	} else if err == errChunked {
		m.values, err = readE(i)
	}
	return m, err
}

const ok = "OK"
const okrn = "OK\r\n"

func readS(i *bufio.Reader) (string, error) {
	if peek, _ := i.Peek(2); string(peek) == ok {
		if peek, _ = i.Peek(4); string(peek) == okrn {
			_, _ = i.Discard(4)
			return ok, nil
		}
	}
	bs, err := i.ReadBytes('\n')
	if err != nil {
		return "", err
	}
	if trim := len(bs) - 2; trim < 0 {
		return "", errors.New(unexpectedNoCRLF)
	} else {
		bs = bs[:trim]
	}
	return BinaryString(bs), nil
}

func readI(i *bufio.Reader) (v int64, err error) {
	bs, err := i.ReadSlice('\n')
	if err != nil {
		return 0, err
	}
	if len(bs) < 3 {
		return 0, errors.New(unexpectedNoCRLF)
	}
	if bs[0] == '?' {
		return 0, errChunked
	}
	var s = int64(1)
	if bs[0] == '-' {
		s = -1
		bs = bs[1:]
	}
	for _, c := range bs[:len(bs)-2] {
		if d := int64(c - '0'); d >= 0 && d <= 9 {
			v = v*10 + d
		} else {
			return 0, errors.New(unexpectedNumByte + strconv.Itoa(int(c)))
		}
	}
	return v * s, nil
}

func readB(i *bufio.Reader) (string, error) {
	length, err := readI(i)
	if err != nil {
		return "", err
	}
	if length == -1 {
		return "", errOldNull
	}
	bs := make([]byte, length)
	if _, err = io.ReadFull(i, bs); err != nil {
		return "", err
	}
	if _, err = i.Discard(2); err != nil {
		return "", err
	}
	return BinaryString(bs), nil
}

func readE(i *bufio.Reader) ([]RedisMessage, error) {
	v := make([]RedisMessage, 0)
	for {
		n, err := readNextMessage(i)
		if err != nil {
			return nil, err
		}
		if n.typ == '.' {
			return v, err
		}
		v = append(v, n)
	}
}

func readA(i *bufio.Reader, length int64) (v []RedisMessage, err error) {
	v = make([]RedisMessage, length)
	for n := int64(0); n < length; n++ {
		if v[n], err = readNextMessage(i); err != nil {
			return nil, err
		}
	}
	return v, nil
}

func writeB(o *bufio.Writer, id byte, str string) (err error) {
	_ = writeN(o, id, len(str))
	_, _ = o.WriteString(str)
	_, err = o.WriteString("\r\n")
	return err
}

func writeS(o *bufio.Writer, id byte, str string) (err error) {
	_ = o.WriteByte(id)
	_, _ = o.WriteString(str)
	_, err = o.WriteString("\r\n")
	return err
}

func writeN(o *bufio.Writer, id byte, n int) (err error) {
	_ = o.WriteByte(id)
	if n < 10 {
		_ = o.WriteByte(byte('0' + n))
	} else {
		for d := int(math.Pow10(int(math.Log10(float64(n))))); d > 0; d /= 10 {
			_ = o.WriteByte(byte('0' + n/d))
			n = n % d
		}
	}
	_, err = o.WriteString("\r\n")
	return err
}

func readNextMessage(i *bufio.Reader) (m RedisMessage, err error) {
	var attrs *RedisMessage
	var typ byte
	for {
		if typ, err = i.ReadByte(); err != nil {
			return RedisMessage{}, err
		}
		fn := readers[typ]
		if fn == nil {
			return RedisMessage{}, errors.New(unknownMessageType + strconv.Itoa(int(typ)))
		}
		if m, err = fn(i); err != nil {
			if err == errOldNull {
				return RedisMessage{typ: typeNull}, nil
			}
			return RedisMessage{}, err
		}
		m.typ = typ
		if m.typ == typeAttribute { // handle the attributes
			a := m     // clone the original m first, and then take address of the clone
			attrs = &a // to avoid go compiler allocating the m on heap which causing worse performance.
			m = RedisMessage{}
			continue
		}
		m.attrs = attrs
		return m, nil
	}
}

var lrs = sync.Pool{New: func() any { return &io.LimitedReader{} }}

func streamTo(i *bufio.Reader, w io.Writer) (n int64, err error, clean bool) {
next:
	var typ byte
	if typ, err = i.ReadByte(); err != nil {
		return 0, err, false
	}
	switch typ {
	case typeBlobString, typeVerbatimString, typeChunk:
		if n, err = readI(i); err != nil {
			if err == errChunked {
				var nn int64
				nn, err, clean = streamTo(i, w)
				for n += nn; nn != 0 && clean && err == nil; n += nn {
					nn, err, clean = streamTo(i, w)
				}
			}
			return n, err, clean
		}
		if n == -1 {
			return 0, Nil, true
		}
		full := n + 2
		if n != 0 {
			lr := lrs.Get().(*io.LimitedReader)
			lr.R = i
			lr.N = n
			n, err = io.Copy(w, lr)
			lr.R = nil
			lrs.Put(lr)
		} else if typ == typeChunk {
			return n, err, true
		}
		if _, err2 := i.Discard(int(full - n)); err2 == nil {
			clean = true
		} else if err == nil {
			err = err2
		}
		return n, err, clean
	default:
		_ = i.UnreadByte()
		m, err := readNextMessage(i)
		if err != nil {
			return 0, err, false
		}
		switch m.typ {
		case typeSimpleString, typeFloat, typeBigNumber:
			n, err := w.Write([]byte(m.string))
			return int64(n), err, true
		case typeNull:
			return 0, Nil, true
		case typeSimpleErr, typeBlobErr:
			mm := m
			return 0, (*RedisError)(&mm), true
		case typeInteger, typeBool:
			n, err := w.Write([]byte(strconv.FormatInt(m.integer, 10)))
			return int64(n), err, true
		case typePush:
			goto next
		default:
			return 0, fmt.Errorf("unsupported redis %q response for streaming read", typeNames[typ]), true
		}
	}
}

func writeCmd(o *bufio.Writer, cmd []string) (err error) {
	err = writeN(o, '*', len(cmd))
	for _, m := range cmd {
		err = writeB(o, '$', m)
		// TODO: Can we set cmd[i] = "" here to allow GC to eagerly recycle memory?
		// Related: https://github.com/redis/rueidis/issues/364
	}
	return err
}

func flushCmd(o *bufio.Writer, cmd []string) (err error) {
	_ = writeCmd(o, cmd)
	return o.Flush()
}

const (
	unexpectedNoCRLF   = "received unexpected simple string message ending without CRLF"
	unexpectedNumByte  = "received unexpected number byte: "
	unknownMessageType = "received unknown message type: "
)
