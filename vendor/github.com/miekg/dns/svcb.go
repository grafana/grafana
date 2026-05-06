package dns

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"sort"
	"strconv"
	"strings"
)

// SVCBKey is the type of the keys used in the SVCB RR.
type SVCBKey uint16

// Keys defined in rfc9460
const (
	SVCB_MANDATORY SVCBKey = iota
	SVCB_ALPN
	SVCB_NO_DEFAULT_ALPN
	SVCB_PORT
	SVCB_IPV4HINT
	SVCB_ECHCONFIG
	SVCB_IPV6HINT
	SVCB_DOHPATH // rfc9461 Section 5
	SVCB_OHTTP   // rfc9540 Section 8

	svcb_RESERVED SVCBKey = 65535
)

var svcbKeyToStringMap = map[SVCBKey]string{
	SVCB_MANDATORY:       "mandatory",
	SVCB_ALPN:            "alpn",
	SVCB_NO_DEFAULT_ALPN: "no-default-alpn",
	SVCB_PORT:            "port",
	SVCB_IPV4HINT:        "ipv4hint",
	SVCB_ECHCONFIG:       "ech",
	SVCB_IPV6HINT:        "ipv6hint",
	SVCB_DOHPATH:         "dohpath",
	SVCB_OHTTP:           "ohttp",
}

var svcbStringToKeyMap = reverseSVCBKeyMap(svcbKeyToStringMap)

func reverseSVCBKeyMap(m map[SVCBKey]string) map[string]SVCBKey {
	n := make(map[string]SVCBKey, len(m))
	for u, s := range m {
		n[s] = u
	}
	return n
}

// String takes the numerical code of an SVCB key and returns its name.
// Returns an empty string for reserved keys.
// Accepts unassigned keys as well as experimental/private keys.
func (key SVCBKey) String() string {
	if x := svcbKeyToStringMap[key]; x != "" {
		return x
	}
	if key == svcb_RESERVED {
		return ""
	}
	return "key" + strconv.FormatUint(uint64(key), 10)
}

// svcbStringToKey returns the numerical code of an SVCB key.
// Returns svcb_RESERVED for reserved/invalid keys.
// Accepts unassigned keys as well as experimental/private keys.
func svcbStringToKey(s string) SVCBKey {
	if strings.HasPrefix(s, "key") {
		a, err := strconv.ParseUint(s[3:], 10, 16)
		// no leading zeros
		// key shouldn't be registered
		if err != nil || a == 65535 || s[3] == '0' || svcbKeyToStringMap[SVCBKey(a)] != "" {
			return svcb_RESERVED
		}
		return SVCBKey(a)
	}
	if key, ok := svcbStringToKeyMap[s]; ok {
		return key
	}
	return svcb_RESERVED
}

func (rr *SVCB) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{file: l.token, err: "bad SVCB priority", lex: l}
	}
	rr.Priority = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Target = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{file: l.token, err: "bad SVCB Target", lex: l}
	}
	rr.Target = name

	// Values (if any)
	l, _ = c.Next()
	var xs []SVCBKeyValue
	// Helps require whitespace between pairs.
	// Prevents key1000="a"key1001=...
	canHaveNextKey := true
	for l.value != zNewline && l.value != zEOF {
		switch l.value {
		case zString:
			if !canHaveNextKey {
				// The key we can now read was probably meant to be
				// a part of the last value.
				return &ParseError{file: l.token, err: "bad SVCB value quotation", lex: l}
			}

			// In key=value pairs, value does not have to be quoted unless value
			// contains whitespace. And keys don't need to have values.
			// Similarly, keys with an equality signs after them don't need values.
			// l.token includes at least up to the first equality sign.
			idx := strings.IndexByte(l.token, '=')
			var key, value string
			if idx < 0 {
				// Key with no value and no equality sign
				key = l.token
			} else if idx == 0 {
				return &ParseError{file: l.token, err: "bad SVCB key", lex: l}
			} else {
				key, value = l.token[:idx], l.token[idx+1:]

				if value == "" {
					// We have a key and an equality sign. Maybe we have nothing
					// after "=" or we have a double quote.
					l, _ = c.Next()
					if l.value == zQuote {
						// Only needed when value ends with double quotes.
						// Any value starting with zQuote ends with it.
						canHaveNextKey = false

						l, _ = c.Next()
						switch l.value {
						case zString:
							// We have a value in double quotes.
							value = l.token
							l, _ = c.Next()
							if l.value != zQuote {
								return &ParseError{file: l.token, err: "SVCB unterminated value", lex: l}
							}
						case zQuote:
							// There's nothing in double quotes.
						default:
							return &ParseError{file: l.token, err: "bad SVCB value", lex: l}
						}
					}
				}
			}
			kv := makeSVCBKeyValue(svcbStringToKey(key))
			if kv == nil {
				return &ParseError{file: l.token, err: "bad SVCB key", lex: l}
			}
			if err := kv.parse(value); err != nil {
				return &ParseError{file: l.token, wrappedErr: err, lex: l}
			}
			xs = append(xs, kv)
		case zQuote:
			return &ParseError{file: l.token, err: "SVCB key can't contain double quotes", lex: l}
		case zBlank:
			canHaveNextKey = true
		default:
			return &ParseError{file: l.token, err: "bad SVCB values", lex: l}
		}
		l, _ = c.Next()
	}

	// "In AliasMode, records SHOULD NOT include any SvcParams, and recipients MUST
	// ignore any SvcParams that are present."
	// However, we don't check rr.Priority == 0 && len(xs) > 0 here
	// It is the responsibility of the user of the library to check this.
	// This is to encourage the fixing of the source of this error.

	rr.Value = xs
	return nil
}

