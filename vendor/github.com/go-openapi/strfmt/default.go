// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

import (
	"database/sql/driver"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/mail"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/net/idna"
)

const (
	// HostnamePattern http://json-schema.org/latest/json-schema-validation.html#anchor114.
	//
	// Deprecated: this package no longer uses regular expressions to validate hostnames.
	HostnamePattern = `^([a-zA-Z0-9\p{S}\p{L}]((-?[a-zA-Z0-9\p{S}\p{L}]{0,62})?)|([a-zA-Z0-9\p{S}\p{L}](([a-zA-Z0-9-\p{S}\p{L}]{0,61}[a-zA-Z0-9\p{S}\p{L}])?)(\.)){1,}([a-zA-Z0-9-\p{L}]){2,63})$`

	// json null type
	jsonNull = "null"
)

const (
	// UUIDPattern Regex for UUID that allows uppercase
	//
	// Deprecated: strfmt no longer uses regular expressions to validate UUIDs.
	UUIDPattern = `(?i)(^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$)|(^[0-9a-f]{32}$)`

	// UUID3Pattern Regex for UUID3 that allows uppercase
	//
	// Deprecated: strfmt no longer uses regular expressions to validate UUIDs.
	UUID3Pattern = `(?i)(^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$)|(^[0-9a-f]{12}3[0-9a-f]{3}?[0-9a-f]{16}$)`

	// UUID4Pattern Regex for UUID4 that allows uppercase
	//
	// Deprecated: strfmt no longer uses regular expressions to validate UUIDs.
	UUID4Pattern = `(?i)(^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$)|(^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$)`

	// UUID5Pattern Regex for UUID5 that allows uppercase
	//
	// Deprecated: strfmt no longer uses regular expressions to validate UUIDs.
	UUID5Pattern = `(?i)(^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$)|(^[0-9a-f]{12}5[0-9a-f]{3}[89ab][0-9a-f]{15}$)`

	isbn10Pattern   string = "^(?:[0-9]{9}X|[0-9]{10})$"
	isbn13Pattern   string = "^(?:[0-9]{13})$"
	usCardPattern   string = "^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|(222[1-9]|22[3-9][0-9]|2[3-6][0-9]{2}|27[01][0-9]|2720)[0-9]{12}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\\d{3})\\d{11}|6[27][0-9]{14})$"
	ssnPattern      string = `^\d{3}[- ]?\d{2}[- ]?\d{4}$`
	hexColorPattern string = "^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
	rgbColorPattern string = "^rgb\\(\\s*(0|[1-9]\\d?|1\\d\\d?|2[0-4]\\d|25[0-5])\\s*,\\s*(0|[1-9]\\d?|1\\d\\d?|2[0-4]\\d|25[0-5])\\s*,\\s*(0|[1-9]\\d?|1\\d\\d?|2[0-4]\\d|25[0-5])\\s*\\)$"
)

const (
	isbnVersion10 = 10
	isbnVersion13 = 13
	decimalBase   = 10
)

var (
	idnaHostChecker = idna.New(
		idna.ValidateForRegistration(), // shorthand for [idna.StrictDomainName],  [idna.ValidateLabels], [idna.VerifyDNSLength], [idna.BidiRule]
	)

	whiteSpacesAndMinus = regexp.MustCompile(`[\s-]+`)
	rxISBN10            = regexp.MustCompile(isbn10Pattern)
	rxISBN13            = regexp.MustCompile(isbn13Pattern)
	rxCreditCard        = regexp.MustCompile(usCardPattern)
	rxSSN               = regexp.MustCompile(ssnPattern)
	rxHexcolor          = regexp.MustCompile(hexColorPattern)
	rxRGBcolor          = regexp.MustCompile(rgbColorPattern)
)

// IsHostname returns true when the string is a valid hostname.
//
// It follows the rules detailed at https://url.spec.whatwg.org/#concept-host-parser
// and implemented by most modern web browsers.
//
// It supports IDNA rules regarding internationalized names with unicode.
//
// Besides:
// * the empty string is not a valid host name
// * a trailing dot is allowed in names and IPv4's (not IPv6)
// * a host name can be a valid IPv4 (with decimal, octal or hexadecimal numbers) or IPv6 address
// * IPv6 zones are disallowed
// * top-level domains can be unicode (cf. https://www.iana.org/domains/root/db).
//
// NOTE: this validator doesn't check top-level domains against the IANA root database.
// It merely ensures that a top-level domain in a FQDN is at least 2 code points long.
func IsHostname(str string) bool {
	if len(str) == 0 {
		return false
	}

	// IP v6 check
	if ipv6Cleaned, found := strings.CutPrefix(str, "["); found {
		ipv6Cleaned, found = strings.CutSuffix(ipv6Cleaned, "]")
		if !found {
			return false
		}

		return isValidIPv6(ipv6Cleaned)
	}

	// IDNA check
	res, err := idnaHostChecker.ToASCII(strings.ToLower(str))
	if err != nil || res == "" {
		return false
	}

	parts := strings.Split(res, ".")

	// IP v4 check
	lastPart, lastIndex, shouldBeIPv4 := domainEndsAsNumber(parts)
	if shouldBeIPv4 {
		// domain ends in a number: must be an IPv4
		return isValidIPv4(parts[:lastIndex+1]) // if the last part is a trailing dot, remove it
	}

	// check TLD length (excluding trailing dot)
	const minTLDLength = 2
	if lastIndex > 0 && len(lastPart) < minTLDLength {
		return false
	}

	return true
}

