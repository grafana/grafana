// Copyright (c) 2012, Sean Treadway, SoundCloud Ltd.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.
// Source code and contact info at http://github.com/streadway/amqp

package amqp

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"math"
	"time"
)

func (me *writer) WriteFrame(frame frame) (err error) {
	if err = frame.write(me.w); err != nil {
		return
	}

	if buf, ok := me.w.(*bufio.Writer); ok {
		err = buf.Flush()
	}

	return
}

func (me *methodFrame) write(w io.Writer) (err error) {
	var payload bytes.Buffer

	if me.Method == nil {
		return errors.New("malformed frame: missing method")
	}

	class, method := me.Method.id()

	if err = binary.Write(&payload, binary.BigEndian, class); err != nil {
		return
	}

	if err = binary.Write(&payload, binary.BigEndian, method); err != nil {
		return
	}

	if err = me.Method.write(&payload); err != nil {
		return
	}

	return writeFrame(w, frameMethod, me.ChannelId, payload.Bytes())
}

// Heartbeat
//
// Payload is empty
func (me *heartbeatFrame) write(w io.Writer) (err error) {
	return writeFrame(w, frameHeartbeat, me.ChannelId, []byte{})
}

// CONTENT HEADER
// 0          2        4           12               14
// +----------+--------+-----------+----------------+------------- - -
// | class-id | weight | body size | property flags | property list...
// +----------+--------+-----------+----------------+------------- - -
//    short     short    long long       short        remainder...
//
func (me *headerFrame) write(w io.Writer) (err error) {
	var payload bytes.Buffer
	var zeroTime time.Time

	if err = binary.Write(&payload, binary.BigEndian, me.ClassId); err != nil {
		return
	}

	if err = binary.Write(&payload, binary.BigEndian, me.weight); err != nil {
		return
	}

	if err = binary.Write(&payload, binary.BigEndian, me.Size); err != nil {
		return
	}

	// First pass will build the mask to be serialized, second pass will serialize
	// each of the fields that appear in the mask.

	var mask uint16

	if len(me.Properties.ContentType) > 0 {
		mask = mask | flagContentType
	}
	if len(me.Properties.ContentEncoding) > 0 {
		mask = mask | flagContentEncoding
	}
	if me.Properties.Headers != nil && len(me.Properties.Headers) > 0 {
		mask = mask | flagHeaders
	}
	if me.Properties.DeliveryMode > 0 {
		mask = mask | flagDeliveryMode
	}
	if me.Properties.Priority > 0 {
		mask = mask | flagPriority
	}
	if len(me.Properties.CorrelationId) > 0 {
		mask = mask | flagCorrelationId
	}
	if len(me.Properties.ReplyTo) > 0 {
		mask = mask | flagReplyTo
	}
	if len(me.Properties.Expiration) > 0 {
		mask = mask | flagExpiration
	}
	if len(me.Properties.MessageId) > 0 {
		mask = mask | flagMessageId
	}
	if me.Properties.Timestamp != zeroTime {
		mask = mask | flagTimestamp
	}
	if len(me.Properties.Type) > 0 {
		mask = mask | flagType
	}
	if len(me.Properties.UserId) > 0 {
		mask = mask | flagUserId
	}
	if len(me.Properties.AppId) > 0 {
		mask = mask | flagAppId
	}

	if err = binary.Write(&payload, binary.BigEndian, mask); err != nil {
		return
	}

	if hasProperty(mask, flagContentType) {
		if err = writeShortstr(&payload, me.Properties.ContentType); err != nil {
			return
		}
	}
	if hasProperty(mask, flagContentEncoding) {
		if err = writeShortstr(&payload, me.Properties.ContentEncoding); err != nil {
			return
		}
	}
	if hasProperty(mask, flagHeaders) {
		if err = writeTable(&payload, me.Properties.Headers); err != nil {
			return
		}
	}
	if hasProperty(mask, flagDeliveryMode) {
		if err = binary.Write(&payload, binary.BigEndian, me.Properties.DeliveryMode); err != nil {
			return
		}
	}
	if hasProperty(mask, flagPriority) {
		if err = binary.Write(&payload, binary.BigEndian, me.Properties.Priority); err != nil {
			return
		}
	}
	if hasProperty(mask, flagCorrelationId) {
		if err = writeShortstr(&payload, me.Properties.CorrelationId); err != nil {
			return
		}
	}
	if hasProperty(mask, flagReplyTo) {
		if err = writeShortstr(&payload, me.Properties.ReplyTo); err != nil {
			return
		}
	}
	if hasProperty(mask, flagExpiration) {
		if err = writeShortstr(&payload, me.Properties.Expiration); err != nil {
			return
		}
	}
	if hasProperty(mask, flagMessageId) {
		if err = writeShortstr(&payload, me.Properties.MessageId); err != nil {
			return
		}
	}
	if hasProperty(mask, flagTimestamp) {
		if err = binary.Write(&payload, binary.BigEndian, uint64(me.Properties.Timestamp.Unix())); err != nil {
			return
		}
	}
	if hasProperty(mask, flagType) {
		if err = writeShortstr(&payload, me.Properties.Type); err != nil {
			return
		}
	}
	if hasProperty(mask, flagUserId) {
		if err = writeShortstr(&payload, me.Properties.UserId); err != nil {
			return
		}
	}
	if hasProperty(mask, flagAppId) {
		if err = writeShortstr(&payload, me.Properties.AppId); err != nil {
			return
		}
	}

	return writeFrame(w, frameHeader, me.ChannelId, payload.Bytes())
}