// makeSVCBKeyValue returns an SVCBKeyValue struct with the key or nil for reserved keys.
func makeSVCBKeyValue(key SVCBKey) SVCBKeyValue {
	switch key {
	case SVCB_MANDATORY:
		return new(SVCBMandatory)
	case SVCB_ALPN:
		return new(SVCBAlpn)
	case SVCB_NO_DEFAULT_ALPN:
		return new(SVCBNoDefaultAlpn)
	case SVCB_PORT:
		return new(SVCBPort)
	case SVCB_IPV4HINT:
		return new(SVCBIPv4Hint)
	case SVCB_ECHCONFIG:
		return new(SVCBECHConfig)
	case SVCB_IPV6HINT:
		return new(SVCBIPv6Hint)
	case SVCB_DOHPATH:
		return new(SVCBDoHPath)
	case SVCB_OHTTP:
		return new(SVCBOhttp)
	case svcb_RESERVED:
		return nil
	default:
		e := new(SVCBLocal)
		e.KeyCode = key
		return e
	}
}

// SVCB RR. See RFC xxxx (https://tools.ietf.org/html/draft-ietf-dnsop-svcb-https-08).
//
// NOTE: The HTTPS/SVCB RFCs are in the draft stage.
// The API, including constants and types related to SVCBKeyValues, may
// change in future versions in accordance with the latest drafts.
type SVCB struct {
	Hdr      RR_Header
	Priority uint16         // If zero, Value must be empty or discarded by the user of this library
	Target   string         `dns:"domain-name"`
	Value    []SVCBKeyValue `dns:"pairs"`
}

// HTTPS RR. Everything valid for SVCB applies to HTTPS as well.
// Except that the HTTPS record is intended for use with the HTTP and HTTPS protocols.
//
// NOTE: The HTTPS/SVCB RFCs are in the draft stage.
// The API, including constants and types related to SVCBKeyValues, may
// change in future versions in accordance with the latest drafts.
type HTTPS struct {
	SVCB
}

func (rr *HTTPS) String() string {
	return rr.SVCB.String()
}

func (rr *HTTPS) parse(c *zlexer, o string) *ParseError {
	return rr.SVCB.parse(c, o)
}

// SVCBKeyValue defines a key=value pair for the SVCB RR type.
// An SVCB RR can have multiple SVCBKeyValues appended to it.
type SVCBKeyValue interface {
	Key() SVCBKey          // Key returns the numerical key code.
	pack() ([]byte, error) // pack returns the encoded value.
	unpack([]byte) error   // unpack sets the value.
	String() string        // String returns the string representation of the value.
	parse(string) error    // parse sets the value to the given string representation of the value.
	copy() SVCBKeyValue    // copy returns a deep-copy of the pair.
	len() int              // len returns the length of value in the wire format.
}