// domainEndsAsNumber determines if a domain name ends with a decimal, octal or hex digit,
// accounting for a possible trailing dot (the last part being empty in that case).
//
// It returns the last non-trailing dot part and if that part consists only of (dec/hex/oct) digits.
func domainEndsAsNumber(parts []string) (lastPart string, lastIndex int, ok bool) {
	// NOTE: using ParseUint(x, 0, 32) is not an option, as the IPv4 format supported why WHATWG
	// doesn't support notations such as "0b1001" (binary digits) or "0o666" (alternate notation for octal digits).
	lastIndex = len(parts) - 1
	lastPart = parts[lastIndex]
	if len(lastPart) == 0 {
		// trailing dot
		if len(parts) == 1 { // dot-only string: normally already ruled out by the IDNA check above
			return lastPart, lastIndex, false
		}

		lastIndex--
		lastPart = parts[lastIndex]
	}

	if startOfHexDigit(lastPart) {
		for _, b := range []byte(lastPart[2:]) {
			if !isHexDigit(b) {
				return lastPart, lastIndex, false
			}
		}

		return lastPart, lastIndex, true
	}

	// check for decimal and octal
	for _, b := range []byte(lastPart) {
		if !isASCIIDigit(b) {
			return lastPart, lastIndex, false
		}
	}

	return lastPart, lastIndex, true
}

func startOfHexDigit(str string) bool {
	return strings.HasPrefix(str, "0x") // the input has already been lower-cased
}

func startOfOctalDigit(str string) bool {
	if str == "0" {
		// a single "0" is considered decimal
		return false
	}

	return strings.HasPrefix(str, "0")
}

func isValidIPv6(str string) bool {
	// disallow empty ipv6 address
	if len(str) == 0 {
		return false
	}

	addr, err := netip.ParseAddr(str)
	if err != nil {
		return false
	}

	if !addr.Is6() {
		return false
	}

	// explicit desupport of IPv6 zones
	if addr.Zone() != "" {
		return false
	}

	return true
}

// isValidIPv4 parses an IPv4 with deciaml, hex or octal digit parts.
//
// We can't rely on [netip.ParseAddr] because we may get a mix of decimal, octal and hex digits.
//
// Examples of valid addresses not supported by [netip.ParseAddr] or [net.ParseIP]:
//
//	"192.0x00A80001"
//	"0300.0250.0340.001"
//	"1.0x.1.1"
//
// But not:
//
//	"0b1010.2.3.4"
//	"0o07.2.3.4"
func isValidIPv4(parts []string) bool {
	// NOTE: using ParseUint(x, 0, 32) is not an option, even though it would simplify this code a lot.
	// The IPv4 format supported why WHATWG doesn't support notations such as "0b1001" (binary digits)
	// or "0o666" (alternate notation for octal digits).
	const (
		maxPartsInIPv4  = 4
		maxDigitsInPart = 11 // max size of a 4-bytes hex or octal digit
	)

	if len(parts) == 0 || len(parts) > maxPartsInIPv4 {
		return false
	}

	// we call this when we know that the last part is a digit part, so len(lastPart)>0

	digits := make([]uint64, 0, maxPartsInIPv4)
	for _, part := range parts {
		if len(part) == 0 { // empty part: this case has normally been already ruled out by the IDNA check above
			return false
		}

		if len(part) > maxDigitsInPart { // whether decimal, octal or hex, an address can't exceed that length
			return false
		}

		if !isASCIIDigit(part[0]) { // start of an IPv4 part is always a digit
			return false
		}

		switch {
		case startOfHexDigit(part):
			const hexDigitOffset = 2
			hexString := part[hexDigitOffset:]
			if len(hexString) == 0 { // 0x part: assume 0
				digits = append(digits, 0)

				continue
			}

			hexDigit, err := strconv.ParseUint(hexString, 16, 32)
			if err != nil {
				return false
			}

			digits = append(digits, hexDigit)

			continue

		case startOfOctalDigit(part):
			const octDigitOffset = 1
			octString := part[octDigitOffset:] // we know that this is not empty
			octDigit, err := strconv.ParseUint(octString, 8, 32)
			if err != nil {
				return false
			}

			digits = append(digits, octDigit)

		default: // assume decimal digits (0-255)
			// we know that we don't have a leading 0 (would have been caught by octal digit)
			decDigit, err := strconv.ParseUint(part, 10, 8)
			if err != nil {
				return false
			}

			digits = append(digits, decDigit)
		}
	}

	// now check the digits: the last digit may encompass several parts of the address
	lastDigit := digits[len(digits)-1]
	if lastDigit > uint64(1)<<uint64(8*(maxPartsInIPv4+1-len(digits))) { //nolint:gosec,mnd // 256^(5 - len(digits)) - safe conversion
		return false
	}

	if len(digits) > 1 {
		const maxUint8 = uint64(^uint8(0))

		for i := range len(digits) - 2 {
			if digits[i] > maxUint8 {
				return false
			}
		}
	}

	return true
}

