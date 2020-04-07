package mssql

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf16"
	"unicode/utf8"
)

func parseInstances(msg []byte) map[string]map[string]string {
	results := map[string]map[string]string{}
	if len(msg) > 3 && msg[0] == 5 {
		out_s := string(msg[3:])
		tokens := strings.Split(out_s, ";")
		instdict := map[string]string{}
		got_name := false
		var name string
		for _, token := range tokens {
			if got_name {
				instdict[name] = token
				got_name = false
			} else {
				name = token
				if len(name) == 0 {
					if len(instdict) == 0 {
						break
					}
					results[strings.ToUpper(instdict["InstanceName"])] = instdict
					instdict = map[string]string{}
					continue
				}
				got_name = true
			}
		}
	}
	return results
}

func getInstances(ctx context.Context, d Dialer, address string) (map[string]map[string]string, error) {
	maxTime := 5 * time.Second
	ctx, cancel := context.WithTimeout(ctx, maxTime)
	defer cancel()
	conn, err := d.DialContext(ctx, "udp", address+":1434")
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(maxTime))
	_, err = conn.Write([]byte{3})
	if err != nil {
		return nil, err
	}
	var resp = make([]byte, 16*1024-1)
	read, err := conn.Read(resp)
	if err != nil {
		return nil, err
	}
	return parseInstances(resp[:read]), nil
}

// tds versions
const (
	verTDS70     = 0x70000000
	verTDS71     = 0x71000000
	verTDS71rev1 = 0x71000001
	verTDS72     = 0x72090002
	verTDS73A    = 0x730A0003
	verTDS73     = verTDS73A
	verTDS73B    = 0x730B0003
	verTDS74     = 0x74000004
)

// packet types
// https://msdn.microsoft.com/en-us/library/dd304214.aspx
const (
	packSQLBatch   packetType = 1
	packRPCRequest            = 3
	packReply                 = 4

	// 2.2.1.7 Attention: https://msdn.microsoft.com/en-us/library/dd341449.aspx
	// 4.19.2 Out-of-Band Attention Signal: https://msdn.microsoft.com/en-us/library/dd305167.aspx
	packAttention = 6

	packBulkLoadBCP = 7
	packTransMgrReq = 14
	packNormal      = 15
	packLogin7      = 16
	packSSPIMessage = 17
	packPrelogin    = 18
)

// prelogin fields
// http://msdn.microsoft.com/en-us/library/dd357559.aspx
const (
	preloginVERSION    = 0
	preloginENCRYPTION = 1
	preloginINSTOPT    = 2
	preloginTHREADID   = 3
	preloginMARS       = 4
	preloginTRACEID    = 5
	preloginTERMINATOR = 0xff
)

const (
	encryptOff    = 0 // Encryption is available but off.
	encryptOn     = 1 // Encryption is available and on.
	encryptNotSup = 2 // Encryption is not available.
	encryptReq    = 3 // Encryption is required.
)

type tdsSession struct {
	buf          *tdsBuffer
	loginAck     loginAckStruct
	database     string
	partner      string
	columns      []columnStruct
	tranid       uint64
	logFlags     uint64
	log          optionalLogger
	routedServer string
	routedPort   uint16
}

const (
	logErrors      = 1
	logMessages    = 2
	logRows        = 4
	logSQL         = 8
	logParams      = 16
	logTransaction = 32
	logDebug       = 64
)

type columnStruct struct {
	UserType uint32
	Flags    uint16
	ColName  string
	ti       typeInfo
}

type keySlice []uint8

func (p keySlice) Len() int           { return len(p) }
func (p keySlice) Less(i, j int) bool { return p[i] < p[j] }
func (p keySlice) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }

// http://msdn.microsoft.com/en-us/library/dd357559.aspx
func writePrelogin(w *tdsBuffer, fields map[uint8][]byte) error {
	var err error

	w.BeginPacket(packPrelogin, false)
	offset := uint16(5*len(fields) + 1)
	keys := make(keySlice, 0, len(fields))
	for k, _ := range fields {
		keys = append(keys, k)
	}
	sort.Sort(keys)
	// writing header
	for _, k := range keys {
		err = w.WriteByte(k)
		if err != nil {
			return err
		}
		err = binary.Write(w, binary.BigEndian, offset)
		if err != nil {
			return err
		}
		v := fields[k]
		size := uint16(len(v))
		err = binary.Write(w, binary.BigEndian, size)
		if err != nil {
			return err
		}
		offset += size
	}
	err = w.WriteByte(preloginTERMINATOR)
	if err != nil {
		return err
	}
	// writing values
	for _, k := range keys {
		v := fields[k]
		written, err := w.Write(v)
		if err != nil {
			return err
		}
		if written != len(v) {
			return errors.New("Write method didn't write the whole value")
		}
	}
	return w.FinishPacket()
}