// SVCBMandatory pair adds to required keys that must be interpreted for the RR
// to be functional. If ignored, the whole RRSet must be ignored.
// "port" and "no-default-alpn" are mandatory by default if present,
// so they shouldn't be included here.
//
// It is incumbent upon the user of this library to reject the RRSet if
// or avoid constructing such an RRSet that:
// - "mandatory" is included as one of the keys of mandatory
// - no key is listed multiple times in mandatory
// - all keys listed in mandatory are present
// - escape sequences are not used in mandatory
// - mandatory, when present, lists at least one key
//
// Basic use pattern for creating a mandatory option:
//
//	s := &dns.SVCB{Hdr: dns.RR_Header{Name: ".", Rrtype: dns.TypeSVCB, Class: dns.ClassINET}}
//	e := new(dns.SVCBMandatory)
//	e.Code = []uint16{dns.SVCB_ALPN}
//	s.Value = append(s.Value, e)
//	t := new(dns.SVCBAlpn)
//	t.Alpn = []string{"xmpp-client"}
//	s.Value = append(s.Value, t)
type SVCBMandatory struct {
	Code []SVCBKey
}

func (*SVCBMandatory) Key() SVCBKey { return SVCB_MANDATORY }

func (s *SVCBMandatory) String() string {
	str := make([]string, len(s.Code))
	for i, e := range s.Code {
		str[i] = e.String()
	}
	return strings.Join(str, ",")
}

func (s *SVCBMandatory) pack() ([]byte, error) {
	codes := cloneSlice(s.Code)
	sort.Slice(codes, func(i, j int) bool {
		return codes[i] < codes[j]
	})
	b := make([]byte, 2*len(codes))
	for i, e := range codes {
		binary.BigEndian.PutUint16(b[2*i:], uint16(e))
	}
	return b, nil
}

func (s *SVCBMandatory) unpack(b []byte) error {
	if len(b)%2 != 0 {
		return errors.New("dns: svcbmandatory: value length is not a multiple of 2")
	}
	codes := make([]SVCBKey, 0, len(b)/2)
	for i := 0; i < len(b); i += 2 {
		// We assume strictly increasing order.
		codes = append(codes, SVCBKey(binary.BigEndian.Uint16(b[i:])))
	}
	s.Code = codes
	return nil
}

func (s *SVCBMandatory) parse(b string) error {
	codes := make([]SVCBKey, 0, strings.Count(b, ",")+1)
	for len(b) > 0 {
		var key string
		key, b, _ = strings.Cut(b, ",")
		codes = append(codes, svcbStringToKey(key))
	}
	s.Code = codes
	return nil
}

func (s *SVCBMandatory) len() int {
	return 2 * len(s.Code)
}

func (s *SVCBMandatory) copy() SVCBKeyValue {
	return &SVCBMandatory{cloneSlice(s.Code)}
}

// SVCBAlpn pair is used to list supported connection protocols.
// The user of this library must ensure that at least one protocol is listed when alpn is present.
// Protocol IDs can be found at:
// https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids
// Basic use pattern for creating an alpn option:
//
//	h := new(dns.HTTPS)
//	h.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeHTTPS, Class: dns.ClassINET}
//	e := new(dns.SVCBAlpn)
//	e.Alpn = []string{"h2", "http/1.1"}
//	h.Value = append(h.Value, e)
type SVCBAlpn struct {
	Alpn []string
}

func (*SVCBAlpn) Key() SVCBKey { return SVCB_ALPN }

func (s *SVCBAlpn) String() string {
	// An ALPN value is a comma-separated list of values, each of which can be
	// an arbitrary binary value. In order to allow parsing, the comma and
	// backslash characters are themselves escaped.
	//
	// However, this escaping is done in addition to the normal escaping which
	// happens in zone files, meaning that these values must be
	// double-escaped. This looks terrible, so if you see a never-ending
	// sequence of backslash in a zone file this may be why.
	//
	// https://datatracker.ietf.org/doc/html/draft-ietf-dnsop-svcb-https-08#appendix-A.1
	var str strings.Builder
	for i, alpn := range s.Alpn {
		// 4*len(alpn) is the worst case where we escape every character in the alpn as \123, plus 1 byte for the ',' separating the alpn from others
		str.Grow(4*len(alpn) + 1)
		if i > 0 {
			str.WriteByte(',')
		}
		for j := 0; j < len(alpn); j++ {
			e := alpn[j]
			if ' ' > e || e > '~' {
				str.WriteString(escapeByte(e))
				continue
			}
			switch e {
			// We escape a few characters which may confuse humans or parsers.
			case '"', ';', ' ':
				str.WriteByte('\\')
				str.WriteByte(e)
			// The comma and backslash characters themselves must be
			// doubly-escaped. We use `\\` for the first backslash and
			// the escaped numeric value for the other value. We especially
			// don't want a comma in the output.
			case ',':
				str.WriteString(`\\\044`)
			case '\\':
				str.WriteString(`\\\092`)
			default:
				str.WriteByte(e)
			}
		}
	}
	return str.String()
}