func isHexDigit(c byte) bool {
	switch {
	case '0' <= c && c <= '9':
		return true
	case 'a' <= c && c <= 'f': // assume the input string to be lower case
		return true
	}
	return false
}

func isASCIIDigit(c byte) bool {
	return c >= '0' && c <= '9'
}

// IsUUID returns true is the string matches a UUID (in any version, including v6 and v7), upper case is allowed
func IsUUID(str string) bool {
	_, err := uuid.Parse(str)
	return err == nil
}

const (
	uuidV3 = 3
	uuidV4 = 4
	uuidV5 = 5
	uuidV7 = 7
)

// IsUUID3 returns true is the string matches a UUID v3, upper case is allowed
func IsUUID3(str string) bool {
	id, err := uuid.Parse(str)
	return err == nil && id.Version() == uuid.Version(uuidV3)
}

// IsUUID4 returns true is the string matches a UUID v4, upper case is allowed
func IsUUID4(str string) bool {
	id, err := uuid.Parse(str)
	return err == nil && id.Version() == uuid.Version(uuidV4)
}

// IsUUID5 returns true is the string matches a UUID v5, upper case is allowed
func IsUUID5(str string) bool {
	id, err := uuid.Parse(str)
	return err == nil && id.Version() == uuid.Version(uuidV5)
}

// IsUUID7 returns true is the string matches a UUID v7, upper case is allowed
func IsUUID7(str string) bool {
	id, err := uuid.Parse(str)
	return err == nil && id.Version() == uuid.Version(uuidV7)
}

// IsEmail validates an email address.
func IsEmail(str string) bool {
	addr, e := mail.ParseAddress(str)
	return e == nil && addr.Address != ""
}

func init() {
	// register formats in the default registry:
	//   - byte
	//   - creditcard
	//   - email
	//   - hexcolor
	//   - hostname
	//   - ipv4
	//   - ipv6
	//   - cidr
	//   - isbn
	//   - isbn10
	//   - isbn13
	//   - mac
	//   - password
	//   - rgbcolor
	//   - ssn
	//   - uri
	//   - uuid
	//   - uuid3
	//   - uuid4
	//   - uuid5
	//   - uuid7
	u := URI("")
	Default.Add("uri", &u, isRequestURI)

	eml := Email("")
	Default.Add("email", &eml, IsEmail)

	hn := Hostname("")
	Default.Add("hostname", &hn, IsHostname)

	ip4 := IPv4("")
	Default.Add("ipv4", &ip4, isIPv4)

	ip6 := IPv6("")
	Default.Add("ipv6", &ip6, isIPv6)

	cidr := CIDR("")
	Default.Add("cidr", &cidr, isCIDR)

	mac := MAC("")
	Default.Add("mac", &mac, isMAC)

	uid := UUID("")
	Default.Add("uuid", &uid, IsUUID)

	uid3 := UUID3("")
	Default.Add("uuid3", &uid3, IsUUID3)

	uid4 := UUID4("")
	Default.Add("uuid4", &uid4, IsUUID4)

	uid5 := UUID5("")
	Default.Add("uuid5", &uid5, IsUUID5)

	uid7 := UUID7("")
	Default.Add("uuid7", &uid7, IsUUID7)

	isbn := ISBN("")
	Default.Add("isbn", &isbn, func(str string) bool { return isISBN10(str) || isISBN13(str) })

	isbn10 := ISBN10("")
	Default.Add("isbn10", &isbn10, isISBN10)

	isbn13 := ISBN13("")
	Default.Add("isbn13", &isbn13, isISBN13)

	cc := CreditCard("")
	Default.Add("creditcard", &cc, isCreditCard)

	ssn := SSN("")
	Default.Add("ssn", &ssn, isSSN)

	hc := HexColor("")
	Default.Add("hexcolor", &hc, isHexcolor)

	rc := RGBColor("")
	Default.Add("rgbcolor", &rc, isRGBcolor)

	b64 := Base64([]byte(nil))
	Default.Add("byte", &b64, isBase64)

	pw := Password("")
	Default.Add("password", &pw, func(_ string) bool { return true })
}

// Base64 represents a base64 encoded string, using URLEncoding alphabet
//
// swagger:strfmt byte
type Base64 []byte

// MarshalText turns this instance into text
func (b Base64) MarshalText() ([]byte, error) {
	enc := base64.URLEncoding
	src := []byte(b)
	buf := make([]byte, enc.EncodedLen(len(src)))
	enc.Encode(buf, src)
	return buf, nil
}

// UnmarshalText hydrates this instance from text
func (b *Base64) UnmarshalText(data []byte) error { // validation is performed later on
	enc := base64.URLEncoding
	dbuf := make([]byte, enc.DecodedLen(len(data)))

	n, err := enc.Decode(dbuf, data)
	if err != nil {
		return err
	}

	*b = dbuf[:n]
	return nil
}

// Scan read a value from a database driver
func (b *Base64) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		dbuf := make([]byte, base64.StdEncoding.DecodedLen(len(v)))
		n, err := base64.StdEncoding.Decode(dbuf, v)
		if err != nil {
			return err
		}
		*b = dbuf[:n]
	case string:
		vv, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			return err
		}
		*b = Base64(vv)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.Base64 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (b Base64) Value() (driver.Value, error) {
	return driver.Value(b.String()), nil
}