func readPrelogin(r *tdsBuffer) (map[uint8][]byte, error) {
	packet_type, err := r.BeginRead()
	if err != nil {
		return nil, err
	}
	struct_buf, err := ioutil.ReadAll(r)
	if err != nil {
		return nil, err
	}
	if packet_type != 4 {
		return nil, errors.New("Invalid respones, expected packet type 4, PRELOGIN RESPONSE")
	}
	offset := 0
	results := map[uint8][]byte{}
	for true {
		rec_type := struct_buf[offset]
		if rec_type == preloginTERMINATOR {
			break
		}

		rec_offset := binary.BigEndian.Uint16(struct_buf[offset+1:])
		rec_len := binary.BigEndian.Uint16(struct_buf[offset+3:])
		value := struct_buf[rec_offset : rec_offset+rec_len]
		results[rec_type] = value
		offset += 5
	}
	return results, nil
}

// OptionFlags2
// http://msdn.microsoft.com/en-us/library/dd304019.aspx
const (
	fLanguageFatal = 1
	fODBC          = 2
	fTransBoundary = 4
	fCacheConnect  = 8
	fIntSecurity   = 0x80
)

// TypeFlags
const (
	// 4 bits for fSQLType
	// 1 bit for fOLEDB
	fReadOnlyIntent = 32
)

type login struct {
	TDSVersion     uint32
	PacketSize     uint32
	ClientProgVer  uint32
	ClientPID      uint32
	ConnectionID   uint32
	OptionFlags1   uint8
	OptionFlags2   uint8
	TypeFlags      uint8
	OptionFlags3   uint8
	ClientTimeZone int32
	ClientLCID     uint32
	HostName       string
	UserName       string
	Password       string
	AppName        string
	ServerName     string
	CtlIntName     string
	Language       string
	Database       string
	ClientID       [6]byte
	SSPI           []byte
	AtchDBFile     string
	ChangePassword string
}

type loginHeader struct {
	Length               uint32
	TDSVersion           uint32
	PacketSize           uint32
	ClientProgVer        uint32
	ClientPID            uint32
	ConnectionID         uint32
	OptionFlags1         uint8
	OptionFlags2         uint8
	TypeFlags            uint8
	OptionFlags3         uint8
	ClientTimeZone       int32
	ClientLCID           uint32
	HostNameOffset       uint16
	HostNameLength       uint16
	UserNameOffset       uint16
	UserNameLength       uint16
	PasswordOffset       uint16
	PasswordLength       uint16
	AppNameOffset        uint16
	AppNameLength        uint16
	ServerNameOffset     uint16
	ServerNameLength     uint16
	ExtensionOffset      uint16
	ExtensionLenght      uint16
	CtlIntNameOffset     uint16
	CtlIntNameLength     uint16
	LanguageOffset       uint16
	LanguageLength       uint16
	DatabaseOffset       uint16
	DatabaseLength       uint16
	ClientID             [6]byte
	SSPIOffset           uint16
	SSPILength           uint16
	AtchDBFileOffset     uint16
	AtchDBFileLength     uint16
	ChangePasswordOffset uint16
	ChangePasswordLength uint16
	SSPILongLength       uint32
}

// convert Go string to UTF-16 encoded []byte (littleEndian)
// done manually rather than using bytes and binary packages
// for performance reasons
func str2ucs2(s string) []byte {
	res := utf16.Encode([]rune(s))
	ucs2 := make([]byte, 2*len(res))
	for i := 0; i < len(res); i++ {
		ucs2[2*i] = byte(res[i])
		ucs2[2*i+1] = byte(res[i] >> 8)
	}
	return ucs2
}

func ucs22str(s []byte) (string, error) {
	if len(s)%2 != 0 {
		return "", fmt.Errorf("Illegal UCS2 string length: %d", len(s))
	}
	buf := make([]uint16, len(s)/2)
	for i := 0; i < len(s); i += 2 {
		buf[i/2] = binary.LittleEndian.Uint16(s[i:])
	}
	return string(utf16.Decode(buf)), nil
}

func manglePassword(password string) []byte {
	var ucs2password []byte = str2ucs2(password)
	for i, ch := range ucs2password {
		ucs2password[i] = ((ch<<4)&0xff | (ch >> 4)) ^ 0xA5
	}
	return ucs2password
}

