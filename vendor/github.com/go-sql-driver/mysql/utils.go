// Go MySQL Driver - A MySQL-Driver for Go's database/sql package
//
// Copyright 2012 The Go-MySQL-Driver Authors. All rights reserved.
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// You can obtain one at http://mozilla.org/MPL/2.0/.

package mysql

import (
	"crypto/tls"
	"database/sql/driver"
	"encoding/binary"
	"fmt"
	"io"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Registry for custom tls.Configs
var (
	tlsConfigLock     sync.RWMutex
	tlsConfigRegistry map[string]*tls.Config
)

// RegisterTLSConfig registers a custom tls.Config to be used with sql.Open.
// Use the key as a value in the DSN where tls=value.
//
// Note: The provided tls.Config is exclusively owned by the driver after
// registering it.
//
//  rootCertPool := x509.NewCertPool()
//  pem, err := ioutil.ReadFile("/path/ca-cert.pem")
//  if err != nil {
//      log.Fatal(err)
//  }
//  if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
//      log.Fatal("Failed to append PEM.")
//  }
//  clientCert := make([]tls.Certificate, 0, 1)
//  certs, err := tls.LoadX509KeyPair("/path/client-cert.pem", "/path/client-key.pem")
//  if err != nil {
//      log.Fatal(err)
//  }
//  clientCert = append(clientCert, certs)
//  mysql.RegisterTLSConfig("custom", &tls.Config{
//      RootCAs: rootCertPool,
//      Certificates: clientCert,
//  })
//  db, err := sql.Open("mysql", "user@tcp(localhost:3306)/test?tls=custom")
//
func RegisterTLSConfig(key string, config *tls.Config) error {
	if _, isBool := readBool(key); isBool || strings.ToLower(key) == "skip-verify" {
		return fmt.Errorf("key '%s' is reserved", key)
	}

	tlsConfigLock.Lock()
	if tlsConfigRegistry == nil {
		tlsConfigRegistry = make(map[string]*tls.Config)
	}

	tlsConfigRegistry[key] = config
	tlsConfigLock.Unlock()
	return nil
}

// DeregisterTLSConfig removes the tls.Config associated with key.
func DeregisterTLSConfig(key string) {
	tlsConfigLock.Lock()
	if tlsConfigRegistry != nil {
		delete(tlsConfigRegistry, key)
	}
	tlsConfigLock.Unlock()
}

func getTLSConfigClone(key string) (config *tls.Config) {
	tlsConfigLock.RLock()
	if v, ok := tlsConfigRegistry[key]; ok {
		config = cloneTLSConfig(v)
	}
	tlsConfigLock.RUnlock()
	return
}

// Returns the bool value of the input.
// The 2nd return value indicates if the input was a valid bool value
func readBool(input string) (value bool, valid bool) {
	switch input {
	case "1", "true", "TRUE", "True":
		return true, true
	case "0", "false", "FALSE", "False":
		return false, true
	}

	// Not a valid bool value
	return
}

/******************************************************************************
*                           Time related utils                                *
******************************************************************************/

// NullTime represents a time.Time that may be NULL.
// NullTime implements the Scanner interface so
// it can be used as a scan destination:
//
//  var nt NullTime
//  err := db.QueryRow("SELECT time FROM foo WHERE id=?", id).Scan(&nt)
//  ...
//  if nt.Valid {
//     // use nt.Time
//  } else {
//     // NULL value
//  }
//
// This NullTime implementation is not driver-specific
type NullTime struct {
	Time  time.Time
	Valid bool // Valid is true if Time is not NULL
}

// Scan implements the Scanner interface.
// The value type must be time.Time or string / []byte (formatted time-string),
// otherwise Scan fails.
func (nt *NullTime) Scan(value interface{}) (err error) {
	if value == nil {
		nt.Time, nt.Valid = time.Time{}, false
		return
	}

	switch v := value.(type) {
	case time.Time:
		nt.Time, nt.Valid = v, true
		return
	case []byte:
		nt.Time, err = parseDateTime(string(v), time.UTC)
		nt.Valid = (err == nil)
		return
	case string:
		nt.Time, err = parseDateTime(v, time.UTC)
		nt.Valid = (err == nil)
		return
	}

	nt.Valid = false
	return fmt.Errorf("Can't convert %T to time.Time", value)
}

// Value implements the driver Valuer interface.
func (nt NullTime) Value() (driver.Value, error) {
	if !nt.Valid {
		return nil, nil
	}
	return nt.Time, nil
}

func parseDateTime(str string, loc *time.Location) (t time.Time, err error) {
	base := "0000-00-00 00:00:00.0000000"
	switch len(str) {
	case 10, 19, 21, 22, 23, 24, 25, 26: // up to "YYYY-MM-DD HH:MM:SS.MMMMMM"
		if str == base[:len(str)] {
			return
		}
		t, err = time.Parse(timeFormat[:len(str)], str)
	default:
		err = fmt.Errorf("invalid time string: %s", str)
		return
	}

	// Adjust location
	if err == nil && loc != time.UTC {
		y, mo, d := t.Date()
		h, mi, s := t.Clock()
		t, err = time.Date(y, mo, d, h, mi, s, t.Nanosecond(), loc), nil
	}

	return
}

func parseBinaryDateTime(num uint64, data []byte, loc *time.Location) (driver.Value, error) {
	switch num {
	case 0:
		return time.Time{}, nil
	case 4:
		return time.Date(
			int(binary.LittleEndian.Uint16(data[:2])), // year
			time.Month(data[2]),                       // month
			int(data[3]),                              // day
			0, 0, 0, 0,
			loc,
		), nil
	case 7:
		return time.Date(
			int(binary.LittleEndian.Uint16(data[:2])), // year
			time.Month(data[2]),                       // month
			int(data[3]),                              // day
			int(data[4]),                              // hour
			int(data[5]),                              // minutes
			int(data[6]),                              // seconds
			0,
			loc,
		), nil
	case 11:
		return time.Date(
			int(binary.LittleEndian.Uint16(data[:2])), // year
			time.Month(data[2]),                       // month
			int(data[3]),                              // day
			int(data[4]),                              // hour
			int(data[5]),                              // minutes
			int(data[6]),                              // seconds
			int(binary.LittleEndian.Uint32(data[7:11]))*1000, // nanoseconds
			loc,
		), nil
	}
	return nil, fmt.Errorf("invalid DATETIME packet length %d", num)
}

// zeroDateTime is used in formatBinaryDateTime to avoid an allocation
// if the DATE or DATETIME has the zero value.
// It must never be changed.
// The current behavior depends on database/sql copying the result.
var zeroDateTime = []byte("0000-00-00 00:00:00.000000")

const digits01 = "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789"
const digits10 = "0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999"

func appendMicrosecs(dst, src []byte, decimals int) []byte {
	if decimals <= 0 {
		return dst
	}
	if len(src) == 0 {
		return append(dst, ".000000"[:decimals+1]...)
	}

	microsecs := binary.LittleEndian.Uint32(src[:4])
	p1 := byte(microsecs / 10000)
	microsecs -= 10000 * uint32(p1)
	p2 := byte(microsecs / 100)
	microsecs -= 100 * uint32(p2)
	p3 := byte(microsecs)

	switch decimals {
	default:
		return append(dst, '.',
			digits10[p1], digits01[p1],
			digits10[p2], digits01[p2],
			digits10[p3], digits01[p3],
		)
	case 1:
		return append(dst, '.',
			digits10[p1],
		)
	case 2:
		return append(dst, '.',
			digits10[p1], digits01[p1],
		)
	case 3:
		return append(dst, '.',
			digits10[p1], digits01[p1],
			digits10[p2],
		)
	case 4:
		return append(dst, '.',
			digits10[p1], digits01[p1],
			digits10[p2], digits01[p2],
		)
	case 5:
		return append(dst, '.',
			digits10[p1], digits01[p1],
			digits10[p2], digits01[p2],
			digits10[p3],
		)
	}
}

func formatBinaryDateTime(src []byte, length uint8) (driver.Value, error) {
	// length expects the deterministic length of the zero value,
	// negative time and 100+ hours are automatically added if needed
	if len(src) == 0 {
		return zeroDateTime[:length], nil
	}
	var dst []byte      // return value
	var p1, p2, p3 byte // current digit pair

	switch length {
	case 10, 19, 21, 22, 23, 24, 25, 26:
	default:
		t := "DATE"
		if length > 10 {
			t += "TIME"
		}
		return nil, fmt.Errorf("illegal %s length %d", t, length)
	}
	switch len(src) {
	case 4, 7, 11:
	default:
		t := "DATE"
		if length > 10 {
			t += "TIME"
		}
		return nil, fmt.Errorf("illegal %s packet length %d", t, len(src))
	}
	dst = make([]byte, 0, length)
	// start with the date
	year := binary.LittleEndian.Uint16(src[:2])
	pt := year / 100
	p1 = byte(year - 100*uint16(pt))
	p2, p3 = src[2], src[3]
	dst = append(dst,
		digits10[pt], digits01[pt],
		digits10[p1], digits01[p1], '-',
		digits10[p2], digits01[p2], '-',
		digits10[p3], digits01[p3],
	)
	if length == 10 {
		return dst, nil
	}
	if len(src) == 4 {
		return append(dst, zeroDateTime[10:length]...), nil
	}
	dst = append(dst, ' ')
	p1 = src[4] // hour
	src = src[5:]

	// p1 is 2-digit hour, src is after hour
	p2, p3 = src[0], src[1]
	dst = append(dst,
		digits10[p1], digits01[p1], ':',
		digits10[p2], digits01[p2], ':',
		digits10[p3], digits01[p3],
	)
	return appendMicrosecs(dst, src[2:], int(length)-20), nil
}

func formatBinaryTime(src []byte, length uint8) (driver.Value, error) {
	// length expects the deterministic length of the zero value,
	// negative time and 100+ hours are automatically added if needed
	if len(src) == 0 {
		return zeroDateTime[11 : 11+length], nil
	}
	var dst []byte // return value

	switch length {
	case
		8,                      // time (can be up to 10 when negative and 100+ hours)
		10, 11, 12, 13, 14, 15: // time with fractional seconds
	default:
		return nil, fmt.Errorf("illegal TIME length %d", length)
	}
	switch len(src) {
	case 8, 12:
	default:
		return nil, fmt.Errorf("invalid TIME packet length %d", len(src))
	}
	// +2 to enable negative time and 100+ hours
	dst = make([]byte, 0, length+2)
	if src[0] == 1 {
		dst = append(dst, '-')
	}
	days := binary.LittleEndian.Uint32(src[1:5])
	hours := int64(days)*24 + int64(src[5])

	if hours >= 100 {
		dst = strconv.AppendInt(dst, hours, 10)
	} else {
		dst = append(dst, digits10[hours], digits01[hours])
	}

	min, sec := src[6], src[7]
	dst = append(dst, ':',
		digits10[min], digits01[min], ':',
		digits10[sec], digits01[sec],
	)
	return appendMicrosecs(dst, src[8:], int(length)-9), nil
}

/******************************************************************************
*                       Convert from and to bytes                             *
******************************************************************************/

func uint64ToBytes(n uint64) []byte {
	return []byte{
		byte(n),
		byte(n >> 8),
		byte(n >> 16),
		byte(n >> 24),
		byte(n >> 32),
		byte(n >> 40),
		byte(n >> 48),
		byte(n >> 56),
	}
}

func uint64ToString(n uint64) []byte {
	var a [20]byte
	i := 20

	// U+0030 = 0
	// ...
	// U+0039 = 9

	var q uint64
	for n >= 10 {
		i--
		q = n / 10
		a[i] = uint8(n-q*10) + 0x30
		n = q
	}

	i--
	a[i] = uint8(n) + 0x30

	return a[i:]
}

// treats string value as unsigned integer representation
func stringToInt(b []byte) int {
	val := 0
	for i := range b {
		val *= 10
		val += int(b[i] - 0x30)
	}
	return val
}

// returns the string read as a bytes slice, wheter the value is NULL,
// the number of bytes read and an error, in case the string is longer than
// the input slice
func readLengthEncodedString(b []byte) ([]byte, bool, int, error) {
	// Get length
	num, isNull, n := readLengthEncodedInteger(b)
	if num < 1 {
		return b[n:n], isNull, n, nil
	}

	n += int(num)

	// Check data length
	if len(b) >= n {
		return b[n-int(num) : n : n], false, n, nil
	}
	return nil, false, n, io.EOF
}

// returns the number of bytes skipped and an error, in case the string is
// longer than the input slice
func skipLengthEncodedString(b []byte) (int, error) {
	// Get length
	num, _, n := readLengthEncodedInteger(b)
	if num < 1 {
		return n, nil
	}

	n += int(num)

	// Check data length
	if len(b) >= n {
		return n, nil
	}
	return n, io.EOF
}

// returns the number read, whether the value is NULL and the number of bytes read
func readLengthEncodedInteger(b []byte) (uint64, bool, int) {
	// See issue #349
	if len(b) == 0 {
		return 0, true, 1
	}

	switch b[0] {
	// 251: NULL
	case 0xfb:
		return 0, true, 1

	// 252: value of following 2
	case 0xfc:
		return uint64(b[1]) | uint64(b[2])<<8, false, 3

	// 253: value of following 3
	case 0xfd:
		return uint64(b[1]) | uint64(b[2])<<8 | uint64(b[3])<<16, false, 4

	// 254: value of following 8
	case 0xfe:
		return uint64(b[1]) | uint64(b[2])<<8 | uint64(b[3])<<16 |
				uint64(b[4])<<24 | uint64(b[5])<<32 | uint64(b[6])<<40 |
				uint64(b[7])<<48 | uint64(b[8])<<56,
			false, 9
	}

	// 0-250: value of first byte
	return uint64(b[0]), false, 1
}

// encodes a uint64 value and appends it to the given bytes slice
func appendLengthEncodedInteger(b []byte, n uint64) []byte {
	switch {
	case n <= 250:
		return append(b, byte(n))

	case n <= 0xffff:
		return append(b, 0xfc, byte(n), byte(n>>8))

	case n <= 0xffffff:
		return append(b, 0xfd, byte(n), byte(n>>8), byte(n>>16))
	}
	return append(b, 0xfe, byte(n), byte(n>>8), byte(n>>16), byte(n>>24),
		byte(n>>32), byte(n>>40), byte(n>>48), byte(n>>56))
}

// reserveBuffer checks cap(buf) and expand buffer to len(buf) + appendSize.
// If cap(buf) is not enough, reallocate new buffer.
func reserveBuffer(buf []byte, appendSize int) []byte {
	newSize := len(buf) + appendSize
	if cap(buf) < newSize {
		// Grow buffer exponentially
		newBuf := make([]byte, len(buf)*2+appendSize)
		copy(newBuf, buf)
		buf = newBuf
	}
	return buf[:newSize]
}

// escapeBytesBackslash escapes []byte with backslashes (\)
// This escapes the contents of a string (provided as []byte) by adding backslashes before special
// characters, and turning others into specific escape sequences, such as
// turning newlines into \n and null bytes into \0.
// https://github.com/mysql/mysql-server/blob/mysql-5.7.5/mysys/charset.c#L823-L932
func escapeBytesBackslash(buf, v []byte) []byte {
	pos := len(buf)
	buf = reserveBuffer(buf, len(v)*2)

	for _, c := range v {
		switch c {
		case '\x00':
			buf[pos] = '\\'
			buf[pos+1] = '0'
			pos += 2
		case '\n':
			buf[pos] = '\\'
			buf[pos+1] = 'n'
			pos += 2
		case '\r':
			buf[pos] = '\\'
			buf[pos+1] = 'r'
			pos += 2
		case '\x1a':
			buf[pos] = '\\'
			buf[pos+1] = 'Z'
			pos += 2
		case '\'':
			buf[pos] = '\\'
			buf[pos+1] = '\''
			pos += 2
		case '"':
			buf[pos] = '\\'
			buf[pos+1] = '"'
			pos += 2
		case '\\':
			buf[pos] = '\\'
			buf[pos+1] = '\\'
			pos += 2
		default:
			buf[pos] = c
			pos++
		}
	}

	return buf[:pos]
}

// escapeStringBackslash is similar to escapeBytesBackslash but for string.
func escapeStringBackslash(buf []byte, v string) []byte {
	pos := len(buf)
	buf = reserveBuffer(buf, len(v)*2)

	for i := 0; i < len(v); i++ {
		c := v[i]
		switch c {
		case '\x00':
			buf[pos] = '\\'
			buf[pos+1] = '0'
			pos += 2
		case '\n':
			buf[pos] = '\\'
			buf[pos+1] = 'n'
			pos += 2
		case '\r':
			buf[pos] = '\\'
			buf[pos+1] = 'r'
			pos += 2
		case '\x1a':
			buf[pos] = '\\'
			buf[pos+1] = 'Z'
			pos += 2
		case '\'':
			buf[pos] = '\\'
			buf[pos+1] = '\''
			pos += 2
		case '"':
			buf[pos] = '\\'
			buf[pos+1] = '"'
			pos += 2
		case '\\':
			buf[pos] = '\\'
			buf[pos+1] = '\\'
			pos += 2
		default:
			buf[pos] = c
			pos++
		}
	}

	return buf[:pos]
}

// escapeBytesQuotes escapes apostrophes in []byte by doubling them up.
// This escapes the contents of a string by doubling up any apostrophes that
// it contains. This is used when the NO_BACKSLASH_ESCAPES SQL_MODE is in
// effect on the server.
// https://github.com/mysql/mysql-server/blob/mysql-5.7.5/mysys/charset.c#L963-L1038
func escapeBytesQuotes(buf, v []byte) []byte {
	pos := len(buf)
	buf = reserveBuffer(buf, len(v)*2)

	for _, c := range v {
		if c == '\'' {
			buf[pos] = '\''
			buf[pos+1] = '\''
			pos += 2
		} else {
			buf[pos] = c
			pos++
		}
	}

	return buf[:pos]
}

// escapeStringQuotes is similar to escapeBytesQuotes but for string.
func escapeStringQuotes(buf []byte, v string) []byte {
	pos := len(buf)
	buf = reserveBuffer(buf, len(v)*2)

	for i := 0; i < len(v); i++ {
		c := v[i]
		if c == '\'' {
			buf[pos] = '\''
			buf[pos+1] = '\''
			pos += 2
		} else {
			buf[pos] = c
			pos++
		}
	}

	return buf[:pos]
}

/******************************************************************************
*                               Sync utils                                    *
******************************************************************************/

// noCopy may be embedded into structs which must not be copied
// after the first use.
//
// See https://github.com/golang/go/issues/8005#issuecomment-190753527
// for details.
type noCopy struct{}

// Lock is a no-op used by -copylocks checker from `go vet`.
func (*noCopy) Lock() {}

// atomicBool is a wrapper around uint32 for usage as a boolean value with
// atomic access.
type atomicBool struct {
	_noCopy noCopy
	value   uint32
}

// IsSet returns wether the current boolean value is true
func (ab *atomicBool) IsSet() bool {
	return atomic.LoadUint32(&ab.value) > 0
}

// Set sets the value of the bool regardless of the previous value
func (ab *atomicBool) Set(value bool) {
	if value {
		atomic.StoreUint32(&ab.value, 1)
	} else {
		atomic.StoreUint32(&ab.value, 0)
	}
}

// TrySet sets the value of the bool and returns wether the value changed
func (ab *atomicBool) TrySet(value bool) bool {
	if value {
		return atomic.SwapUint32(&ab.value, 1) == 0
	}
	return atomic.SwapUint32(&ab.value, 0) > 0
}

// atomicError is a wrapper for atomically accessed error values
type atomicError struct {
	_noCopy noCopy
	value   atomic.Value
}

// Set sets the error value regardless of the previous value.
// The value must not be nil
func (ae *atomicError) Set(value error) {
	ae.value.Store(value)
}

// Value returns the current error value
func (ae *atomicError) Value() error {
	if v := ae.value.Load(); v != nil {
		// this will panic if the value doesn't implement the error interface
		return v.(error)
	}
	return nil
}