func (b Base64) String() string {
	return base64.StdEncoding.EncodeToString([]byte(b))
}

// MarshalJSON returns the Base64 as JSON
func (b Base64) MarshalJSON() ([]byte, error) {
	return json.Marshal(b.String())
}

// UnmarshalJSON sets the Base64 from JSON
func (b *Base64) UnmarshalJSON(data []byte) error {
	var b64str string
	if err := json.Unmarshal(data, &b64str); err != nil {
		return err
	}
	vb, err := base64.StdEncoding.DecodeString(b64str)
	if err != nil {
		return err
	}
	*b = Base64(vb)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (b *Base64) DeepCopyInto(out *Base64) {
	*out = *b
}

// DeepCopy copies the receiver into a new Base64.
func (b *Base64) DeepCopy() *Base64 {
	if b == nil {
		return nil
	}
	out := new(Base64)
	b.DeepCopyInto(out)
	return out
}

// URI represents the uri string format as specified by the json schema spec
//
// swagger:strfmt uri
type URI string

// MarshalText turns this instance into text
func (u URI) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *URI) UnmarshalText(data []byte) error { // validation is performed later on
	*u = URI(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *URI) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = URI(string(v))
	case string:
		*u = URI(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.URI from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u URI) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u URI) String() string {
	return string(u)
}

// MarshalJSON returns the URI as JSON
func (u URI) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the URI from JSON
func (u *URI) UnmarshalJSON(data []byte) error {
	var uristr string
	if err := json.Unmarshal(data, &uristr); err != nil {
		return err
	}
	*u = URI(uristr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *URI) DeepCopyInto(out *URI) {
	*out = *u
}

// DeepCopy copies the receiver into a new URI.
func (u *URI) DeepCopy() *URI {
	if u == nil {
		return nil
	}
	out := new(URI)
	u.DeepCopyInto(out)
	return out
}

// Email represents the email string format as specified by the json schema spec
//
// swagger:strfmt email
type Email string

// MarshalText turns this instance into text
func (e Email) MarshalText() ([]byte, error) {
	return []byte(string(e)), nil
}

// UnmarshalText hydrates this instance from text
func (e *Email) UnmarshalText(data []byte) error { // validation is performed later on
	*e = Email(string(data))
	return nil
}

// Scan read a value from a database driver
func (e *Email) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*e = Email(string(v))
	case string:
		*e = Email(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.Email from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (e Email) Value() (driver.Value, error) {
	return driver.Value(string(e)), nil
}

func (e Email) String() string {
	return string(e)
}

// MarshalJSON returns the Email as JSON
func (e Email) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(e))
}