// http://msdn.microsoft.com/en-us/library/dd304019.aspx
func sendLogin(w *tdsBuffer, login login) error {
	w.BeginPacket(packLogin7, false)
	hostname := str2ucs2(login.HostName)
	username := str2ucs2(login.UserName)
	password := manglePassword(login.Password)
	appname := str2ucs2(login.AppName)
	servername := str2ucs2(login.ServerName)
	ctlintname := str2ucs2(login.CtlIntName)
	language := str2ucs2(login.Language)
	database := str2ucs2(login.Database)
	atchdbfile := str2ucs2(login.AtchDBFile)
	changepassword := str2ucs2(login.ChangePassword)
	hdr := loginHeader{
		TDSVersion:           login.TDSVersion,
		PacketSize:           login.PacketSize,
		ClientProgVer:        login.ClientProgVer,
		ClientPID:            login.ClientPID,
		ConnectionID:         login.ConnectionID,
		OptionFlags1:         login.OptionFlags1,
		OptionFlags2:         login.OptionFlags2,
		TypeFlags:            login.TypeFlags,
		OptionFlags3:         login.OptionFlags3,
		ClientTimeZone:       login.ClientTimeZone,
		ClientLCID:           login.ClientLCID,
		HostNameLength:       uint16(utf8.RuneCountInString(login.HostName)),
		UserNameLength:       uint16(utf8.RuneCountInString(login.UserName)),
		PasswordLength:       uint16(utf8.RuneCountInString(login.Password)),
		AppNameLength:        uint16(utf8.RuneCountInString(login.AppName)),
		ServerNameLength:     uint16(utf8.RuneCountInString(login.ServerName)),
		CtlIntNameLength:     uint16(utf8.RuneCountInString(login.CtlIntName)),
		LanguageLength:       uint16(utf8.RuneCountInString(login.Language)),
		DatabaseLength:       uint16(utf8.RuneCountInString(login.Database)),
		ClientID:             login.ClientID,
		SSPILength:           uint16(len(login.SSPI)),
		AtchDBFileLength:     uint16(utf8.RuneCountInString(login.AtchDBFile)),
		ChangePasswordLength: uint16(utf8.RuneCountInString(login.ChangePassword)),
	}
	offset := uint16(binary.Size(hdr))
	hdr.HostNameOffset = offset
	offset += uint16(len(hostname))
	hdr.UserNameOffset = offset
	offset += uint16(len(username))
	hdr.PasswordOffset = offset
	offset += uint16(len(password))
	hdr.AppNameOffset = offset
	offset += uint16(len(appname))
	hdr.ServerNameOffset = offset
	offset += uint16(len(servername))
	hdr.CtlIntNameOffset = offset
	offset += uint16(len(ctlintname))
	hdr.LanguageOffset = offset
	offset += uint16(len(language))
	hdr.DatabaseOffset = offset
	offset += uint16(len(database))
	hdr.SSPIOffset = offset
	offset += uint16(len(login.SSPI))
	hdr.AtchDBFileOffset = offset
	offset += uint16(len(atchdbfile))
	hdr.ChangePasswordOffset = offset
	offset += uint16(len(changepassword))
	hdr.Length = uint32(offset)
	var err error
	err = binary.Write(w, binary.LittleEndian, &hdr)
	if err != nil {
		return err
	}
	_, err = w.Write(hostname)
	if err != nil {
		return err
	}
	_, err = w.Write(username)
	if err != nil {
		return err
	}
	_, err = w.Write(password)
	if err != nil {
		return err
	}
	_, err = w.Write(appname)
	if err != nil {
		return err
	}
	_, err = w.Write(servername)
	if err != nil {
		return err
	}
	_, err = w.Write(ctlintname)
	if err != nil {
		return err
	}
	_, err = w.Write(language)
	if err != nil {
		return err
	}
	_, err = w.Write(database)
	if err != nil {
		return err
	}
	_, err = w.Write(login.SSPI)
	if err != nil {
		return err
	}
	_, err = w.Write(atchdbfile)
	if err != nil {
		return err
	}
	_, err = w.Write(changepassword)
	if err != nil {
		return err
	}
	return w.FinishPacket()
}

func readUcs2(r io.Reader, numchars int) (res string, err error) {
	buf := make([]byte, numchars*2)
	_, err = io.ReadFull(r, buf)
	if err != nil {
		return "", err
	}
	return ucs22str(buf)
}

func readUsVarChar(r io.Reader) (res string, err error) {
	var numchars uint16
	err = binary.Read(r, binary.LittleEndian, &numchars)
	if err != nil {
		return "", err
	}
	return readUcs2(r, int(numchars))
}

func writeUsVarChar(w io.Writer, s string) (err error) {
	buf := str2ucs2(s)
	var numchars int = len(buf) / 2
	if numchars > 0xffff {
		panic("invalid size for US_VARCHAR")
	}
	err = binary.Write(w, binary.LittleEndian, uint16(numchars))
	if err != nil {
		return
	}
	_, err = w.Write(buf)
	return
}

func readBVarChar(r io.Reader) (res string, err error) {
	var numchars uint8
	err = binary.Read(r, binary.LittleEndian, &numchars)
	if err != nil {
		return "", err
	}

	// A zero length could be returned, return an empty string
	if numchars == 0 {
		return "", nil
	}
	return readUcs2(r, int(numchars))
}

func writeBVarChar(w io.Writer, s string) (err error) {
	buf := str2ucs2(s)
	var numchars int = len(buf) / 2
	if numchars > 0xff {
		panic("invalid size for B_VARCHAR")
	}
	err = binary.Write(w, binary.LittleEndian, uint8(numchars))
	if err != nil {
		return
	}
	_, err = w.Write(buf)
	return
}