func (s *SVCBAlpn) pack() ([]byte, error) {
	// Liberally estimate the size of an alpn as 10 octets
	b := make([]byte, 0, 10*len(s.Alpn))
	for _, e := range s.Alpn {
		if e == "" {
			return nil, errors.New("dns: svcbalpn: empty alpn-id")
		}
		if len(e) > 255 {
			return nil, errors.New("dns: svcbalpn: alpn-id too long")
		}
		b = append(b, byte(len(e)))
		b = append(b, e...)
	}
	return b, nil
}

func (s *SVCBAlpn) unpack(b []byte) error {
	// Estimate the size of the smallest alpn as 4 bytes
	alpn := make([]string, 0, len(b)/4)
	for i := 0; i < len(b); {
		length := int(b[i])
		i++
		if i+length > len(b) {
			return errors.New("dns: svcbalpn: alpn array overflowing")
		}
		alpn = append(alpn, string(b[i:i+length]))
		i += length
	}
	s.Alpn = alpn
	return nil
}

func (s *SVCBAlpn) parse(b string) error {
	if len(b) == 0 {
		s.Alpn = []string{}
		return nil
	}

	alpn := []string{}
	a := []byte{}
	for p := 0; p < len(b); {
		c, q := nextByte(b, p)
		if q == 0 {
			return errors.New("dns: svcbalpn: unterminated escape")
		}
		p += q
		// If we find a comma, we have finished reading an alpn.
		if c == ',' {
			if len(a) == 0 {
				return errors.New("dns: svcbalpn: empty protocol identifier")
			}
			alpn = append(alpn, string(a))
			a = []byte{}
			continue
		}
		// If it's a backslash, we need to handle a comma-separated list.
		if c == '\\' {
			dc, dq := nextByte(b, p)
			if dq == 0 {
				return errors.New("dns: svcbalpn: unterminated escape decoding comma-separated list")
			}
			if dc != '\\' && dc != ',' {
				return errors.New("dns: svcbalpn: bad escaped character decoding comma-separated list")
			}
			p += dq
			c = dc
		}
		a = append(a, c)
	}
	// Add the final alpn.
	if len(a) == 0 {
		return errors.New("dns: svcbalpn: last protocol identifier empty")
	}
	s.Alpn = append(alpn, string(a))
	return nil
}

func (s *SVCBAlpn) len() int {
	var l int
	for _, e := range s.Alpn {
		l += 1 + len(e)
	}
	return l
}

func (s *SVCBAlpn) copy() SVCBKeyValue {
	return &SVCBAlpn{cloneSlice(s.Alpn)}
}

// SVCBNoDefaultAlpn pair signifies no support for default connection protocols.
// Should be used in conjunction with alpn.
// Basic use pattern for creating a no-default-alpn option:
//
//	s := &dns.SVCB{Hdr: dns.RR_Header{Name: ".", Rrtype: dns.TypeSVCB, Class: dns.ClassINET}}
//	t := new(dns.SVCBAlpn)
//	t.Alpn = []string{"xmpp-client"}
//	s.Value = append(s.Value, t)
//	e := new(dns.SVCBNoDefaultAlpn)
//	s.Value = append(s.Value, e)
type SVCBNoDefaultAlpn struct{}

func (*SVCBNoDefaultAlpn) Key() SVCBKey          { return SVCB_NO_DEFAULT_ALPN }
func (*SVCBNoDefaultAlpn) copy() SVCBKeyValue    { return &SVCBNoDefaultAlpn{} }
func (*SVCBNoDefaultAlpn) pack() ([]byte, error) { return []byte{}, nil }
func (*SVCBNoDefaultAlpn) String() string        { return "" }
func (*SVCBNoDefaultAlpn) len() int              { return 0 }