// UnmarshalJSON sets the Email from JSON
func (e *Email) UnmarshalJSON(data []byte) error {
	var estr string
	if err := json.Unmarshal(data, &estr); err != nil {
		return err
	}
	*e = Email(estr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (e *Email) DeepCopyInto(out *Email) {
	*out = *e
}

// DeepCopy copies the receiver into a new Email.
func (e *Email) DeepCopy() *Email {
	if e == nil {
		return nil
	}
	out := new(Email)
	e.DeepCopyInto(out)
	return out
}

// Hostname represents the hostname string format as specified by the json schema spec
//
// swagger:strfmt hostname
type Hostname string

// MarshalText turns this instance into text
func (h Hostname) MarshalText() ([]byte, error) {
	return []byte(string(h)), nil
}

// UnmarshalText hydrates this instance from text
func (h *Hostname) UnmarshalText(data []byte) error { // validation is performed later on
	*h = Hostname(string(data))
	return nil
}

// Scan read a value from a database driver
func (h *Hostname) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*h = Hostname(string(v))
	case string:
		*h = Hostname(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.Hostname from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (h Hostname) Value() (driver.Value, error) {
	return driver.Value(string(h)), nil
}

func (h Hostname) String() string {
	return string(h)
}

// MarshalJSON returns the Hostname as JSON
func (h Hostname) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(h))
}

// UnmarshalJSON sets the Hostname from JSON
func (h *Hostname) UnmarshalJSON(data []byte) error {
	var hstr string
	if err := json.Unmarshal(data, &hstr); err != nil {
		return err
	}
	*h = Hostname(hstr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (h *Hostname) DeepCopyInto(out *Hostname) {
	*out = *h
}

// DeepCopy copies the receiver into a new Hostname.
func (h *Hostname) DeepCopy() *Hostname {
	if h == nil {
		return nil
	}
	out := new(Hostname)
	h.DeepCopyInto(out)
	return out
}

// IPv4 represents an IP v4 address
//
// swagger:strfmt ipv4
type IPv4 string

// MarshalText turns this instance into text
func (u IPv4) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *IPv4) UnmarshalText(data []byte) error { // validation is performed later on
	*u = IPv4(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *IPv4) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = IPv4(string(v))
	case string:
		*u = IPv4(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.IPv4 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u IPv4) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u IPv4) String() string {
	return string(u)
}

// MarshalJSON returns the IPv4 as JSON
func (u IPv4) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the IPv4 from JSON
func (u *IPv4) UnmarshalJSON(data []byte) error {
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = IPv4(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *IPv4) DeepCopyInto(out *IPv4) {
	*out = *u
}

// DeepCopy copies the receiver into a new IPv4.
func (u *IPv4) DeepCopy() *IPv4 {
	if u == nil {
		return nil
	}
	out := new(IPv4)
	u.DeepCopyInto(out)
	return out
}

// IPv6 represents an IP v6 address
//
// swagger:strfmt ipv6
type IPv6 string

// MarshalText turns this instance into text
func (u IPv6) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *IPv6) UnmarshalText(data []byte) error { // validation is performed later on
	*u = IPv6(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *IPv6) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = IPv6(string(v))
	case string:
		*u = IPv6(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.IPv6 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u IPv6) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u IPv6) String() string {
	return string(u)
}

// MarshalJSON returns the IPv6 as JSON
func (u IPv6) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the IPv6 from JSON
func (u *IPv6) UnmarshalJSON(data []byte) error {
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = IPv6(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *IPv6) DeepCopyInto(out *IPv6) {
	*out = *u
}

// DeepCopy copies the receiver into a new IPv6.
func (u *IPv6) DeepCopy() *IPv6 {
	if u == nil {
		return nil
	}
	out := new(IPv6)
	u.DeepCopyInto(out)
	return out
}

// CIDR represents a Classless Inter-Domain Routing notation
//
// swagger:strfmt cidr
type CIDR string

// MarshalText turns this instance into text
func (u CIDR) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *CIDR) UnmarshalText(data []byte) error { // validation is performed later on
	*u = CIDR(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *CIDR) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = CIDR(string(v))
	case string:
		*u = CIDR(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.CIDR from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u CIDR) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u CIDR) String() string {
	return string(u)
}

// MarshalJSON returns the CIDR as JSON
func (u CIDR) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the CIDR from JSON
func (u *CIDR) UnmarshalJSON(data []byte) error {
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = CIDR(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *CIDR) DeepCopyInto(out *CIDR) {
	*out = *u
}

// DeepCopy copies the receiver into a new CIDR.
func (u *CIDR) DeepCopy() *CIDR {
	if u == nil {
		return nil
	}
	out := new(CIDR)
	u.DeepCopyInto(out)
	return out
}

// MAC represents a 48 bit MAC address
//
// swagger:strfmt mac
type MAC string

// MarshalText turns this instance into text
func (u MAC) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *MAC) UnmarshalText(data []byte) error { // validation is performed later on
	*u = MAC(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *MAC) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = MAC(string(v))
	case string:
		*u = MAC(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.IPv4 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u MAC) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u MAC) String() string {
	return string(u)
}

// MarshalJSON returns the MAC as JSON
func (u MAC) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the MAC from JSON
func (u *MAC) UnmarshalJSON(data []byte) error {
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = MAC(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *MAC) DeepCopyInto(out *MAC) {
	*out = *u
}

// DeepCopy copies the receiver into a new MAC.
func (u *MAC) DeepCopy() *MAC {
	if u == nil {
		return nil
	}
	out := new(MAC)
	u.DeepCopyInto(out)
	return out
}

// UUID represents a uuid string format
//
// swagger:strfmt uuid
type UUID string

// MarshalText turns this instance into text
func (u UUID) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *UUID) UnmarshalText(data []byte) error { // validation is performed later on
	*u = UUID(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *UUID) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = UUID(string(v))
	case string:
		*u = UUID(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.UUID from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u UUID) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u UUID) String() string {
	return string(u)
}

// MarshalJSON returns the UUID as JSON
func (u UUID) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the UUID from JSON
func (u *UUID) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = UUID(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *UUID) DeepCopyInto(out *UUID) {
	*out = *u
}

// DeepCopy copies the receiver into a new UUID.
func (u *UUID) DeepCopy() *UUID {
	if u == nil {
		return nil
	}
	out := new(UUID)
	u.DeepCopyInto(out)
	return out
}

// UUID3 represents a uuid3 string format
//
// swagger:strfmt uuid3
type UUID3 string

// MarshalText turns this instance into text
func (u UUID3) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *UUID3) UnmarshalText(data []byte) error { // validation is performed later on
	*u = UUID3(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *UUID3) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = UUID3(string(v))
	case string:
		*u = UUID3(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.UUID3 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u UUID3) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u UUID3) String() string {
	return string(u)
}

// MarshalJSON returns the UUID as JSON
func (u UUID3) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the UUID from JSON
func (u *UUID3) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = UUID3(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *UUID3) DeepCopyInto(out *UUID3) {
	*out = *u
}

// DeepCopy copies the receiver into a new UUID3.
func (u *UUID3) DeepCopy() *UUID3 {
	if u == nil {
		return nil
	}
	out := new(UUID3)
	u.DeepCopyInto(out)
	return out
}

// UUID4 represents a uuid4 string format
//
// swagger:strfmt uuid4
type UUID4 string

// MarshalText turns this instance into text
func (u UUID4) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *UUID4) UnmarshalText(data []byte) error { // validation is performed later on
	*u = UUID4(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *UUID4) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = UUID4(string(v))
	case string:
		*u = UUID4(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.UUID4 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u UUID4) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u UUID4) String() string {
	return string(u)
}