func readBVarByte(r io.Reader) (res []byte, err error) {
	var length uint8
	err = binary.Read(r, binary.LittleEndian, &length)
	if err != nil {
		return
	}
	res = make([]byte, length)
	_, err = io.ReadFull(r, res)
	return
}

func readUshort(r io.Reader) (res uint16, err error) {
	err = binary.Read(r, binary.LittleEndian, &res)
	return
}

func readByte(r io.Reader) (res byte, err error) {
	var b [1]byte
	_, err = r.Read(b[:])
	res = b[0]
	return
}

// Packet Data Stream Headers
// http://msdn.microsoft.com/en-us/library/dd304953.aspx
type headerStruct struct {
	hdrtype uint16
	data    []byte
}

const (
	dataStmHdrQueryNotif    = 1 // query notifications
	dataStmHdrTransDescr    = 2 // MARS transaction descriptor (required)
	dataStmHdrTraceActivity = 3
)

// Query Notifications Header
// http://msdn.microsoft.com/en-us/library/dd304949.aspx
type queryNotifHdr struct {
	notifyId      string
	ssbDeployment string
	notifyTimeout uint32
}

func (hdr queryNotifHdr) pack() (res []byte) {
	notifyId := str2ucs2(hdr.notifyId)
	ssbDeployment := str2ucs2(hdr.ssbDeployment)

	res = make([]byte, 2+len(notifyId)+2+len(ssbDeployment)+4)
	b := res

	binary.LittleEndian.PutUint16(b, uint16(len(notifyId)))
	b = b[2:]
	copy(b, notifyId)
	b = b[len(notifyId):]

	binary.LittleEndian.PutUint16(b, uint16(len(ssbDeployment)))
	b = b[2:]
	copy(b, ssbDeployment)
	b = b[len(ssbDeployment):]

	binary.LittleEndian.PutUint32(b, hdr.notifyTimeout)

	return res
}

// MARS Transaction Descriptor Header
// http://msdn.microsoft.com/en-us/library/dd340515.aspx
type transDescrHdr struct {
	transDescr        uint64 // transaction descriptor returned from ENVCHANGE
	outstandingReqCnt uint32 // outstanding request count
}

func (hdr transDescrHdr) pack() (res []byte) {
	res = make([]byte, 8+4)
	binary.LittleEndian.PutUint64(res, hdr.transDescr)
	binary.LittleEndian.PutUint32(res[8:], hdr.outstandingReqCnt)
	return res
}

func writeAllHeaders(w io.Writer, headers []headerStruct) (err error) {
	// Calculating total length.
	var totallen uint32 = 4
	for _, hdr := range headers {
		totallen += 4 + 2 + uint32(len(hdr.data))
	}
	// writing
	err = binary.Write(w, binary.LittleEndian, totallen)
	if err != nil {
		return err
	}
	for _, hdr := range headers {
		var headerlen uint32 = 4 + 2 + uint32(len(hdr.data))
		err = binary.Write(w, binary.LittleEndian, headerlen)
		if err != nil {
			return err
		}
		err = binary.Write(w, binary.LittleEndian, hdr.hdrtype)
		if err != nil {
			return err
		}
		_, err = w.Write(hdr.data)
		if err != nil {
			return err
		}
	}
	return nil
}

func sendSqlBatch72(buf *tdsBuffer, sqltext string, headers []headerStruct, resetSession bool) (err error) {
	buf.BeginPacket(packSQLBatch, resetSession)

	if err = writeAllHeaders(buf, headers); err != nil {
		return
	}

	_, err = buf.Write(str2ucs2(sqltext))
	if err != nil {
		return
	}
	return buf.FinishPacket()
}

// 2.2.1.7 Attention: https://msdn.microsoft.com/en-us/library/dd341449.aspx
// 4.19.2 Out-of-Band Attention Signal: https://msdn.microsoft.com/en-us/library/dd305167.aspx
func sendAttention(buf *tdsBuffer) error {
	buf.BeginPacket(packAttention, false)
	return buf.FinishPacket()
}

type connectParams struct {
	logFlags               uint64
	port                   uint64
	host                   string
	instance               string
	database               string
	user                   string
	password               string
	dial_timeout           time.Duration
	conn_timeout           time.Duration
	keepAlive              time.Duration
	encrypt                bool
	disableEncryption      bool
	trustServerCertificate bool
	certificate            string
	hostInCertificate      string
	serverSPN              string
	workstation            string
	appname                string
	typeFlags              uint8
	failOverPartner        string
	failOverPort           uint64
	packetSize             uint16
}

func splitConnectionString(dsn string) (res map[string]string) {
	res = map[string]string{}
	parts := strings.Split(dsn, ";")
	for _, part := range parts {
		if len(part) == 0 {
			continue
		}
		lst := strings.SplitN(part, "=", 2)
		name := strings.TrimSpace(strings.ToLower(lst[0]))
		if len(name) == 0 {
			continue
		}
		var value string = ""
		if len(lst) > 1 {
			value = strings.TrimSpace(lst[1])
		}
		res[name] = value
	}
	return res
}

