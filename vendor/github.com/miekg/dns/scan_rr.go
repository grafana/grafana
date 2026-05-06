package dns

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"
)

// A remainder of the rdata with embedded spaces, return the parsed string (sans the spaces)
// or an error
func endingToString(c *zlexer, errstr string) (string, *ParseError) {
	var s strings.Builder
	l, _ := c.Next() // zString
	for l.value != zNewline && l.value != zEOF {
		if l.err {
			return s.String(), &ParseError{err: errstr, lex: l}
		}
		switch l.value {
		case zString:
			s.WriteString(l.token)
		case zBlank: // Ok
		default:
			return "", &ParseError{err: errstr, lex: l}
		}
		l, _ = c.Next()
	}

	return s.String(), nil
}

// A remainder of the rdata with embedded spaces, split on unquoted whitespace
// and return the parsed string slice or an error
func endingToTxtSlice(c *zlexer, errstr string) ([]string, *ParseError) {
	// Get the remaining data until we see a zNewline
	l, _ := c.Next()
	if l.err {
		return nil, &ParseError{err: errstr, lex: l}
	}

	// Build the slice
	s := make([]string, 0)
	quote := false
	empty := false
	for l.value != zNewline && l.value != zEOF {
		if l.err {
			return nil, &ParseError{err: errstr, lex: l}
		}
		switch l.value {
		case zString:
			empty = false
			// split up tokens that are larger than 255 into 255-chunks
			sx := []string{}
			p := 0
			for {
				i, ok := escapedStringOffset(l.token[p:], 255)
				if !ok {
					return nil, &ParseError{err: errstr, lex: l}
				}
				if i != -1 && p+i != len(l.token) {
					sx = append(sx, l.token[p:p+i])
				} else {
					sx = append(sx, l.token[p:])
					break

				}
				p += i
			}
			s = append(s, sx...)
		case zBlank:
			if quote {
				// zBlank can only be seen in between txt parts.
				return nil, &ParseError{err: errstr, lex: l}
			}
		case zQuote:
			if empty && quote {
				s = append(s, "")
			}
			quote = !quote
			empty = true
		default:
			return nil, &ParseError{err: errstr, lex: l}
		}
		l, _ = c.Next()
	}

	if quote {
		return nil, &ParseError{err: errstr, lex: l}
	}

	return s, nil
}

func (rr *A) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	rr.A = net.ParseIP(l.token)
	// IPv4 addresses cannot include ":".
	// We do this rather than use net.IP's To4() because
	// To4() treats IPv4-mapped IPv6 addresses as being
	// IPv4.
	isIPv4 := !strings.Contains(l.token, ":")
	if rr.A == nil || !isIPv4 || l.err {
		return &ParseError{err: "bad A A", lex: l}
	}
	return slurpRemainder(c)
}

func (rr *AAAA) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	rr.AAAA = net.ParseIP(l.token)
	// IPv6 addresses must include ":", and IPv4
	// addresses cannot include ":".
	isIPv6 := strings.Contains(l.token, ":")
	if rr.AAAA == nil || !isIPv6 || l.err {
		return &ParseError{err: "bad AAAA AAAA", lex: l}
	}
	return slurpRemainder(c)
}

func (rr *NS) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad NS Ns", lex: l}
	}
	rr.Ns = name
	return slurpRemainder(c)
}

func (rr *PTR) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad PTR Ptr", lex: l}
	}
	rr.Ptr = name
	return slurpRemainder(c)
}

func (rr *NSAPPTR) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad NSAP-PTR Ptr", lex: l}
	}
	rr.Ptr = name
	return slurpRemainder(c)
}

func (rr *RP) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	mbox, mboxOk := toAbsoluteName(l.token, o)
	if l.err || !mboxOk {
		return &ParseError{err: "bad RP Mbox", lex: l}
	}
	rr.Mbox = mbox

	c.Next() // zBlank
	l, _ = c.Next()
	rr.Txt = l.token

	txt, txtOk := toAbsoluteName(l.token, o)
	if l.err || !txtOk {
		return &ParseError{err: "bad RP Txt", lex: l}
	}
	rr.Txt = txt

	return slurpRemainder(c)
}

func (rr *MR) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad MR Mr", lex: l}
	}
	rr.Mr = name
	return slurpRemainder(c)
}

func (rr *MB) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad MB Mb", lex: l}
	}
	rr.Mb = name
	return slurpRemainder(c)
}

func (rr *MG) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad MG Mg", lex: l}
	}
	rr.Mg = name
	return slurpRemainder(c)
}

func (rr *HINFO) parse(c *zlexer, o string) *ParseError {
	chunks, e := endingToTxtSlice(c, "bad HINFO Fields")
	if e != nil {
		return e
	}

	if ln := len(chunks); ln == 0 {
		return nil
	} else if ln == 1 {
		// Can we split it?
		if out := strings.Fields(chunks[0]); len(out) > 1 {
			chunks = out
		} else {
			chunks = append(chunks, "")
		}
	}

	rr.Cpu = chunks[0]
	rr.Os = strings.Join(chunks[1:], " ")
	return nil
}

// according to RFC 1183 the parsing is identical to HINFO, so just use that code.
func (rr *ISDN) parse(c *zlexer, o string) *ParseError {
	chunks, e := endingToTxtSlice(c, "bad ISDN Fields")
	if e != nil {
		return e
	}

	if ln := len(chunks); ln == 0 {
		return nil
	} else if ln == 1 {
		// Can we split it?
		if out := strings.Fields(chunks[0]); len(out) > 1 {
			chunks = out
		} else {
			chunks = append(chunks, "")
		}
	}

	rr.Address = chunks[0]
	rr.SubAddress = strings.Join(chunks[1:], " ")

	return nil
}

func (rr *MINFO) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	rmail, rmailOk := toAbsoluteName(l.token, o)
	if l.err || !rmailOk {
		return &ParseError{err: "bad MINFO Rmail", lex: l}
	}
	rr.Rmail = rmail

	c.Next() // zBlank
	l, _ = c.Next()
	rr.Email = l.token

	email, emailOk := toAbsoluteName(l.token, o)
	if l.err || !emailOk {
		return &ParseError{err: "bad MINFO Email", lex: l}
	}
	rr.Email = email

	return slurpRemainder(c)
}