// MarshalJSON returns the UUID as JSON
func (u UUID4) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the UUID from JSON
func (u *UUID4) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = UUID4(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *UUID4) DeepCopyInto(out *UUID4) {
	*out = *u
}

// DeepCopy copies the receiver into a new UUID4.
func (u *UUID4) DeepCopy() *UUID4 {
	if u == nil {
		return nil
	}
	out := new(UUID4)
	u.DeepCopyInto(out)
	return out
}

// UUID5 represents a uuid5 string format
//
// swagger:strfmt uuid5
type UUID5 string

// MarshalText turns this instance into text
func (u UUID5) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *UUID5) UnmarshalText(data []byte) error { // validation is performed later on
	*u = UUID5(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *UUID5) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = UUID5(string(v))
	case string:
		*u = UUID5(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.UUID5 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u UUID5) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u UUID5) String() string {
	return string(u)
}

// MarshalJSON returns the UUID as JSON
func (u UUID5) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the UUID from JSON
func (u *UUID5) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = UUID5(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *UUID5) DeepCopyInto(out *UUID5) {
	*out = *u
}

// DeepCopy copies the receiver into a new UUID5.
func (u *UUID5) DeepCopy() *UUID5 {
	if u == nil {
		return nil
	}
	out := new(UUID5)
	u.DeepCopyInto(out)
	return out
}

// UUID7 represents a uuid7 string format
//
// swagger:strfmt uuid7
type UUID7 string

// MarshalText turns this instance into text
func (u UUID7) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *UUID7) UnmarshalText(data []byte) error { // validation is performed later on
	*u = UUID7(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *UUID7) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = UUID7(string(v))
	case string:
		*u = UUID7(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.UUID7 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u UUID7) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u UUID7) String() string {
	return string(u)
}

// MarshalJSON returns the UUID as JSON
func (u UUID7) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the UUID from JSON
func (u *UUID7) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = UUID7(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *UUID7) DeepCopyInto(out *UUID7) {
	*out = *u
}

// DeepCopy copies the receiver into a new UUID7.
func (u *UUID7) DeepCopy() *UUID7 {
	if u == nil {
		return nil
	}
	out := new(UUID7)
	u.DeepCopyInto(out)
	return out
}

// ISBN represents an isbn string format
//
// swagger:strfmt isbn
type ISBN string

// MarshalText turns this instance into text
func (u ISBN) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *ISBN) UnmarshalText(data []byte) error { // validation is performed later on
	*u = ISBN(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *ISBN) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = ISBN(string(v))
	case string:
		*u = ISBN(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.ISBN from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u ISBN) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u ISBN) String() string {
	return string(u)
}

// MarshalJSON returns the ISBN as JSON
func (u ISBN) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the ISBN from JSON
func (u *ISBN) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = ISBN(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *ISBN) DeepCopyInto(out *ISBN) {
	*out = *u
}

// DeepCopy copies the receiver into a new ISBN.
func (u *ISBN) DeepCopy() *ISBN {
	if u == nil {
		return nil
	}
	out := new(ISBN)
	u.DeepCopyInto(out)
	return out
}

// ISBN10 represents an isbn 10 string format
//
// swagger:strfmt isbn10
type ISBN10 string

// MarshalText turns this instance into text
func (u ISBN10) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *ISBN10) UnmarshalText(data []byte) error { // validation is performed later on
	*u = ISBN10(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *ISBN10) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = ISBN10(string(v))
	case string:
		*u = ISBN10(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.ISBN10 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u ISBN10) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u ISBN10) String() string {
	return string(u)
}

// MarshalJSON returns the ISBN10 as JSON
func (u ISBN10) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the ISBN10 from JSON
func (u *ISBN10) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = ISBN10(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *ISBN10) DeepCopyInto(out *ISBN10) {
	*out = *u
}

// DeepCopy copies the receiver into a new ISBN10.
func (u *ISBN10) DeepCopy() *ISBN10 {
	if u == nil {
		return nil
	}
	out := new(ISBN10)
	u.DeepCopyInto(out)
	return out
}

// ISBN13 represents an isbn 13 string format
//
// swagger:strfmt isbn13
type ISBN13 string

// MarshalText turns this instance into text
func (u ISBN13) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *ISBN13) UnmarshalText(data []byte) error { // validation is performed later on
	*u = ISBN13(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *ISBN13) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = ISBN13(string(v))
	case string:
		*u = ISBN13(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.ISBN13 from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u ISBN13) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u ISBN13) String() string {
	return string(u)
}

// MarshalJSON returns the ISBN13 as JSON
func (u ISBN13) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the ISBN13 from JSON
func (u *ISBN13) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = ISBN13(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *ISBN13) DeepCopyInto(out *ISBN13) {
	*out = *u
}

// DeepCopy copies the receiver into a new ISBN13.
func (u *ISBN13) DeepCopy() *ISBN13 {
	if u == nil {
		return nil
	}
	out := new(ISBN13)
	u.DeepCopyInto(out)
	return out
}

// CreditCard represents a credit card string format
//
// swagger:strfmt creditcard
type CreditCard string