// Body
//
// Payload is one byterange from the full body who's size is declared in the
// Header frame
func (me *bodyFrame) write(w io.Writer) (err error) {
	return writeFrame(w, frameBody, me.ChannelId, me.Body)
}

func writeFrame(w io.Writer, typ uint8, channel uint16, payload []byte) (err error) {
	end := []byte{frameEnd}
	size := uint(len(payload))

	_, err = w.Write([]byte{
		byte(typ),
		byte((channel & 0xff00) >> 8),
		byte((channel & 0x00ff) >> 0),
		byte((size & 0xff000000) >> 24),
		byte((size & 0x00ff0000) >> 16),
		byte((size & 0x0000ff00) >> 8),
		byte((size & 0x000000ff) >> 0),
	})

	if err != nil {
		return
	}

	if _, err = w.Write(payload); err != nil {
		return
	}

	if _, err = w.Write(end); err != nil {
		return
	}

	return
}

func writeShortstr(w io.Writer, s string) (err error) {
	b := []byte(s)

	var length uint8 = uint8(len(b))

	if err = binary.Write(w, binary.BigEndian, length); err != nil {
		return
	}

	if _, err = w.Write(b[:length]); err != nil {
		return
	}

	return
}

func writeLongstr(w io.Writer, s string) (err error) {
	b := []byte(s)

	var length uint32 = uint32(len(b))

	if err = binary.Write(w, binary.BigEndian, length); err != nil {
		return
	}

	if _, err = w.Write(b[:length]); err != nil {
		return
	}

	return
}

/*
'A': []interface{}
'D': Decimal
'F': Table
'I': int32
'S': string
'T': time.Time
'V': nil
'b': byte
'd': float64
'f': float32
'l': int64
's': int16
't': bool
'x': []byte
*/
func writeField(w io.Writer, value interface{}) (err error) {
	var buf [9]byte
	var enc []byte

	switch v := value.(type) {
	case bool:
		buf[0] = 't'
		if v {
			buf[1] = byte(1)
		} else {
			buf[1] = byte(0)
		}
		enc = buf[:2]

	case byte:
		buf[0] = 'b'
		buf[1] = byte(v)
		enc = buf[:2]

	case int16:
		buf[0] = 's'
		binary.BigEndian.PutUint16(buf[1:3], uint16(v))
		enc = buf[:3]

	case int32:
		buf[0] = 'I'
		binary.BigEndian.PutUint32(buf[1:5], uint32(v))
		enc = buf[:5]

	case int64:
		buf[0] = 'l'
		binary.BigEndian.PutUint64(buf[1:9], uint64(v))
		enc = buf[:9]

	case float32:
		buf[0] = 'f'
		binary.BigEndian.PutUint32(buf[1:5], math.Float32bits(v))
		enc = buf[:5]

	case float64:
		buf[0] = 'd'
		binary.BigEndian.PutUint64(buf[1:9], math.Float64bits(v))
		enc = buf[:9]

	case Decimal:
		buf[0] = 'D'
		buf[1] = byte(v.Scale)
		binary.BigEndian.PutUint32(buf[2:6], uint32(v.Value))
		enc = buf[:6]

	case string:
		buf[0] = 'S'
		binary.BigEndian.PutUint32(buf[1:5], uint32(len(v)))
		enc = append(buf[:5], []byte(v)...)

	case []interface{}: // field-array
		buf[0] = 'A'

		sec := new(bytes.Buffer)
		for _, val := range v {
			if err = writeField(sec, val); err != nil {
				return
			}
		}

		binary.BigEndian.PutUint32(buf[1:5], uint32(sec.Len()))
		if _, err = w.Write(buf[:5]); err != nil {
			return
		}

		if _, err = w.Write(sec.Bytes()); err != nil {
			return
		}

		return

	case time.Time:
		buf[0] = 'T'
		binary.BigEndian.PutUint64(buf[1:9], uint64(v.Unix()))
		enc = buf[:9]

	case Table:
		if _, err = w.Write([]byte{'F'}); err != nil {
			return
		}
		return writeTable(w, v)

	case []byte:
		buf[0] = 'x'
		binary.BigEndian.PutUint32(buf[1:5], uint32(len(v)))
		if _, err = w.Write(buf[0:5]); err != nil {
			return
		}
		if _, err = w.Write(v); err != nil {
			return
		}
		return

	case nil:
		buf[0] = 'V'
		enc = buf[:1]

	default:
		return ErrFieldType
	}

	_, err = w.Write(enc)

	return
}

func writeTable(w io.Writer, table Table) (err error) {
	var buf bytes.Buffer

	for key, val := range table {
		if err = writeShortstr(&buf, key); err != nil {
			return
		}
		if err = writeField(&buf, val); err != nil {
			return
		}
	}

	return writeLongstr(w, string(buf.Bytes()))
}