func (rr *MF) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad MF Mf", lex: l}
	}
	rr.Mf = name
	return slurpRemainder(c)
}

func (rr *MD) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad MD Md", lex: l}
	}
	rr.Md = name
	return slurpRemainder(c)
}

func (rr *MX) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad MX Pref", lex: l}
	}
	rr.Preference = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Mx = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad MX Mx", lex: l}
	}
	rr.Mx = name

	return slurpRemainder(c)
}

func (rr *RT) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil {
		return &ParseError{err: "bad RT Preference", lex: l}
	}
	rr.Preference = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Host = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad RT Host", lex: l}
	}
	rr.Host = name

	return slurpRemainder(c)
}

func (rr *AFSDB) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad AFSDB Subtype", lex: l}
	}
	rr.Subtype = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Hostname = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad AFSDB Hostname", lex: l}
	}
	rr.Hostname = name
	return slurpRemainder(c)
}

func (rr *X25) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	if l.err {
		return &ParseError{err: "bad X25 PSDNAddress", lex: l}
	}
	rr.PSDNAddress = l.token
	return slurpRemainder(c)
}

func (rr *KX) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad KX Pref", lex: l}
	}
	rr.Preference = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Exchanger = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad KX Exchanger", lex: l}
	}
	rr.Exchanger = name
	return slurpRemainder(c)
}

func (rr *CNAME) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad CNAME Target", lex: l}
	}
	rr.Target = name
	return slurpRemainder(c)
}

func (rr *DNAME) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad DNAME Target", lex: l}
	}
	rr.Target = name
	return slurpRemainder(c)
}

func (rr *SOA) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	ns, nsOk := toAbsoluteName(l.token, o)
	if l.err || !nsOk {
		return &ParseError{err: "bad SOA Ns", lex: l}
	}
	rr.Ns = ns

	c.Next() // zBlank
	l, _ = c.Next()
	rr.Mbox = l.token

	mbox, mboxOk := toAbsoluteName(l.token, o)
	if l.err || !mboxOk {
		return &ParseError{err: "bad SOA Mbox", lex: l}
	}
	rr.Mbox = mbox

	c.Next() // zBlank

	var (
		v  uint32
		ok bool
	)
	for i := 0; i < 5; i++ {
		l, _ = c.Next()
		if l.err {
			return &ParseError{err: "bad SOA zone parameter", lex: l}
		}
		if j, err := strconv.ParseUint(l.token, 10, 32); err != nil {
			if i == 0 {
				// Serial must be a number
				return &ParseError{err: "bad SOA zone parameter", lex: l}
			}
			// We allow other fields to be unitful duration strings
			if v, ok = stringToTTL(l.token); !ok {
				return &ParseError{err: "bad SOA zone parameter", lex: l}

			}
		} else {
			v = uint32(j)
		}
		switch i {
		case 0:
			rr.Serial = v
			c.Next() // zBlank
		case 1:
			rr.Refresh = v
			c.Next() // zBlank
		case 2:
			rr.Retry = v
			c.Next() // zBlank
		case 3:
			rr.Expire = v
			c.Next() // zBlank
		case 4:
			rr.Minttl = v
		}
	}
	return slurpRemainder(c)
}

func (rr *SRV) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad SRV Priority", lex: l}
	}
	rr.Priority = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e1 := strconv.ParseUint(l.token, 10, 16)
	if e1 != nil || l.err {
		return &ParseError{err: "bad SRV Weight", lex: l}
	}
	rr.Weight = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e2 := strconv.ParseUint(l.token, 10, 16)
	if e2 != nil || l.err {
		return &ParseError{err: "bad SRV Port", lex: l}
	}
	rr.Port = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Target = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad SRV Target", lex: l}
	}
	rr.Target = name
	return slurpRemainder(c)
}

func (rr *NAPTR) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad NAPTR Order", lex: l}
	}
	rr.Order = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e1 := strconv.ParseUint(l.token, 10, 16)
	if e1 != nil || l.err {
		return &ParseError{err: "bad NAPTR Preference", lex: l}
	}
	rr.Preference = uint16(i)

	// Flags
	c.Next()        // zBlank
	l, _ = c.Next() // _QUOTE
	if l.value != zQuote {
		return &ParseError{err: "bad NAPTR Flags", lex: l}
	}
	l, _ = c.Next() // Either String or Quote
	if l.value == zString {
		rr.Flags = l.token
		l, _ = c.Next() // _QUOTE
		if l.value != zQuote {
			return &ParseError{err: "bad NAPTR Flags", lex: l}
		}
	} else if l.value == zQuote {
		rr.Flags = ""
	} else {
		return &ParseError{err: "bad NAPTR Flags", lex: l}
	}

	// Service
	c.Next()        // zBlank
	l, _ = c.Next() // _QUOTE
	if l.value != zQuote {
		return &ParseError{err: "bad NAPTR Service", lex: l}
	}
	l, _ = c.Next() // Either String or Quote
	if l.value == zString {
		rr.Service = l.token
		l, _ = c.Next() // _QUOTE
		if l.value != zQuote {
			return &ParseError{err: "bad NAPTR Service", lex: l}
		}
	} else if l.value == zQuote {
		rr.Service = ""
	} else {
		return &ParseError{err: "bad NAPTR Service", lex: l}
	}

	// Regexp
	c.Next()        // zBlank
	l, _ = c.Next() // _QUOTE
	if l.value != zQuote {
		return &ParseError{err: "bad NAPTR Regexp", lex: l}
	}
	l, _ = c.Next() // Either String or Quote
	if l.value == zString {
		rr.Regexp = l.token
		l, _ = c.Next() // _QUOTE
		if l.value != zQuote {
			return &ParseError{err: "bad NAPTR Regexp", lex: l}
		}
	} else if l.value == zQuote {
		rr.Regexp = ""
	} else {
		return &ParseError{err: "bad NAPTR Regexp", lex: l}
	}

	// After quote no space??
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Replacement = l.token

	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad NAPTR Replacement", lex: l}
	}
	rr.Replacement = name
	return slurpRemainder(c)
}