func (*SVCBNoDefaultAlpn) unpack(b []byte) error {
	if len(b) != 0 {
		return errors.New("dns: svcbnodefaultalpn: no-default-alpn must have no value")
	}
	return nil
}

func (*SVCBNoDefaultAlpn) parse(b string) error {
	if b != "" {
		return errors.New("dns: svcbnodefaultalpn: no-default-alpn must have no value")
	}
	return nil
}

// SVCBPort pair defines the port for connection.
// Basic use pattern for creating a port option:
//
//	s := &dns.SVCB{Hdr: dns.RR_Header{Name: ".", Rrtype: dns.TypeSVCB, Class: dns.ClassINET}}
//	e := new(dns.SVCBPort)
//	e.Port = 80
//	s.Value = append(s.Value, e)
type SVCBPort struct {
	Port uint16
}

func (*SVCBPort) Key() SVCBKey         { return SVCB_PORT }
func (*SVCBPort) len() int             { return 2 }
func (s *SVCBPort) String() string     { return strconv.FormatUint(uint64(s.Port), 10) }
func (s *SVCBPort) copy() SVCBKeyValue { return &SVCBPort{s.Port} }

func (s *SVCBPort) unpack(b []byte) error {
	if len(b) != 2 {
		return errors.New("dns: svcbport: port length is not exactly 2 octets")
	}
	s.Port = binary.BigEndian.Uint16(b)
	return nil
}

func (s *SVCBPort) pack() ([]byte, error) {
	b := make([]byte, 2)
	binary.BigEndian.PutUint16(b, s.Port)
	return b, nil
}

func (s *SVCBPort) parse(b string) error {
	port, err := strconv.ParseUint(b, 10, 16)
	if err != nil {
		return errors.New("dns: svcbport: port out of range")
	}
	s.Port = uint16(port)
	return nil
}

// SVCBIPv4Hint pair suggests an IPv4 address which may be used to open connections
// if A and AAAA record responses for SVCB's Target domain haven't been received.
// In that case, optionally, A and AAAA requests can be made, after which the connection
// to the hinted IP address may be terminated and a new connection may be opened.
// Basic use pattern for creating an ipv4hint option:
//
//		h := new(dns.HTTPS)
//		h.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeHTTPS, Class: dns.ClassINET}
//		e := new(dns.SVCBIPv4Hint)
//		e.Hint = []net.IP{net.IPv4(1,1,1,1).To4()}
//
//	 Or
//
//		e.Hint = []net.IP{net.ParseIP("1.1.1.1").To4()}
//		h.Value = append(h.Value, e)
type SVCBIPv4Hint struct {
	Hint []net.IP
}

func (*SVCBIPv4Hint) Key() SVCBKey { return SVCB_IPV4HINT }
func (s *SVCBIPv4Hint) len() int   { return 4 * len(s.Hint) }

func (s *SVCBIPv4Hint) pack() ([]byte, error) {
	b := make([]byte, 0, 4*len(s.Hint))
	for _, e := range s.Hint {
		x := e.To4()
		if x == nil {
			return nil, errors.New("dns: svcbipv4hint: expected ipv4, hint is ipv6")
		}
		b = append(b, x...)
	}
	return b, nil
}

func (s *SVCBIPv4Hint) unpack(b []byte) error {
	if len(b) == 0 || len(b)%4 != 0 {
		return errors.New("dns: svcbipv4hint: ipv4 address byte array length is not a multiple of 4")
	}
	b = cloneSlice(b)
	x := make([]net.IP, 0, len(b)/4)
	for i := 0; i < len(b); i += 4 {
		x = append(x, net.IP(b[i:i+4]))
	}
	s.Hint = x
	return nil
}

func (s *SVCBIPv4Hint) String() string {
	str := make([]string, len(s.Hint))
	for i, e := range s.Hint {
		x := e.To4()
		if x == nil {
			return "<nil>"
		}
		str[i] = x.String()
	}
	return strings.Join(str, ",")
}