// Splits a URL in the ODBC format
func splitConnectionStringOdbc(dsn string) (map[string]string, error) {
	res := map[string]string{}

	type parserState int
	const (
		// Before the start of a key
		parserStateBeforeKey parserState = iota

		// Inside a key
		parserStateKey

		// Beginning of a value. May be bare or braced
		parserStateBeginValue

		// Inside a bare value
		parserStateBareValue

		// Inside a braced value
		parserStateBracedValue

		// A closing brace inside a braced value.
		// May be the end of the value or an escaped closing brace, depending on the next character
		parserStateBracedValueClosingBrace

		// After a value. Next character should be a semicolon or whitespace.
		parserStateEndValue
	)

	var state = parserStateBeforeKey

	var key string
	var value string

	for i, c := range dsn {
		switch state {
		case parserStateBeforeKey:
			switch {
			case c == '=':
				return res, fmt.Errorf("Unexpected character = at index %d. Expected start of key or semi-colon or whitespace.", i)
			case !unicode.IsSpace(c) && c != ';':
				state = parserStateKey
				key += string(c)
			}

		case parserStateKey:
			switch c {
			case '=':
				key = normalizeOdbcKey(key)
				if len(key) == 0 {
					return res, fmt.Errorf("Unexpected end of key at index %d.", i)
				}

				state = parserStateBeginValue

			case ';':
				// Key without value
				key = normalizeOdbcKey(key)
				if len(key) == 0 {
					return res, fmt.Errorf("Unexpected end of key at index %d.", i)
				}

				res[key] = value
				key = ""
				value = ""
				state = parserStateBeforeKey

			default:
				key += string(c)
			}

		case parserStateBeginValue:
			switch {
			case c == '{':
				state = parserStateBracedValue
			case c == ';':
				// Empty value
				res[key] = value
				key = ""
				state = parserStateBeforeKey
			case unicode.IsSpace(c):
				// Ignore whitespace
			default:
				state = parserStateBareValue
				value += string(c)
			}

		case parserStateBareValue:
			if c == ';' {
				res[key] = strings.TrimRightFunc(value, unicode.IsSpace)
				key = ""
				value = ""
				state = parserStateBeforeKey
			} else {
				value += string(c)
			}

		case parserStateBracedValue:
			if c == '}' {
				state = parserStateBracedValueClosingBrace
			} else {
				value += string(c)
			}

		case parserStateBracedValueClosingBrace:
			if c == '}' {
				// Escaped closing brace
				value += string(c)
				state = parserStateBracedValue
				continue
			}

			// End of braced value
			res[key] = value
			key = ""
			value = ""

			// This character is the first character past the end,
			// so it needs to be parsed like the parserStateEndValue state.
			state = parserStateEndValue
			switch {
			case c == ';':
				state = parserStateBeforeKey
			case unicode.IsSpace(c):
				// Ignore whitespace
			default:
				return res, fmt.Errorf("Unexpected character %c at index %d. Expected semi-colon or whitespace.", c, i)
			}

		case parserStateEndValue:
			switch {
			case c == ';':
				state = parserStateBeforeKey
			case unicode.IsSpace(c):
				// Ignore whitespace
			default:
				return res, fmt.Errorf("Unexpected character %c at index %d. Expected semi-colon or whitespace.", c, i)
			}
		}
	}

	switch state {
	case parserStateBeforeKey: // Okay
	case parserStateKey: // Unfinished key. Treat as key without value.
		key = normalizeOdbcKey(key)
		if len(key) == 0 {
			return res, fmt.Errorf("Unexpected end of key at index %d.", len(dsn))
		}
		res[key] = value
	case parserStateBeginValue: // Empty value
		res[key] = value
	case parserStateBareValue:
		res[key] = strings.TrimRightFunc(value, unicode.IsSpace)
	case parserStateBracedValue:
		return res, fmt.Errorf("Unexpected end of braced value at index %d.", len(dsn))
	case parserStateBracedValueClosingBrace: // End of braced value
		res[key] = value
	case parserStateEndValue: // Okay
	}

	return res, nil
}

// Normalizes the given string as an ODBC-format key
func normalizeOdbcKey(s string) string {
	return strings.ToLower(strings.TrimRightFunc(s, unicode.IsSpace))
}

// Splits a URL of the form sqlserver://username:password@host/instance?param1=value&param2=value
func splitConnectionStringURL(dsn string) (map[string]string, error) {
	res := map[string]string{}

	u, err := url.Parse(dsn)
	if err != nil {
		return res, err
	}

	if u.Scheme != "sqlserver" {
		return res, fmt.Errorf("scheme %s is not recognized", u.Scheme)
	}

	if u.User != nil {
		res["user id"] = u.User.Username()
		p, exists := u.User.Password()
		if exists {
			res["password"] = p
		}
	}

	host, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		host = u.Host
	}

	if len(u.Path) > 0 {
		res["server"] = host + "\\" + u.Path[1:]
	} else {
		res["server"] = host
	}

	if len(port) > 0 {
		res["port"] = port
	}

	query := u.Query()
	for k, v := range query {
		if len(v) > 1 {
			return res, fmt.Errorf("key %s provided more than once", k)
		}
		res[strings.ToLower(k)] = v[0]
	}

	return res, nil
}