func (rr *TALINK) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	previousName, previousNameOk := toAbsoluteName(l.token, o)
	if l.err || !previousNameOk {
		return &ParseError{err: "bad TALINK PreviousName", lex: l}
	}
	rr.PreviousName = previousName

	c.Next() // zBlank
	l, _ = c.Next()
	rr.NextName = l.token

	nextName, nextNameOk := toAbsoluteName(l.token, o)
	if l.err || !nextNameOk {
		return &ParseError{err: "bad TALINK NextName", lex: l}
	}
	rr.NextName = nextName

	return slurpRemainder(c)
}

func (rr *LOC) parse(c *zlexer, o string) *ParseError {
	// Non zero defaults for LOC record, see RFC 1876, Section 3.
	rr.Size = 0x12     // 1e2 cm (1m)
	rr.HorizPre = 0x16 // 1e6 cm (10000m)
	rr.VertPre = 0x13  // 1e3 cm (10m)
	ok := false

	// North
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 32)
	if e != nil || l.err || i > 90 {
		return &ParseError{err: "bad LOC Latitude", lex: l}
	}
	rr.Latitude = 1000 * 60 * 60 * uint32(i)

	c.Next() // zBlank
	// Either number, 'N' or 'S'
	l, _ = c.Next()
	if rr.Latitude, ok = locCheckNorth(l.token, rr.Latitude); ok {
		goto East
	}
	if i, err := strconv.ParseUint(l.token, 10, 32); err != nil || l.err || i > 59 {
		return &ParseError{err: "bad LOC Latitude minutes", lex: l}
	} else {
		rr.Latitude += 1000 * 60 * uint32(i)
	}

	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := strconv.ParseFloat(l.token, 64); err != nil || l.err || i < 0 || i >= 60 {
		return &ParseError{err: "bad LOC Latitude seconds", lex: l}
	} else {
		rr.Latitude += uint32(1000 * i)
	}
	c.Next() // zBlank
	// Either number, 'N' or 'S'
	l, _ = c.Next()
	if rr.Latitude, ok = locCheckNorth(l.token, rr.Latitude); ok {
		goto East
	}
	// If still alive, flag an error
	return &ParseError{err: "bad LOC Latitude North/South", lex: l}

East:
	// East
	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := strconv.ParseUint(l.token, 10, 32); err != nil || l.err || i > 180 {
		return &ParseError{err: "bad LOC Longitude", lex: l}
	} else {
		rr.Longitude = 1000 * 60 * 60 * uint32(i)
	}
	c.Next() // zBlank
	// Either number, 'E' or 'W'
	l, _ = c.Next()
	if rr.Longitude, ok = locCheckEast(l.token, rr.Longitude); ok {
		goto Altitude
	}
	if i, err := strconv.ParseUint(l.token, 10, 32); err != nil || l.err || i > 59 {
		return &ParseError{err: "bad LOC Longitude minutes", lex: l}
	} else {
		rr.Longitude += 1000 * 60 * uint32(i)
	}
	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := strconv.ParseFloat(l.token, 64); err != nil || l.err || i < 0 || i >= 60 {
		return &ParseError{err: "bad LOC Longitude seconds", lex: l}
	} else {
		rr.Longitude += uint32(1000 * i)
	}
	c.Next() // zBlank
	// Either number, 'E' or 'W'
	l, _ = c.Next()
	if rr.Longitude, ok = locCheckEast(l.token, rr.Longitude); ok {
		goto Altitude
	}
	// If still alive, flag an error
	return &ParseError{err: "bad LOC Longitude East/West", lex: l}

Altitude:
	c.Next() // zBlank
	l, _ = c.Next()
	if l.token == "" || l.err {
		return &ParseError{err: "bad LOC Altitude", lex: l}
	}
	if l.token[len(l.token)-1] == 'M' || l.token[len(l.token)-1] == 'm' {
		l.token = l.token[0 : len(l.token)-1]
	}
	if i, err := strconv.ParseFloat(l.token, 64); err != nil {
		return &ParseError{err: "bad LOC Altitude", lex: l}
	} else {
		rr.Altitude = uint32(i*100.0 + 10000000.0 + 0.5)
	}

	// And now optionally the other values
	l, _ = c.Next()
	count := 0
	for l.value != zNewline && l.value != zEOF {
		switch l.value {
		case zString:
			switch count {
			case 0: // Size
				exp, m, ok := stringToCm(l.token)
				if !ok {
					return &ParseError{err: "bad LOC Size", lex: l}
				}
				rr.Size = exp&0x0f | m<<4&0xf0
			case 1: // HorizPre
				exp, m, ok := stringToCm(l.token)
				if !ok {
					return &ParseError{err: "bad LOC HorizPre", lex: l}
				}
				rr.HorizPre = exp&0x0f | m<<4&0xf0
			case 2: // VertPre
				exp, m, ok := stringToCm(l.token)
				if !ok {
					return &ParseError{err: "bad LOC VertPre", lex: l}
				}
				rr.VertPre = exp&0x0f | m<<4&0xf0
			}
			count++
		case zBlank:
			// Ok
		default:
			return &ParseError{err: "bad LOC Size, HorizPre or VertPre", lex: l}
		}
		l, _ = c.Next()
	}
	return nil
}

func (rr *HIP) parse(c *zlexer, o string) *ParseError {
	// HitLength is not represented
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad HIP PublicKeyAlgorithm", lex: l}
	}
	rr.PublicKeyAlgorithm = uint8(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	if l.token == "" || l.err {
		return &ParseError{err: "bad HIP Hit", lex: l}
	}
	rr.Hit = l.token // This can not contain spaces, see RFC 5205 Section 6.
	rr.HitLength = uint8(len(rr.Hit)) / 2

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	if l.token == "" || l.err {
		return &ParseError{err: "bad HIP PublicKey", lex: l}
	}
	rr.PublicKey = l.token // This cannot contain spaces
	decodedPK, decodedPKerr := base64.StdEncoding.DecodeString(rr.PublicKey)
	if decodedPKerr != nil {
		return &ParseError{err: "bad HIP PublicKey", lex: l}
	}
	rr.PublicKeyLength = uint16(len(decodedPK))

	// RendezvousServers (if any)
	l, _ = c.Next()
	var xs []string
	for l.value != zNewline && l.value != zEOF {
		switch l.value {
		case zString:
			name, nameOk := toAbsoluteName(l.token, o)
			if l.err || !nameOk {
				return &ParseError{err: "bad HIP RendezvousServers", lex: l}
			}
			xs = append(xs, name)
		case zBlank:
			// Ok
		default:
			return &ParseError{err: "bad HIP RendezvousServers", lex: l}
		}
		l, _ = c.Next()
	}

	rr.RendezvousServers = xs
	return nil
}