// MarshalText turns this instance into text
func (u CreditCard) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *CreditCard) UnmarshalText(data []byte) error { // validation is performed later on
	*u = CreditCard(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *CreditCard) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = CreditCard(string(v))
	case string:
		*u = CreditCard(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.CreditCard from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u CreditCard) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u CreditCard) String() string {
	return string(u)
}

// MarshalJSON returns the CreditCard as JSON
func (u CreditCard) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the CreditCard from JSON
func (u *CreditCard) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = CreditCard(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *CreditCard) DeepCopyInto(out *CreditCard) {
	*out = *u
}

// DeepCopy copies the receiver into a new CreditCard.
func (u *CreditCard) DeepCopy() *CreditCard {
	if u == nil {
		return nil
	}
	out := new(CreditCard)
	u.DeepCopyInto(out)
	return out
}

// SSN represents a social security string format
//
// swagger:strfmt ssn
type SSN string

// MarshalText turns this instance into text
func (u SSN) MarshalText() ([]byte, error) {
	return []byte(string(u)), nil
}

// UnmarshalText hydrates this instance from text
func (u *SSN) UnmarshalText(data []byte) error { // validation is performed later on
	*u = SSN(string(data))
	return nil
}

// Scan read a value from a database driver
func (u *SSN) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*u = SSN(string(v))
	case string:
		*u = SSN(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.SSN from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (u SSN) Value() (driver.Value, error) {
	return driver.Value(string(u)), nil
}

func (u SSN) String() string {
	return string(u)
}

// MarshalJSON returns the SSN as JSON
func (u SSN) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(u))
}

// UnmarshalJSON sets the SSN from JSON
func (u *SSN) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*u = SSN(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (u *SSN) DeepCopyInto(out *SSN) {
	*out = *u
}

// DeepCopy copies the receiver into a new SSN.
func (u *SSN) DeepCopy() *SSN {
	if u == nil {
		return nil
	}
	out := new(SSN)
	u.DeepCopyInto(out)
	return out
}

// HexColor represents a hex color string format
//
// swagger:strfmt hexcolor
type HexColor string

// MarshalText turns this instance into text
func (h HexColor) MarshalText() ([]byte, error) {
	return []byte(string(h)), nil
}

// UnmarshalText hydrates this instance from text
func (h *HexColor) UnmarshalText(data []byte) error { // validation is performed later on
	*h = HexColor(string(data))
	return nil
}

// Scan read a value from a database driver
func (h *HexColor) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*h = HexColor(string(v))
	case string:
		*h = HexColor(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.HexColor from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (h HexColor) Value() (driver.Value, error) {
	return driver.Value(string(h)), nil
}

func (h HexColor) String() string {
	return string(h)
}

// MarshalJSON returns the HexColor as JSON
func (h HexColor) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(h))
}

// UnmarshalJSON sets the HexColor from JSON
func (h *HexColor) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*h = HexColor(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (h *HexColor) DeepCopyInto(out *HexColor) {
	*out = *h
}

// DeepCopy copies the receiver into a new HexColor.
func (h *HexColor) DeepCopy() *HexColor {
	if h == nil {
		return nil
	}
	out := new(HexColor)
	h.DeepCopyInto(out)
	return out
}

// RGBColor represents a RGB color string format
//
// swagger:strfmt rgbcolor
type RGBColor string

// MarshalText turns this instance into text
func (r RGBColor) MarshalText() ([]byte, error) {
	return []byte(string(r)), nil
}

// UnmarshalText hydrates this instance from text
func (r *RGBColor) UnmarshalText(data []byte) error { // validation is performed later on
	*r = RGBColor(string(data))
	return nil
}

// Scan read a value from a database driver
func (r *RGBColor) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*r = RGBColor(string(v))
	case string:
		*r = RGBColor(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.RGBColor from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (r RGBColor) Value() (driver.Value, error) {
	return driver.Value(string(r)), nil
}

func (r RGBColor) String() string {
	return string(r)
}

// MarshalJSON returns the RGBColor as JSON
func (r RGBColor) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(r))
}

// UnmarshalJSON sets the RGBColor from JSON
func (r *RGBColor) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*r = RGBColor(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (r *RGBColor) DeepCopyInto(out *RGBColor) {
	*out = *r
}

// DeepCopy copies the receiver into a new RGBColor.
func (r *RGBColor) DeepCopy() *RGBColor {
	if r == nil {
		return nil
	}
	out := new(RGBColor)
	r.DeepCopyInto(out)
	return out
}

// Password represents a password.
// This has no validations and is mainly used as a marker for UI components.
//
// swagger:strfmt password
type Password string

// MarshalText turns this instance into text
func (r Password) MarshalText() ([]byte, error) {
	return []byte(string(r)), nil
}

// UnmarshalText hydrates this instance from text
func (r *Password) UnmarshalText(data []byte) error { // validation is performed later on
	*r = Password(string(data))
	return nil
}

// Scan read a value from a database driver
func (r *Password) Scan(raw any) error {
	switch v := raw.(type) {
	case []byte:
		*r = Password(string(v))
	case string:
		*r = Password(v)
	default:
		return fmt.Errorf("cannot sql.Scan() strfmt.Password from: %#v: %w", v, ErrFormat)
	}

	return nil
}

// Value converts a value to a database driver value
func (r Password) Value() (driver.Value, error) {
	return driver.Value(string(r)), nil
}

func (r Password) String() string {
	return string(r)
}

// MarshalJSON returns the Password as JSON
func (r Password) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(r))
}