func parseConnectParams(dsn string) (connectParams, error) {
	var p connectParams

	var params map[string]string
	if strings.HasPrefix(dsn, "odbc:") {
		parameters, err := splitConnectionStringOdbc(dsn[len("odbc:"):])
		if err != nil {
			return p, err
		}
		params = parameters
	} else if strings.HasPrefix(dsn, "sqlserver://") {
		parameters, err := splitConnectionStringURL(dsn)
		if err != nil {
			return p, err
		}
		params = parameters
	} else {
		params = splitConnectionString(dsn)
	}

	strlog, ok := params["log"]
	if ok {
		var err error
		p.logFlags, err = strconv.ParseUint(strlog, 10, 64)
		if err != nil {
			return p, fmt.Errorf("Invalid log parameter '%s': %s", strlog, err.Error())
		}
	}
	server := params["server"]
	parts := strings.SplitN(server, `\`, 2)
	p.host = parts[0]
	if p.host == "." || strings.ToUpper(p.host) == "(LOCAL)" || p.host == "" {
		p.host = "localhost"
	}
	if len(parts) > 1 {
		p.instance = parts[1]
	}
	p.database = params["database"]
	p.user = params["user id"]
	p.password = params["password"]

	p.port = 1433
	strport, ok := params["port"]
	if ok {
		var err error
		p.port, err = strconv.ParseUint(strport, 10, 16)
		if err != nil {
			f := "Invalid tcp port '%v': %v"
			return p, fmt.Errorf(f, strport, err.Error())
		}
	}

	// https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-the-network-packet-size-server-configuration-option
	// Default packet size remains at 4096 bytes
	p.packetSize = 4096
	strpsize, ok := params["packet size"]
	if ok {
		var err error
		psize, err := strconv.ParseUint(strpsize, 0, 16)
		if err != nil {
			f := "Invalid packet size '%v': %v"
			return p, fmt.Errorf(f, strpsize, err.Error())
		}

		// Ensure packet size falls within the TDS protocol range of 512 to 32767 bytes
		// NOTE: Encrypted connections have a maximum size of 16383 bytes.  If you request
		// a higher packet size, the server will respond with an ENVCHANGE request to
		// alter the packet size to 16383 bytes.
		p.packetSize = uint16(psize)
		if p.packetSize < 512 {
			p.packetSize = 512
		} else if p.packetSize > 32767 {
			p.packetSize = 32767
		}
	}

	// https://msdn.microsoft.com/en-us/library/dd341108.aspx
	//
	// Do not set a connection timeout. Use Context to manage such things.
	// Default to zero, but still allow it to be set.
	if strconntimeout, ok := params["connection timeout"]; ok {
		timeout, err := strconv.ParseUint(strconntimeout, 10, 64)
		if err != nil {
			f := "Invalid connection timeout '%v': %v"
			return p, fmt.Errorf(f, strconntimeout, err.Error())
		}
		p.conn_timeout = time.Duration(timeout) * time.Second
	}
	p.dial_timeout = 15 * time.Second
	if strdialtimeout, ok := params["dial timeout"]; ok {
		timeout, err := strconv.ParseUint(strdialtimeout, 10, 64)
		if err != nil {
			f := "Invalid dial timeout '%v': %v"
			return p, fmt.Errorf(f, strdialtimeout, err.Error())
		}
		p.dial_timeout = time.Duration(timeout) * time.Second
	}

	// default keep alive should be 30 seconds according to spec:
	// https://msdn.microsoft.com/en-us/library/dd341108.aspx
	p.keepAlive = 30 * time.Second
	if keepAlive, ok := params["keepalive"]; ok {
		timeout, err := strconv.ParseUint(keepAlive, 10, 64)
		if err != nil {
			f := "Invalid keepAlive value '%s': %s"
			return p, fmt.Errorf(f, keepAlive, err.Error())
		}
		p.keepAlive = time.Duration(timeout) * time.Second
	}
	encrypt, ok := params["encrypt"]
	if ok {
		if strings.EqualFold(encrypt, "DISABLE") {
			p.disableEncryption = true
		} else {
			var err error
			p.encrypt, err = strconv.ParseBool(encrypt)
			if err != nil {
				f := "Invalid encrypt '%s': %s"
				return p, fmt.Errorf(f, encrypt, err.Error())
			}
		}
	} else {
		p.trustServerCertificate = true
	}
	trust, ok := params["trustservercertificate"]
	if ok {
		var err error
		p.trustServerCertificate, err = strconv.ParseBool(trust)
		if err != nil {
			f := "Invalid trust server certificate '%s': %s"
			return p, fmt.Errorf(f, trust, err.Error())
		}
	}
	p.certificate = params["certificate"]
	p.hostInCertificate, ok = params["hostnameincertificate"]
	if !ok {
		p.hostInCertificate = p.host
	}

	serverSPN, ok := params["serverspn"]
	if ok {
		p.serverSPN = serverSPN
	} else {
		p.serverSPN = fmt.Sprintf("MSSQLSvc/%s:%d", p.host, p.port)
	}

	workstation, ok := params["workstation id"]
	if ok {
		p.workstation = workstation
	} else {
		workstation, err := os.Hostname()
		if err == nil {
			p.workstation = workstation
		}
	}

	appname, ok := params["app name"]
	if !ok {
		appname = "go-mssqldb"
	}
	p.appname = appname

	appintent, ok := params["applicationintent"]
	if ok {
		if appintent == "ReadOnly" {
			p.typeFlags |= fReadOnlyIntent
		}
	}

	failOverPartner, ok := params["failoverpartner"]
	if ok {
		p.failOverPartner = failOverPartner
	}

	failOverPort, ok := params["failoverport"]
	if ok {
		var err error
		p.failOverPort, err = strconv.ParseUint(failOverPort, 0, 16)
		if err != nil {
			f := "Invalid tcp port '%v': %v"
			return p, fmt.Errorf(f, failOverPort, err.Error())
		}
	}

	return p, nil
}

type auth interface {
	InitialBytes() ([]byte, error)
	NextBytes([]byte) ([]byte, error)
	Free()
}

// SQL Server AlwaysOn Availability Group Listeners are bound by DNS to a
// list of IP addresses.  So if there is more than one, try them all and
// use the first one that allows a connection.
func dialConnection(ctx context.Context, c *Connector, p connectParams) (conn net.Conn, err error) {
	var ips []net.IP
	ips, err = net.LookupIP(p.host)
	if err != nil {
		ip := net.ParseIP(p.host)
		if ip == nil {
			return nil, err
		}
		ips = []net.IP{ip}
	}
	if len(ips) == 1 {
		d := c.getDialer(&p)
		addr := net.JoinHostPort(ips[0].String(), strconv.Itoa(int(p.port)))
		conn, err = d.DialContext(ctx, "tcp", addr)

	} else {
		//Try Dials in parallel to avoid waiting for timeouts.
		connChan := make(chan net.Conn, len(ips))
		errChan := make(chan error, len(ips))
		portStr := strconv.Itoa(int(p.port))
		for _, ip := range ips {
			go func(ip net.IP) {
				d := c.getDialer(&p)
				addr := net.JoinHostPort(ip.String(), portStr)
				conn, err := d.DialContext(ctx, "tcp", addr)
				if err == nil {
					connChan <- conn
				} else {
					errChan <- err
				}
			}(ip)
		}
		// Wait for either the *first* successful connection, or all the errors
	wait_loop:
		for i, _ := range ips {
			select {
			case conn = <-connChan:
				// Got a connection to use, close any others
				go func(n int) {
					for i := 0; i < n; i++ {
						select {
						case conn := <-connChan:
							conn.Close()
						case <-errChan:
						}
					}
				}(len(ips) - i - 1)
				// Remove any earlier errors we may have collected
				err = nil
				break wait_loop
			case err = <-errChan:
			}
		}
	}
	// Can't do the usual err != nil check, as it is possible to have gotten an error before a successful connection
	if conn == nil {
		f := "Unable to open tcp connection with host '%v:%v': %v"
		return nil, fmt.Errorf(f, p.host, p.port, err.Error())
	}
	return conn, err
}

func connect(ctx context.Context, c *Connector, log optionalLogger, p connectParams) (res *tdsSession, err error) {
	dialCtx := ctx
	if p.dial_timeout > 0 {
		var cancel func()
		dialCtx, cancel = context.WithTimeout(ctx, p.dial_timeout)
		defer cancel()
	}
	// if instance is specified use instance resolution service
	if p.instance != "" {
		p.instance = strings.ToUpper(p.instance)
		d := c.getDialer(&p)
		instances, err := getInstances(dialCtx, d, p.host)
		if err != nil {
			f := "Unable to get instances from Sql Server Browser on host %v: %v"
			return nil, fmt.Errorf(f, p.host, err.Error())
		}
		strport, ok := instances[p.instance]["tcp"]
		if !ok {
			f := "No instance matching '%v' returned from host '%v'"
			return nil, fmt.Errorf(f, p.instance, p.host)
		}
		p.port, err = strconv.ParseUint(strport, 0, 16)
		if err != nil {
			f := "Invalid tcp port returned from Sql Server Browser '%v': %v"
			return nil, fmt.Errorf(f, strport, err.Error())
		}
	}

initiate_connection:
	conn, err := dialConnection(dialCtx, c, p)
	if err != nil {
		return nil, err
	}

	toconn := newTimeoutConn(conn, p.conn_timeout)

	outbuf := newTdsBuffer(p.packetSize, toconn)
	sess := tdsSession{
		buf:      outbuf,
		log:      log,
		logFlags: p.logFlags,
	}

	instance_buf := []byte(p.instance)
	instance_buf = append(instance_buf, 0) // zero terminate instance name
	var encrypt byte
	if p.disableEncryption {
		encrypt = encryptNotSup
	} else if p.encrypt {
		encrypt = encryptOn
	} else {
		encrypt = encryptOff
	}
	fields := map[uint8][]byte{
		preloginVERSION:    {0, 0, 0, 0, 0, 0},
		preloginENCRYPTION: {encrypt},
		preloginINSTOPT:    instance_buf,
		preloginTHREADID:   {0, 0, 0, 0},
		preloginMARS:       {0}, // MARS disabled
	}

	err = writePrelogin(outbuf, fields)
	if err != nil {
		return nil, err
	}

	fields, err = readPrelogin(outbuf)
	if err != nil {
		return nil, err
	}

	encryptBytes, ok := fields[preloginENCRYPTION]
	if !ok {
		return nil, fmt.Errorf("Encrypt negotiation failed")
	}
	encrypt = encryptBytes[0]
	if p.encrypt && (encrypt == encryptNotSup || encrypt == encryptOff) {
		return nil, fmt.Errorf("Server does not support encryption")
	}

	if encrypt != encryptNotSup {
		var config tls.Config
		if p.certificate != "" {
			pem, err := ioutil.ReadFile(p.certificate)
			if err != nil {
				return nil, fmt.Errorf("Cannot read certificate %q: %v", p.certificate, err)
			}
			certs := x509.NewCertPool()
			certs.AppendCertsFromPEM(pem)
			config.RootCAs = certs
		}
		if p.trustServerCertificate {
			config.InsecureSkipVerify = true
		}
		config.ServerName = p.hostInCertificate
		// fix for https://github.com/denisenkom/go-mssqldb/issues/166
		// Go implementation of TLS payload size heuristic algorithm splits single TDS package to multiple TCP segments,
		// while SQL Server seems to expect one TCP segment per encrypted TDS package.
		// Setting DynamicRecordSizingDisabled to true disables that algorithm and uses 16384 bytes per TLS package
		config.DynamicRecordSizingDisabled = true
		outbuf.transport = conn
		toconn.buf = outbuf
		tlsConn := tls.Client(toconn, &config)
		err = tlsConn.Handshake()

		toconn.buf = nil
		outbuf.transport = tlsConn
		if err != nil {
			return nil, fmt.Errorf("TLS Handshake failed: %v", err)
		}
		if encrypt == encryptOff {
			outbuf.afterFirst = func() {
				outbuf.transport = toconn
			}
		}
	}

	login := login{
		TDSVersion:   verTDS74,
		PacketSize:   uint32(outbuf.PackageSize()),
		Database:     p.database,
		OptionFlags2: fODBC, // to get unlimited TEXTSIZE
		HostName:     p.workstation,
		ServerName:   p.host,
		AppName:      p.appname,
		TypeFlags:    p.typeFlags,
	}
	auth, auth_ok := getAuth(p.user, p.password, p.serverSPN, p.workstation)
	if auth_ok {
		login.SSPI, err = auth.InitialBytes()
		if err != nil {
			return nil, err
		}
		login.OptionFlags2 |= fIntSecurity
		defer auth.Free()
	} else {
		login.UserName = p.user
		login.Password = p.password
	}
	err = sendLogin(outbuf, login)
	if err != nil {
		return nil, err
	}

	// processing login response
	success := false
	for {
		tokchan := make(chan tokenStruct, 5)
		go processResponse(context.Background(), &sess, tokchan, nil)
		for tok := range tokchan {
			switch token := tok.(type) {
			case sspiMsg:
				sspi_msg, err := auth.NextBytes(token)
				if err != nil {
					return nil, err
				}
				if sspi_msg != nil && len(sspi_msg) > 0 {
					outbuf.BeginPacket(packSSPIMessage, false)
					_, err = outbuf.Write(sspi_msg)
					if err != nil {
						return nil, err
					}
					err = outbuf.FinishPacket()
					if err != nil {
						return nil, err
					}
					sspi_msg = nil
				}
			case loginAckStruct:
				success = true
				sess.loginAck = token
			case error:
				return nil, fmt.Errorf("Login error: %s", token.Error())
			case doneStruct:
				if token.isError() {
					return nil, fmt.Errorf("Login error: %s", token.getError())
				}
				goto loginEnd
			}
		}
	}
loginEnd:
	if !success {
		return nil, fmt.Errorf("Login failed")
	}
	if sess.routedServer != "" {
		toconn.Close()
		p.host = sess.routedServer
		p.port = uint64(sess.routedPort)
		goto initiate_connection
	}
	return &sess, nil
}