func (rr *CERT) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	if v, ok := StringToCertType[l.token]; ok {
		rr.Type = v
	} else if i, err := strconv.ParseUint(l.token, 10, 16); err != nil {
		return &ParseError{err: "bad CERT Type", lex: l}
	} else {
		rr.Type = uint16(i)
	}
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad CERT KeyTag", lex: l}
	}
	rr.KeyTag = uint16(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	if v, ok := StringToAlgorithm[l.token]; ok {
		rr.Algorithm = v
	} else if i, err := strconv.ParseUint(l.token, 10, 8); err != nil {
		return &ParseError{err: "bad CERT Algorithm", lex: l}
	} else {
		rr.Algorithm = uint8(i)
	}
	s, e1 := endingToString(c, "bad CERT Certificate")
	if e1 != nil {
		return e1
	}
	rr.Certificate = s
	return nil
}

func (rr *OPENPGPKEY) parse(c *zlexer, o string) *ParseError {
	s, e := endingToString(c, "bad OPENPGPKEY PublicKey")
	if e != nil {
		return e
	}
	rr.PublicKey = s
	return nil
}

func (rr *CSYNC) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	j, e := strconv.ParseUint(l.token, 10, 32)
	if e != nil {
		// Serial must be a number
		return &ParseError{err: "bad CSYNC serial", lex: l}
	}
	rr.Serial = uint32(j)

	c.Next() // zBlank

	l, _ = c.Next()
	j, e1 := strconv.ParseUint(l.token, 10, 16)
	if e1 != nil {
		// Serial must be a number
		return &ParseError{err: "bad CSYNC flags", lex: l}
	}
	rr.Flags = uint16(j)

	rr.TypeBitMap = make([]uint16, 0)
	var (
		k  uint16
		ok bool
	)
	l, _ = c.Next()
	for l.value != zNewline && l.value != zEOF {
		switch l.value {
		case zBlank:
			// Ok
		case zString:
			tokenUpper := strings.ToUpper(l.token)
			if k, ok = StringToType[tokenUpper]; !ok {
				if k, ok = typeToInt(l.token); !ok {
					return &ParseError{err: "bad CSYNC TypeBitMap", lex: l}
				}
			}
			rr.TypeBitMap = append(rr.TypeBitMap, k)
		default:
			return &ParseError{err: "bad CSYNC TypeBitMap", lex: l}
		}
		l, _ = c.Next()
	}
	return nil
}

func (rr *ZONEMD) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 32)
	if e != nil || l.err {
		return &ParseError{err: "bad ZONEMD Serial", lex: l}
	}
	rr.Serial = uint32(i)

	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad ZONEMD Scheme", lex: l}
	}
	rr.Scheme = uint8(i)

	c.Next() // zBlank
	l, _ = c.Next()
	i, err := strconv.ParseUint(l.token, 10, 8)
	if err != nil || l.err {
		return &ParseError{err: "bad ZONEMD Hash Algorithm", lex: l}
	}
	rr.Hash = uint8(i)

	s, e2 := endingToString(c, "bad ZONEMD Digest")
	if e2 != nil {
		return e2
	}
	rr.Digest = s
	return nil
}

func (rr *SIG) parse(c *zlexer, o string) *ParseError { return rr.RRSIG.parse(c, o) }

func (rr *RRSIG) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	tokenUpper := strings.ToUpper(l.token)
	if t, ok := StringToType[tokenUpper]; !ok {
		if strings.HasPrefix(tokenUpper, "TYPE") {
			t, ok = typeToInt(l.token)
			if !ok {
				return &ParseError{err: "bad RRSIG Typecovered", lex: l}
			}
			rr.TypeCovered = t
		} else {
			return &ParseError{err: "bad RRSIG Typecovered", lex: l}
		}
	} else {
		rr.TypeCovered = t
	}

	c.Next() // zBlank
	l, _ = c.Next()
	if l.err {
		return &ParseError{err: "bad RRSIG Algorithm", lex: l}
	}
	i, e := strconv.ParseUint(l.token, 10, 8)
	rr.Algorithm = uint8(i) // if 0 we'll check the mnemonic in the if
	if e != nil {
		v, ok := StringToAlgorithm[l.token]
		if !ok {
			return &ParseError{err: "bad RRSIG Algorithm", lex: l}
		}
		rr.Algorithm = v
	}

	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad RRSIG Labels", lex: l}
	}
	rr.Labels = uint8(i)

	c.Next() // zBlank
	l, _ = c.Next()
	i, e2 := strconv.ParseUint(l.token, 10, 32)
	if e2 != nil || l.err {
		return &ParseError{err: "bad RRSIG OrigTtl", lex: l}
	}
	rr.OrigTtl = uint32(i)

	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := StringToTime(l.token); err != nil {
		// Try to see if all numeric and use it as epoch
		if i, err := strconv.ParseUint(l.token, 10, 32); err == nil {
			rr.Expiration = uint32(i)
		} else {
			return &ParseError{err: "bad RRSIG Expiration", lex: l}
		}
	} else {
		rr.Expiration = i
	}

	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := StringToTime(l.token); err != nil {
		if i, err := strconv.ParseUint(l.token, 10, 32); err == nil {
			rr.Inception = uint32(i)
		} else {
			return &ParseError{err: "bad RRSIG Inception", lex: l}
		}
	} else {
		rr.Inception = i
	}

	c.Next() // zBlank
	l, _ = c.Next()
	i, e3 := strconv.ParseUint(l.token, 10, 16)
	if e3 != nil || l.err {
		return &ParseError{err: "bad RRSIG KeyTag", lex: l}
	}
	rr.KeyTag = uint16(i)

	c.Next() // zBlank
	l, _ = c.Next()
	rr.SignerName = l.token
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad RRSIG SignerName", lex: l}
	}
	rr.SignerName = name

	s, e4 := endingToString(c, "bad RRSIG Signature")
	if e4 != nil {
		return e4
	}
	rr.Signature = s

	return nil
}