func (s *SVCBIPv4Hint) parse(b string) error {
	if b == "" {
		return errors.New("dns: svcbipv4hint: empty hint")
	}
	if strings.Contains(b, ":") {
		return errors.New("dns: svcbipv4hint: expected ipv4, got ipv6")
	}

	hint := make([]net.IP, 0, strings.Count(b, ",")+1)
	for len(b) > 0 {
		var e string
		e, b, _ = strings.Cut(b, ",")
		ip := net.ParseIP(e).To4()
		if ip == nil {
			return errors.New("dns: svcbipv4hint: bad ip")
		}
		hint = append(hint, ip)
	}
	s.Hint = hint
	return nil
}

func (s *SVCBIPv4Hint) copy() SVCBKeyValue {
	hint := make([]net.IP, len(s.Hint))
	for i, ip := range s.Hint {
		hint[i] = cloneSlice(ip)
	}
	return &SVCBIPv4Hint{Hint: hint}
}

// SVCBECHConfig pair contains the ECHConfig structure defined in draft-ietf-tls-esni [RFC xxxx].
// Basic use pattern for creating an ech option:
//
//	h := new(dns.HTTPS)
//	h.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeHTTPS, Class: dns.ClassINET}
//	e := new(dns.SVCBECHConfig)
//	e.ECH = []byte{0xfe, 0x08, ...}
//	h.Value = append(h.Value, e)
type SVCBECHConfig struct {
	ECH []byte // Specifically ECHConfigList including the redundant length prefix
}

func (*SVCBECHConfig) Key() SVCBKey     { return SVCB_ECHCONFIG }
func (s *SVCBECHConfig) String() string { return toBase64(s.ECH) }
func (s *SVCBECHConfig) len() int       { return len(s.ECH) }

func (s *SVCBECHConfig) pack() ([]byte, error) {
	return cloneSlice(s.ECH), nil
}

func (s *SVCBECHConfig) copy() SVCBKeyValue {
	return &SVCBECHConfig{cloneSlice(s.ECH)}
}

func (s *SVCBECHConfig) unpack(b []byte) error {
	s.ECH = cloneSlice(b)
	return nil
}

func (s *SVCBECHConfig) parse(b string) error {
	x, err := fromBase64([]byte(b))
	if err != nil {
		return errors.New("dns: svcbech: bad base64 ech")
	}
	s.ECH = x
	return nil
}

// SVCBIPv6Hint pair suggests an IPv6 address which may be used to open connections
// if A and AAAA record responses for SVCB's Target domain haven't been received.
// In that case, optionally, A and AAAA requests can be made, after which the
// connection to the hinted IP address may be terminated and a new connection may be opened.
// Basic use pattern for creating an ipv6hint option:
//
//	h := new(dns.HTTPS)
//	h.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeHTTPS, Class: dns.ClassINET}
//	e := new(dns.SVCBIPv6Hint)
//	e.Hint = []net.IP{net.ParseIP("2001:db8::1")}
//	h.Value = append(h.Value, e)
type SVCBIPv6Hint struct {
	Hint []net.IP
}

func (*SVCBIPv6Hint) Key() SVCBKey { return SVCB_IPV6HINT }
func (s *SVCBIPv6Hint) len() int   { return 16 * len(s.Hint) }

func (s *SVCBIPv6Hint) pack() ([]byte, error) {
	b := make([]byte, 0, 16*len(s.Hint))
	for _, e := range s.Hint {
		if len(e) != net.IPv6len || e.To4() != nil {
			return nil, errors.New("dns: svcbipv6hint: expected ipv6, hint is ipv4")
		}
		b = append(b, e...)
	}
	return b, nil
}

func (s *SVCBIPv6Hint) unpack(b []byte) error {
	if len(b) == 0 || len(b)%16 != 0 {
		return errors.New("dns: svcbipv6hint: ipv6 address byte array length not a multiple of 16")
	}
	b = cloneSlice(b)
	x := make([]net.IP, 0, len(b)/16)
	for i := 0; i < len(b); i += 16 {
		ip := net.IP(b[i : i+16])
		if ip.To4() != nil {
			return errors.New("dns: svcbipv6hint: expected ipv6, got ipv4")
		}
		x = append(x, ip)
	}
	s.Hint = x
	return nil
}

func (s *SVCBIPv6Hint) String() string {
	str := make([]string, len(s.Hint))
	for i, e := range s.Hint {
		if x := e.To4(); x != nil {
			return "<nil>"
		}
		str[i] = e.String()
	}
	return strings.Join(str, ",")
}