// UnmarshalJSON sets the Password from JSON
func (r *Password) UnmarshalJSON(data []byte) error {
	if string(data) == jsonNull {
		return nil
	}
	var ustr string
	if err := json.Unmarshal(data, &ustr); err != nil {
		return err
	}
	*r = Password(ustr)
	return nil
}

// DeepCopyInto copies the receiver and writes its value into out.
func (r *Password) DeepCopyInto(out *Password) {
	*out = *r
}

// DeepCopy copies the receiver into a new Password.
func (r *Password) DeepCopy() *Password {
	if r == nil {
		return nil
	}
	out := new(Password)
	r.DeepCopyInto(out)
	return out
}

func isRequestURI(rawurl string) bool {
	_, err := url.ParseRequestURI(rawurl)
	return err == nil
}

// isIPv4 checks if the string is an IP version 4.
func isIPv4(str string) bool {
	ip := net.ParseIP(str)
	return ip != nil && strings.Contains(str, ".")
}

// isIPv6 checks if the string is an IP version 6.
func isIPv6(str string) bool {
	ip := net.ParseIP(str)
	return ip != nil && strings.Contains(str, ":")
}

// isCIDR checks if the string is an valid CIDR notiation (IPV4 & IPV6)
func isCIDR(str string) bool {
	_, _, err := net.ParseCIDR(str)
	return err == nil
}

// isMAC checks if a string is valid MAC address.
// Possible MAC formats:
// 01:23:45:67:89:ab
// 01:23:45:67:89:ab:cd:ef
// 01-23-45-67-89-ab
// 01-23-45-67-89-ab-cd-ef
// 0123.4567.89ab
// 0123.4567.89ab.cdef
func isMAC(str string) bool {
	_, err := net.ParseMAC(str)
	return err == nil
}

// isISBN checks if the string is an ISBN (version 10 or 13).
// If version value is not equal to 10 or 13, it will be checks both variants.
func isISBN(str string, version int) bool {
	sanitized := whiteSpacesAndMinus.ReplaceAllString(str, "")
	var checksum int32
	var i int32

	switch version {
	case isbnVersion10:
		if !rxISBN10.MatchString(sanitized) {
			return false
		}
		for i = range isbnVersion10 - 1 {
			checksum += (i + 1) * int32(sanitized[i]-'0')
		}
		if sanitized[isbnVersion10-1] == 'X' {
			checksum += isbnVersion10 * isbnVersion10
		} else {
			checksum += isbnVersion10 * int32(sanitized[isbnVersion10-1]-'0')
		}
		if checksum%(isbnVersion10+1) == 0 {
			return true
		}
		return false
	case isbnVersion13:
		if !rxISBN13.MatchString(sanitized) {
			return false
		}
		factor := []int32{1, 3}
		for i = range isbnVersion13 - 1 {
			checksum += factor[i%2] * int32(sanitized[i]-'0')
		}
		return (int32(sanitized[isbnVersion13-1]-'0'))-((decimalBase-(checksum%decimalBase))%decimalBase) == 0
	default:
		return isISBN(str, isbnVersion10) || isISBN(str, isbnVersion13)
	}
}

// isISBN10 checks if the string is an ISBN version 10.
func isISBN10(str string) bool {
	return isISBN(str, isbnVersion10)
}

// isISBN13 checks if the string is an ISBN version 13.
func isISBN13(str string) bool {
	return isISBN(str, isbnVersion13)
}

// isCreditCard checks if the string is a credit card.
func isCreditCard(str string) bool {
	sanitized := whiteSpacesAndMinus.ReplaceAllString(str, "")
	if !rxCreditCard.MatchString(sanitized) {
		return false
	}

	number, err := strconv.ParseInt(sanitized, 0, 64)
	if err != nil {
		return false
	}
	number, lastDigit := number/decimalBase, number%decimalBase

	var sum int64
	for i := 0; number > 0; i++ {
		digit := number % decimalBase

		if i%2 == 0 {
			digit *= 2
			if digit > decimalBase-1 {
				digit -= decimalBase - 1
			}
		}

		sum += digit
		number /= decimalBase
	}

	return (sum+lastDigit)%decimalBase == 0
}

// isSSN will validate the given string as a U.S. Social Security Number
func isSSN(str string) bool {
	if str == "" || len(str) != 11 {
		return false
	}
	return rxSSN.MatchString(str)
}

// isHexcolor checks if the string is a hexadecimal color.
func isHexcolor(str string) bool {
	return rxHexcolor.MatchString(str)
}

// isRGBcolor checks if the string is a valid RGB color in form rgb(RRR, GGG, BBB).
func isRGBcolor(str string) bool {
	return rxRGBcolor.MatchString(str)
}

// isBase64 checks if a string is base64 encoded.
func isBase64(str string) bool {
	_, err := base64.StdEncoding.DecodeString(str)

	return err == nil
}