func (rr *NXT) parse(c *zlexer, o string) *ParseError { return rr.NSEC.parse(c, o) }

func (rr *NSEC) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad NSEC NextDomain", lex: l}
	}
	rr.NextDomain = name

	rr.TypeBitMap = make([]uint16, 0)
	var (
		k  uint16
		ok bool
	)
	l, _ = c.Next()
	for l.value != zNewline && l.value != zEOF {
		switch l.value {
		case zBlank:
			// Ok
		case zString:
			tokenUpper := strings.ToUpper(l.token)
			if k, ok = StringToType[tokenUpper]; !ok {
				if k, ok = typeToInt(l.token); !ok {
					return &ParseError{err: "bad NSEC TypeBitMap", lex: l}
				}
			}
			rr.TypeBitMap = append(rr.TypeBitMap, k)
		default:
			return &ParseError{err: "bad NSEC TypeBitMap", lex: l}
		}
		l, _ = c.Next()
	}
	return nil
}

func (rr *NSEC3) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad NSEC3 Hash", lex: l}
	}
	rr.Hash = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad NSEC3 Flags", lex: l}
	}
	rr.Flags = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e2 := strconv.ParseUint(l.token, 10, 16)
	if e2 != nil || l.err {
		return &ParseError{err: "bad NSEC3 Iterations", lex: l}
	}
	rr.Iterations = uint16(i)
	c.Next()
	l, _ = c.Next()
	if l.token == "" || l.err {
		return &ParseError{err: "bad NSEC3 Salt", lex: l}
	}
	if l.token != "-" {
		rr.SaltLength = uint8(len(l.token)) / 2
		rr.Salt = l.token
	}

	c.Next()
	l, _ = c.Next()
	if l.token == "" || l.err {
		return &ParseError{err: "bad NSEC3 NextDomain", lex: l}
	}
	rr.HashLength = 20 // Fix for NSEC3 (sha1 160 bits)
	rr.NextDomain = l.token

	rr.TypeBitMap = make([]uint16, 0)
	var (
		k  uint16
		ok bool
	)
	l, _ = c.Next()
	for l.value != zNewline && l.value != zEOF {
		switch l.value {
		case zBlank:
			// Ok
		case zString:
			tokenUpper := strings.ToUpper(l.token)
			if k, ok = StringToType[tokenUpper]; !ok {
				if k, ok = typeToInt(l.token); !ok {
					return &ParseError{err: "bad NSEC3 TypeBitMap", lex: l}
				}
			}
			rr.TypeBitMap = append(rr.TypeBitMap, k)
		default:
			return &ParseError{err: "bad NSEC3 TypeBitMap", lex: l}
		}
		l, _ = c.Next()
	}
	return nil
}

func (rr *NSEC3PARAM) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad NSEC3PARAM Hash", lex: l}
	}
	rr.Hash = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad NSEC3PARAM Flags", lex: l}
	}
	rr.Flags = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e2 := strconv.ParseUint(l.token, 10, 16)
	if e2 != nil || l.err {
		return &ParseError{err: "bad NSEC3PARAM Iterations", lex: l}
	}
	rr.Iterations = uint16(i)
	c.Next()
	l, _ = c.Next()
	if l.token != "-" {
		rr.SaltLength = uint8(len(l.token) / 2)
		rr.Salt = l.token
	}
	return slurpRemainder(c)
}

func (rr *EUI48) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	if len(l.token) != 17 || l.err {
		return &ParseError{err: "bad EUI48 Address", lex: l}
	}
	addr := make([]byte, 12)
	dash := 0
	for i := 0; i < 10; i += 2 {
		addr[i] = l.token[i+dash]
		addr[i+1] = l.token[i+1+dash]
		dash++
		if l.token[i+1+dash] != '-' {
			return &ParseError{err: "bad EUI48 Address", lex: l}
		}
	}
	addr[10] = l.token[15]
	addr[11] = l.token[16]

	i, e := strconv.ParseUint(string(addr), 16, 48)
	if e != nil {
		return &ParseError{err: "bad EUI48 Address", lex: l}
	}
	rr.Address = i
	return slurpRemainder(c)
}

func (rr *EUI64) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	if len(l.token) != 23 || l.err {
		return &ParseError{err: "bad EUI64 Address", lex: l}
	}
	addr := make([]byte, 16)
	dash := 0
	for i := 0; i < 14; i += 2 {
		addr[i] = l.token[i+dash]
		addr[i+1] = l.token[i+1+dash]
		dash++
		if l.token[i+1+dash] != '-' {
			return &ParseError{err: "bad EUI64 Address", lex: l}
		}
	}
	addr[14] = l.token[21]
	addr[15] = l.token[22]

	i, e := strconv.ParseUint(string(addr), 16, 64)
	if e != nil {
		return &ParseError{err: "bad EUI68 Address", lex: l}
	}
	rr.Address = i
	return slurpRemainder(c)
}

func (rr *SSHFP) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad SSHFP Algorithm", lex: l}
	}
	rr.Algorithm = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad SSHFP Type", lex: l}
	}
	rr.Type = uint8(i)
	c.Next() // zBlank
	s, e2 := endingToString(c, "bad SSHFP Fingerprint")
	if e2 != nil {
		return e2
	}
	rr.FingerPrint = s
	return nil
}

func (rr *DNSKEY) parseDNSKEY(c *zlexer, o, typ string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad " + typ + " Flags", lex: l}
	}
	rr.Flags = uint16(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad " + typ + " Protocol", lex: l}
	}
	rr.Protocol = uint8(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e2 := strconv.ParseUint(l.token, 10, 8)
	if e2 != nil || l.err {
		return &ParseError{err: "bad " + typ + " Algorithm", lex: l}
	}
	rr.Algorithm = uint8(i)
	s, e3 := endingToString(c, "bad "+typ+" PublicKey")
	if e3 != nil {
		return e3
	}
	rr.PublicKey = s
	return nil
}