func (s *SVCBIPv6Hint) parse(b string) error {
	if b == "" {
		return errors.New("dns: svcbipv6hint: empty hint")
	}

	hint := make([]net.IP, 0, strings.Count(b, ",")+1)
	for len(b) > 0 {
		var e string
		e, b, _ = strings.Cut(b, ",")
		ip := net.ParseIP(e)
		if ip == nil {
			return errors.New("dns: svcbipv6hint: bad ip")
		}
		if ip.To4() != nil {
			return errors.New("dns: svcbipv6hint: expected ipv6, got ipv4-mapped-ipv6")
		}
		hint = append(hint, ip)
	}
	s.Hint = hint
	return nil
}

func (s *SVCBIPv6Hint) copy() SVCBKeyValue {
	hint := make([]net.IP, len(s.Hint))
	for i, ip := range s.Hint {
		hint[i] = cloneSlice(ip)
	}
	return &SVCBIPv6Hint{Hint: hint}
}

// SVCBDoHPath pair is used to indicate the URI template that the
// clients may use to construct a DNS over HTTPS URI.
//
// See RFC 9461 (https://datatracker.ietf.org/doc/html/rfc9461)
// and RFC 9462 (https://datatracker.ietf.org/doc/html/rfc9462).
//
// A basic example of using the dohpath option together with the alpn
// option to indicate support for DNS over HTTPS on a certain path:
//
//	s := new(dns.SVCB)
//	s.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeSVCB, Class: dns.ClassINET}
//	e := new(dns.SVCBAlpn)
//	e.Alpn = []string{"h2", "h3"}
//	p := new(dns.SVCBDoHPath)
//	p.Template = "/dns-query{?dns}"
//	s.Value = append(s.Value, e, p)
//
// The parsing currently doesn't validate that Template is a valid
// RFC 6570 URI template.
type SVCBDoHPath struct {
	Template string
}

func (*SVCBDoHPath) Key() SVCBKey            { return SVCB_DOHPATH }
func (s *SVCBDoHPath) String() string        { return svcbParamToStr([]byte(s.Template)) }
func (s *SVCBDoHPath) len() int              { return len(s.Template) }
func (s *SVCBDoHPath) pack() ([]byte, error) { return []byte(s.Template), nil }

func (s *SVCBDoHPath) unpack(b []byte) error {
	s.Template = string(b)
	return nil
}

func (s *SVCBDoHPath) parse(b string) error {
	template, err := svcbParseParam(b)
	if err != nil {
		return fmt.Errorf("dns: svcbdohpath: %w", err)
	}
	s.Template = string(template)
	return nil
}

func (s *SVCBDoHPath) copy() SVCBKeyValue {
	return &SVCBDoHPath{
		Template: s.Template,
	}
}

// The "ohttp" SvcParamKey is used to indicate that a service described in a SVCB RR
// can be accessed as a target using an associated gateway.
// Both the presentation and wire-format values for the "ohttp" parameter MUST be empty.
//
// See RFC 9460 (https://datatracker.ietf.org/doc/html/rfc9460/)
// and RFC 9230 (https://datatracker.ietf.org/doc/html/rfc9230/)
//
// A basic example of using the dohpath option together with the alpn
// option to indicate support for DNS over HTTPS on a certain path:
//
//	s := new(dns.SVCB)
//	s.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeSVCB, Class: dns.ClassINET}
//	e := new(dns.SVCBAlpn)
//	e.Alpn = []string{"h2", "h3"}
//	p := new(dns.SVCBOhttp)
//	s.Value = append(s.Value, e, p)
type SVCBOhttp struct{}

func (*SVCBOhttp) Key() SVCBKey          { return SVCB_OHTTP }
func (*SVCBOhttp) copy() SVCBKeyValue    { return &SVCBOhttp{} }
func (*SVCBOhttp) pack() ([]byte, error) { return []byte{}, nil }
func (*SVCBOhttp) String() string        { return "" }
func (*SVCBOhttp) len() int              { return 0 }

func (*SVCBOhttp) unpack(b []byte) error {
	if len(b) != 0 {
		return errors.New("dns: svcbotthp: svcbotthp must have no value")
	}
	return nil
}