func (rr *DNSKEY) parse(c *zlexer, o string) *ParseError  { return rr.parseDNSKEY(c, o, "DNSKEY") }
func (rr *KEY) parse(c *zlexer, o string) *ParseError     { return rr.parseDNSKEY(c, o, "KEY") }
func (rr *CDNSKEY) parse(c *zlexer, o string) *ParseError { return rr.parseDNSKEY(c, o, "CDNSKEY") }
func (rr *DS) parse(c *zlexer, o string) *ParseError      { return rr.parseDS(c, o, "DS") }
func (rr *DLV) parse(c *zlexer, o string) *ParseError     { return rr.parseDS(c, o, "DLV") }
func (rr *CDS) parse(c *zlexer, o string) *ParseError     { return rr.parseDS(c, o, "CDS") }

func (rr *IPSECKEY) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	num, err := strconv.ParseUint(l.token, 10, 8)
	if err != nil || l.err {
		return &ParseError{err: "bad IPSECKEY value", lex: l}
	}
	rr.Precedence = uint8(num)
	c.Next() // zBlank

	l, _ = c.Next()
	num, err = strconv.ParseUint(l.token, 10, 8)
	if err != nil || l.err {
		return &ParseError{err: "bad IPSECKEY value", lex: l}
	}
	rr.GatewayType = uint8(num)
	c.Next() // zBlank

	l, _ = c.Next()
	num, err = strconv.ParseUint(l.token, 10, 8)
	if err != nil || l.err {
		return &ParseError{err: "bad IPSECKEY value", lex: l}
	}
	rr.Algorithm = uint8(num)
	c.Next() // zBlank

	l, _ = c.Next()
	if l.err {
		return &ParseError{err: "bad IPSECKEY gateway", lex: l}
	}

	rr.GatewayAddr, rr.GatewayHost, err = parseAddrHostUnion(l.token, o, rr.GatewayType)
	if err != nil {
		return &ParseError{wrappedErr: fmt.Errorf("IPSECKEY %w", err), lex: l}
	}

	c.Next() // zBlank

	s, pErr := endingToString(c, "bad IPSECKEY PublicKey")
	if pErr != nil {
		return pErr
	}
	rr.PublicKey = s
	return slurpRemainder(c)
}

func (rr *AMTRELAY) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	num, err := strconv.ParseUint(l.token, 10, 8)
	if err != nil || l.err {
		return &ParseError{err: "bad AMTRELAY value", lex: l}
	}
	rr.Precedence = uint8(num)
	c.Next() // zBlank

	l, _ = c.Next()
	if l.err || !(l.token == "0" || l.token == "1") {
		return &ParseError{err: "bad discovery value", lex: l}
	}
	if l.token == "1" {
		rr.GatewayType = 0x80
	}

	c.Next() // zBlank

	l, _ = c.Next()
	num, err = strconv.ParseUint(l.token, 10, 8)
	if err != nil || l.err {
		return &ParseError{err: "bad AMTRELAY value", lex: l}
	}
	rr.GatewayType |= uint8(num)
	c.Next() // zBlank

	l, _ = c.Next()
	if l.err {
		return &ParseError{err: "bad AMTRELAY gateway", lex: l}
	}

	rr.GatewayAddr, rr.GatewayHost, err = parseAddrHostUnion(l.token, o, rr.GatewayType&0x7f)
	if err != nil {
		return &ParseError{wrappedErr: fmt.Errorf("AMTRELAY %w", err), lex: l}
	}

	return slurpRemainder(c)
}

// same constants and parsing between IPSECKEY and AMTRELAY
func parseAddrHostUnion(token, o string, gatewayType uint8) (addr net.IP, host string, err error) {
	switch gatewayType {
	case IPSECGatewayNone:
		if token != "." {
			return addr, host, errors.New("gateway type none with gateway set")
		}
	case IPSECGatewayIPv4, IPSECGatewayIPv6:
		addr = net.ParseIP(token)
		if addr == nil {
			return addr, host, errors.New("gateway IP invalid")
		}
		if (addr.To4() == nil) == (gatewayType == IPSECGatewayIPv4) {
			return addr, host, errors.New("gateway IP family mismatch")
		}
	case IPSECGatewayHost:
		var ok bool
		host, ok = toAbsoluteName(token, o)
		if !ok {
			return addr, host, errors.New("invalid gateway host")
		}
	}

	return addr, host, nil
}

func (rr *RKEY) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad RKEY Flags", lex: l}
	}
	rr.Flags = uint16(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad RKEY Protocol", lex: l}
	}
	rr.Protocol = uint8(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	i, e2 := strconv.ParseUint(l.token, 10, 8)
	if e2 != nil || l.err {
		return &ParseError{err: "bad RKEY Algorithm", lex: l}
	}
	rr.Algorithm = uint8(i)
	s, e3 := endingToString(c, "bad RKEY PublicKey")
	if e3 != nil {
		return e3
	}
	rr.PublicKey = s
	return nil
}

func (rr *EID) parse(c *zlexer, o string) *ParseError {
	s, e := endingToString(c, "bad EID Endpoint")
	if e != nil {
		return e
	}
	rr.Endpoint = s
	return nil
}

func (rr *NIMLOC) parse(c *zlexer, o string) *ParseError {
	s, e := endingToString(c, "bad NIMLOC Locator")
	if e != nil {
		return e
	}
	rr.Locator = s
	return nil
}

func (rr *GPOS) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	_, e := strconv.ParseFloat(l.token, 64)
	if e != nil || l.err {
		return &ParseError{err: "bad GPOS Longitude", lex: l}
	}
	rr.Longitude = l.token
	c.Next() // zBlank
	l, _ = c.Next()
	_, e1 := strconv.ParseFloat(l.token, 64)
	if e1 != nil || l.err {
		return &ParseError{err: "bad GPOS Latitude", lex: l}
	}
	rr.Latitude = l.token
	c.Next() // zBlank
	l, _ = c.Next()
	_, e2 := strconv.ParseFloat(l.token, 64)
	if e2 != nil || l.err {
		return &ParseError{err: "bad GPOS Altitude", lex: l}
	}
	rr.Altitude = l.token
	return slurpRemainder(c)
}

func (rr *DS) parseDS(c *zlexer, o, typ string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad " + typ + " KeyTag", lex: l}
	}
	rr.KeyTag = uint16(i)
	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := strconv.ParseUint(l.token, 10, 8); err != nil {
		tokenUpper := strings.ToUpper(l.token)
		i, ok := StringToAlgorithm[tokenUpper]
		if !ok || l.err {
			return &ParseError{err: "bad " + typ + " Algorithm", lex: l}
		}
		rr.Algorithm = i
	} else {
		rr.Algorithm = uint8(i)
	}
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad " + typ + " DigestType", lex: l}
	}
	rr.DigestType = uint8(i)
	s, e2 := endingToString(c, "bad "+typ+" Digest")
	if e2 != nil {
		return e2
	}
	rr.Digest = s
	return nil
}

func (rr *TA) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad TA KeyTag", lex: l}
	}
	rr.KeyTag = uint16(i)
	c.Next() // zBlank
	l, _ = c.Next()
	if i, err := strconv.ParseUint(l.token, 10, 8); err != nil {
		tokenUpper := strings.ToUpper(l.token)
		i, ok := StringToAlgorithm[tokenUpper]
		if !ok || l.err {
			return &ParseError{err: "bad TA Algorithm", lex: l}
		}
		rr.Algorithm = i
	} else {
		rr.Algorithm = uint8(i)
	}
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad TA DigestType", lex: l}
	}
	rr.DigestType = uint8(i)
	s, e2 := endingToString(c, "bad TA Digest")
	if e2 != nil {
		return e2
	}
	rr.Digest = s
	return nil
}

func (rr *TLSA) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad TLSA Usage", lex: l}
	}
	rr.Usage = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad TLSA Selector", lex: l}
	}
	rr.Selector = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e2 := strconv.ParseUint(l.token, 10, 8)
	if e2 != nil || l.err {
		return &ParseError{err: "bad TLSA MatchingType", lex: l}
	}
	rr.MatchingType = uint8(i)
	// So this needs be e2 (i.e. different than e), because...??t
	s, e3 := endingToString(c, "bad TLSA Certificate")
	if e3 != nil {
		return e3
	}
	rr.Certificate = s
	return nil
}

func (rr *SMIMEA) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad SMIMEA Usage", lex: l}
	}
	rr.Usage = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad SMIMEA Selector", lex: l}
	}
	rr.Selector = uint8(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e2 := strconv.ParseUint(l.token, 10, 8)
	if e2 != nil || l.err {
		return &ParseError{err: "bad SMIMEA MatchingType", lex: l}
	}
	rr.MatchingType = uint8(i)
	// So this needs be e2 (i.e. different than e), because...??t
	s, e3 := endingToString(c, "bad SMIMEA Certificate")
	if e3 != nil {
		return e3
	}
	rr.Certificate = s
	return nil
}

func (rr *RFC3597) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	if l.token != "\\#" {
		return &ParseError{err: "bad RFC3597 Rdata", lex: l}
	}

	c.Next() // zBlank
	l, _ = c.Next()
	rdlength, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad RFC3597 Rdata ", lex: l}
	}

	s, e1 := endingToString(c, "bad RFC3597 Rdata")
	if e1 != nil {
		return e1
	}
	if int(rdlength)*2 != len(s) {
		return &ParseError{err: "bad RFC3597 Rdata", lex: l}
	}
	rr.Rdata = s
	return nil
}

func (rr *SPF) parse(c *zlexer, o string) *ParseError {
	s, e := endingToTxtSlice(c, "bad SPF Txt")
	if e != nil {
		return e
	}
	rr.Txt = s
	return nil
}

func (rr *AVC) parse(c *zlexer, o string) *ParseError {
	s, e := endingToTxtSlice(c, "bad AVC Txt")
	if e != nil {
		return e
	}
	rr.Txt = s
	return nil
}

func (rr *TXT) parse(c *zlexer, o string) *ParseError {
	// no zBlank reading here, because all this rdata is TXT
	s, e := endingToTxtSlice(c, "bad TXT Txt")
	if e != nil {
		return e
	}
	rr.Txt = s
	return nil
}

// identical to setTXT
func (rr *NINFO) parse(c *zlexer, o string) *ParseError {
	s, e := endingToTxtSlice(c, "bad NINFO ZSData")
	if e != nil {
		return e
	}
	rr.ZSData = s
	return nil
}

func (rr *URI) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad URI Priority", lex: l}
	}
	rr.Priority = uint16(i)
	c.Next() // zBlank
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 16)
	if e1 != nil || l.err {
		return &ParseError{err: "bad URI Weight", lex: l}
	}
	rr.Weight = uint16(i)

	c.Next() // zBlank
	s, e2 := endingToTxtSlice(c, "bad URI Target")
	if e2 != nil {
		return e2
	}
	if len(s) != 1 {
		return &ParseError{err: "bad URI Target", lex: l}
	}
	rr.Target = s[0]
	return nil
}

func (rr *DHCID) parse(c *zlexer, o string) *ParseError {
	// awesome record to parse!
	s, e := endingToString(c, "bad DHCID Digest")
	if e != nil {
		return e
	}
	rr.Digest = s
	return nil
}

func (rr *NID) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad NID Preference", lex: l}
	}
	rr.Preference = uint16(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	u, e1 := stringToNodeID(l)
	if e1 != nil || l.err {
		return e1
	}
	rr.NodeID = u
	return slurpRemainder(c)
}

func (rr *L32) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad L32 Preference", lex: l}
	}
	rr.Preference = uint16(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Locator32 = net.ParseIP(l.token)
	if rr.Locator32 == nil || l.err {
		return &ParseError{err: "bad L32 Locator", lex: l}
	}
	return slurpRemainder(c)
}

func (rr *LP) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad LP Preference", lex: l}
	}
	rr.Preference = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Fqdn = l.token
	name, nameOk := toAbsoluteName(l.token, o)
	if l.err || !nameOk {
		return &ParseError{err: "bad LP Fqdn", lex: l}
	}
	rr.Fqdn = name
	return slurpRemainder(c)
}