func (*SVCBOhttp) parse(b string) error {
	if b != "" {
		return errors.New("dns: svcbotthp: svcbotthp must have no value")
	}
	return nil
}

// SVCBLocal pair is intended for experimental/private use. The key is recommended
// to be in the range [SVCB_PRIVATE_LOWER, SVCB_PRIVATE_UPPER].
// Basic use pattern for creating a keyNNNNN option:
//
//	h := new(dns.HTTPS)
//	h.Hdr = dns.RR_Header{Name: ".", Rrtype: dns.TypeHTTPS, Class: dns.ClassINET}
//	e := new(dns.SVCBLocal)
//	e.KeyCode = 65400
//	e.Data = []byte("abc")
//	h.Value = append(h.Value, e)
type SVCBLocal struct {
	KeyCode SVCBKey // Never 65535 or any assigned keys.
	Data    []byte  // All byte sequences are allowed.
}

func (s *SVCBLocal) Key() SVCBKey          { return s.KeyCode }
func (s *SVCBLocal) String() string        { return svcbParamToStr(s.Data) }
func (s *SVCBLocal) pack() ([]byte, error) { return cloneSlice(s.Data), nil }
func (s *SVCBLocal) len() int              { return len(s.Data) }

func (s *SVCBLocal) unpack(b []byte) error {
	s.Data = cloneSlice(b)
	return nil
}

func (s *SVCBLocal) parse(b string) error {
	data, err := svcbParseParam(b)
	if err != nil {
		return fmt.Errorf("dns: svcblocal: svcb private/experimental key %w", err)
	}
	s.Data = data
	return nil
}

func (s *SVCBLocal) copy() SVCBKeyValue {
	return &SVCBLocal{s.KeyCode, cloneSlice(s.Data)}
}

func (rr *SVCB) String() string {
	s := rr.Hdr.String() +
		strconv.Itoa(int(rr.Priority)) + " " +
		sprintName(rr.Target)
	for _, e := range rr.Value {
		s += " " + e.Key().String() + "=\"" + e.String() + "\""
	}
	return s
}

// areSVCBPairArraysEqual checks if SVCBKeyValue arrays are equal after sorting their
// copies. arrA and arrB have equal lengths, otherwise zduplicate.go wouldn't call this function.
func areSVCBPairArraysEqual(a []SVCBKeyValue, b []SVCBKeyValue) bool {
	a = cloneSlice(a)
	b = cloneSlice(b)
	sort.Slice(a, func(i, j int) bool { return a[i].Key() < a[j].Key() })
	sort.Slice(b, func(i, j int) bool { return b[i].Key() < b[j].Key() })
	for i, e := range a {
		if e.Key() != b[i].Key() {
			return false
		}
		b1, err1 := e.pack()
		b2, err2 := b[i].pack()
		if err1 != nil || err2 != nil || !bytes.Equal(b1, b2) {
			return false
		}
	}
	return true
}

// svcbParamStr converts the value of an SVCB parameter into a DNS presentation-format string.
func svcbParamToStr(s []byte) string {
	var str strings.Builder
	str.Grow(4 * len(s))
	for _, e := range s {
		if ' ' <= e && e <= '~' {
			switch e {
			case '"', ';', ' ', '\\':
				str.WriteByte('\\')
				str.WriteByte(e)
			default:
				str.WriteByte(e)
			}
		} else {
			str.WriteString(escapeByte(e))
		}
	}
	return str.String()
}

// svcbParseParam parses a DNS presentation-format string into an SVCB parameter value.
func svcbParseParam(b string) ([]byte, error) {
	data := make([]byte, 0, len(b))
	for i := 0; i < len(b); {
		if b[i] != '\\' {
			data = append(data, b[i])
			i++
			continue
		}
		if i+1 == len(b) {
			return nil, errors.New("escape unterminated")
		}
		if isDigit(b[i+1]) {
			if i+3 < len(b) && isDigit(b[i+2]) && isDigit(b[i+3]) {
				a, err := strconv.ParseUint(b[i+1:i+4], 10, 8)
				if err == nil {
					i += 4
					data = append(data, byte(a))
					continue
				}
			}
			return nil, errors.New("bad escaped octet")
		} else {
			data = append(data, b[i+1])
			i += 2
		}
	}
	return data, nil
}