func (rr *L64) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad L64 Preference", lex: l}
	}
	rr.Preference = uint16(i)
	c.Next()        // zBlank
	l, _ = c.Next() // zString
	u, e1 := stringToNodeID(l)
	if e1 != nil || l.err {
		return e1
	}
	rr.Locator64 = u
	return slurpRemainder(c)
}

func (rr *UID) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 32)
	if e != nil || l.err {
		return &ParseError{err: "bad UID Uid", lex: l}
	}
	rr.Uid = uint32(i)
	return slurpRemainder(c)
}

func (rr *GID) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 32)
	if e != nil || l.err {
		return &ParseError{err: "bad GID Gid", lex: l}
	}
	rr.Gid = uint32(i)
	return slurpRemainder(c)
}

func (rr *UINFO) parse(c *zlexer, o string) *ParseError {
	s, e := endingToTxtSlice(c, "bad UINFO Uinfo")
	if e != nil {
		return e
	}
	if ln := len(s); ln == 0 {
		return nil
	}
	rr.Uinfo = s[0] // silently discard anything after the first character-string
	return nil
}

func (rr *PX) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 16)
	if e != nil || l.err {
		return &ParseError{err: "bad PX Preference", lex: l}
	}
	rr.Preference = uint16(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Map822 = l.token
	map822, map822Ok := toAbsoluteName(l.token, o)
	if l.err || !map822Ok {
		return &ParseError{err: "bad PX Map822", lex: l}
	}
	rr.Map822 = map822

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	rr.Mapx400 = l.token
	mapx400, mapx400Ok := toAbsoluteName(l.token, o)
	if l.err || !mapx400Ok {
		return &ParseError{err: "bad PX Mapx400", lex: l}
	}
	rr.Mapx400 = mapx400
	return slurpRemainder(c)
}

func (rr *CAA) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad CAA Flag", lex: l}
	}
	rr.Flag = uint8(i)

	c.Next()        // zBlank
	l, _ = c.Next() // zString
	if l.value != zString {
		return &ParseError{err: "bad CAA Tag", lex: l}
	}
	rr.Tag = l.token

	c.Next() // zBlank
	s, e1 := endingToTxtSlice(c, "bad CAA Value")
	if e1 != nil {
		return e1
	}
	if len(s) != 1 {
		return &ParseError{err: "bad CAA Value", lex: l}
	}
	rr.Value = s[0]
	return nil
}

func (rr *TKEY) parse(c *zlexer, o string) *ParseError {
	l, _ := c.Next()

	// Algorithm
	if l.value != zString {
		return &ParseError{err: "bad TKEY algorithm", lex: l}
	}
	rr.Algorithm = l.token
	c.Next() // zBlank

	// Get the key length and key values
	l, _ = c.Next()
	i, e := strconv.ParseUint(l.token, 10, 8)
	if e != nil || l.err {
		return &ParseError{err: "bad TKEY key length", lex: l}
	}
	rr.KeySize = uint16(i)
	c.Next() // zBlank
	l, _ = c.Next()
	if l.value != zString {
		return &ParseError{err: "bad TKEY key", lex: l}
	}
	rr.Key = l.token
	c.Next() // zBlank

	// Get the otherdata length and string data
	l, _ = c.Next()
	i, e1 := strconv.ParseUint(l.token, 10, 8)
	if e1 != nil || l.err {
		return &ParseError{err: "bad TKEY otherdata length", lex: l}
	}
	rr.OtherLen = uint16(i)
	c.Next() // zBlank
	l, _ = c.Next()
	if l.value != zString {
		return &ParseError{err: "bad TKEY otherday", lex: l}
	}
	rr.OtherData = l.token
	return nil
}

func (rr *APL) parse(c *zlexer, o string) *ParseError {
	var prefixes []APLPrefix

	for {
		l, _ := c.Next()
		if l.value == zNewline || l.value == zEOF {
			break
		}
		if l.value == zBlank && prefixes != nil {
			continue
		}
		if l.value != zString {
			return &ParseError{err: "unexpected APL field", lex: l}
		}

		// Expected format: [!]afi:address/prefix

		colon := strings.IndexByte(l.token, ':')
		if colon == -1 {
			return &ParseError{err: "missing colon in APL field", lex: l}
		}

		family, cidr := l.token[:colon], l.token[colon+1:]

		var negation bool
		if family != "" && family[0] == '!' {
			negation = true
			family = family[1:]
		}

		afi, e := strconv.ParseUint(family, 10, 16)
		if e != nil {
			return &ParseError{wrappedErr: fmt.Errorf("failed to parse APL family: %w", e), lex: l}
		}
		var addrLen int
		switch afi {
		case 1:
			addrLen = net.IPv4len
		case 2:
			addrLen = net.IPv6len
		default:
			return &ParseError{err: "unrecognized APL family", lex: l}
		}

		ip, subnet, e1 := net.ParseCIDR(cidr)
		if e1 != nil {
			return &ParseError{wrappedErr: fmt.Errorf("failed to parse APL address: %w", e1), lex: l}
		}
		if !ip.Equal(subnet.IP) {
			return &ParseError{err: "extra bits in APL address", lex: l}
		}

		if len(subnet.IP) != addrLen {
			return &ParseError{err: "address mismatch with the APL family", lex: l}
		}

		prefixes = append(prefixes, APLPrefix{
			Negation: negation,
			Network:  *subnet,
		})
	}

	rr.Prefixes = prefixes
	return nil
}

// escapedStringOffset finds the offset within a string (which may contain escape
// sequences) that corresponds to a certain byte offset. If the input offset is
// out of bounds, -1 is returned (which is *not* considered an error).
func escapedStringOffset(s string, desiredByteOffset int) (int, bool) {
	if desiredByteOffset == 0 {
		return 0, true
	}

	currentByteOffset, i := 0, 0

	for i < len(s) {
		currentByteOffset += 1

		// Skip escape sequences
		if s[i] != '\\' {
			// Single plain byte, not an escape sequence.
			i++
		} else if isDDD(s[i+1:]) {
			// Skip backslash and DDD.
			i += 4
		} else if len(s[i+1:]) < 1 {
			// No character following the backslash; that's an error.
			return 0, false
		} else {
			// Skip backslash and following byte.
			i += 2
		}

		if currentByteOffset >= desiredByteOffset {
			return i, true
		}
	}

	return -1, true
}
