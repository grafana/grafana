package mssql

import (
	"context"
	"crypto/tls"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"sort"
	"strings"
	"time"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/microsoft/go-mssqldb/aecmk"
	"github.com/microsoft/go-mssqldb/integratedauth"
	"github.com/microsoft/go-mssqldb/msdsn"
)

func parseDAC(msg []byte, instance string) msdsn.BrowserData {
	results := msdsn.BrowserData{}
	if len(msg) == 6 && msg[0] == 5 {
		results[strings.ToUpper(instance)]["tcp"] = fmt.Sprint(binary.LittleEndian.Uint16(msg[5:]))
	}
	return results
}

func parseInstances(msg []byte) msdsn.BrowserData {
	results := msdsn.BrowserData{}
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

func getInstances(ctx context.Context, d Dialer, address string, browserMsg msdsn.BrowserMsg, instance string) (msdsn.BrowserData, error) {
	emptyInstances := msdsn.BrowserData{}
	var bmsg []byte
	var resp []byte
	if browserMsg == msdsn.BrowserDAC {
		bmsg = make([]byte, 3+len(instance))
		bmsg[0] = byte(msdsn.BrowserDAC)
		bmsg[1] = 1
		_ = copy(bmsg[3:], instance)
		resp = make([]byte, 6)
	} else { // default to AllInstances
		bmsg = []byte{byte(msdsn.BrowserAllInstances)}
		resp = make([]byte, 16*1024-1)
	}
	conn, err := d.DialContext(ctx, "udp", net.JoinHostPort(address, "1434"))
	if err != nil {
		return emptyInstances, err
	}
	defer conn.Close()
	deadline, _ := ctx.Deadline()
	conn.SetDeadline(deadline)
	_, err = conn.Write(bmsg)
	if err != nil {
		return emptyInstances, err
	}

	read, err := conn.Read(resp)
	if err != nil {
		return emptyInstances, err
	}
	if browserMsg == msdsn.BrowserDAC {
		return parseDAC(resp[:read], instance), nil
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
	verTDS80     = 0x08000000
)

// packet types
// https://msdn.microsoft.com/en-us/library/dd304214.aspx
const (
	packSQLBatch   packetType = 1
	packRPCRequest packetType = 3
	packReply      packetType = 4

	// 2.2.1.7 Attention: https://msdn.microsoft.com/en-us/library/dd341449.aspx
	// 4.19.2 Out-of-Band Attention Signal: https://msdn.microsoft.com/en-us/library/dd305167.aspx
	packAttention packetType = 6

	packBulkLoadBCP  packetType = 7
	packFedAuthToken packetType = 8
	packTransMgrReq  packetType = 14
	packNormal       packetType = 15
	packLogin7       packetType = 16
	packSSPIMessage  packetType = 17
	packPrelogin     packetType = 18
)

// prelogin fields
// http://msdn.microsoft.com/en-us/library/dd357559.aspx
const (
	preloginVERSION         = 0
	preloginENCRYPTION      = 1
	preloginINSTOPT         = 2
	preloginTHREADID        = 3
	preloginMARS            = 4
	preloginTRACEID         = 5
	preloginFEDAUTHREQUIRED = 6
	preloginNONCEOPT        = 7
	preloginTERMINATOR      = 0xff
)

const (
	encryptOff    = 0 // Encryption is available but off.
	encryptOn     = 1 // Encryption is available and on.
	encryptNotSup = 2 // Encryption is not available.
	encryptReq    = 3 // Encryption is required.
	encryptStrict = 4
)

const (
	featExtSESSIONRECOVERY    byte = 0x01
	featExtFEDAUTH            byte = 0x02
	featExtCOLUMNENCRYPTION   byte = 0x04
	featExtGLOBALTRANSACTIONS byte = 0x05
	featExtAZURESQLSUPPORT    byte = 0x08
	featExtDATACLASSIFICATION byte = 0x09
	featExtUTF8SUPPORT        byte = 0x0A
	featExtTERMINATOR         byte = 0xFF
)

type tdsSession struct {
	buf             *tdsBuffer
	loginAck        loginAckStruct
	database        string
	partner         string
	columns         []columnStruct
	tranid          uint64
	logFlags        uint64
	logger          ContextLogger
	routedServer    string
	routedPort      uint16
	alwaysEncrypted bool
	aeSettings      *alwaysEncryptedSettings
	connid          UniqueIdentifier
	activityid      UniqueIdentifier
	encoding        msdsn.EncodeParameters
}

type alwaysEncryptedSettings struct {
	enclaveType  string
	keyProviders aecmk.ColumnEncryptionKeyProviderMap
}

const (
	// Default packet size for a TDS buffer.
	defaultPacketSize = 4096

	// Default port if no port given.
	defaultServerPort = 1433
)

type columnStruct struct {
	UserType   uint32
	Flags      uint16
	ColName    string
	ti         typeInfo
	cryptoMeta *cryptoMetadata
}

func (c columnStruct) isEncrypted() bool {
	return isEncryptedFlag(c.Flags)
}

func isEncryptedFlag(flags uint16) bool {
	return colFlagEncrypted == (flags & colFlagEncrypted)
}

func (c columnStruct) originalTypeInfo() typeInfo {
	if c.isEncrypted() {
		return c.cryptoMeta.typeInfo
	}
	return c.ti
}

type keySlice []uint8

func (p keySlice) Len() int           { return len(p) }
func (p keySlice) Less(i, j int) bool { return p[i] < p[j] }
func (p keySlice) Swap(i, j int)      { p[i], p[j] = p[j], p[i] }

type preloginOption struct {
	token  byte
	offset uint16
	length uint16
}

var preloginOptionSize = binary.Size(preloginOption{})

// http://msdn.microsoft.com/en-us/library/dd357559.aspx
func writePrelogin(packetType packetType, w *tdsBuffer, fields map[uint8][]byte) error {
	var err error

	w.BeginPacket(packetType, false)
	offset := uint16(5*len(fields) + 1)
	keys := make(keySlice, 0, len(fields))
	for k := range fields {
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
	struct_buf, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	if packet_type != packReply {
		return nil, errors.New("invalid respones, expected packet type 4, PRELOGIN RESPONSE")
	}
	if len(struct_buf) == 0 {
		return nil, errors.New("invalid empty PRELOGIN response, it must contain at least one byte")
	}
	offset := 0
	results := map[uint8][]byte{}
	for {
		// read prelogin option
		plOption, err := readPreloginOption(struct_buf, offset)
		if err != nil {
			return nil, err
		}

		if plOption.token == preloginTERMINATOR {
			break
		}

		// TRACEID data is not returned from the server
		if plOption.token != preloginTRACEID {

			// read prelogin option data
			value, err := readPreloginOptionData(plOption, struct_buf)
			if err != nil {
				return nil, err
			}
			results[plOption.token] = value
		}
		offset += preloginOptionSize
	}
	return results, nil
}

func readPreloginOption(buffer []byte, offset int) (*preloginOption, error) {
	buffer_length := len(buffer)

	// check if prelogin option record exists in buffer
	if offset >= buffer_length {
		return nil, fmt.Errorf("invalid buffer, invalid prelogin option")
	}

	rec_type := buffer[offset]
	if rec_type == preloginTERMINATOR {
		return &preloginOption{token: rec_type}, nil
	}

	// check if prelogin option exists in buffer
	if offset+preloginOptionSize >= buffer_length {
		return nil, fmt.Errorf("invalid buffer, invalid prelogin option")
	}

	plOption := &preloginOption{
		token:  rec_type,
		offset: binary.BigEndian.Uint16(buffer[offset+1:]),
		length: binary.BigEndian.Uint16(buffer[offset+3:]),
	}

	return plOption, nil
}

func readPreloginOptionData(plOption *preloginOption, buffer []byte) ([]byte, error) {
	buffer_length := len(buffer)
	// check if prelogin option data exists in buffer
	if plOption == nil || int(plOption.length+plOption.offset) > buffer_length ||
		int(plOption.offset) >= buffer_length {
		return nil, fmt.Errorf("invalid buffer, invalid prelogin option")
	}

	if plOption.token == preloginTERMINATOR {
		return nil, fmt.Errorf("cannot read data for prelogin terminator record")
	}

	value := buffer[plOption.offset : plOption.length+plOption.offset]
	return value, nil
}

// OptionFlags1
// http://msdn.microsoft.com/en-us/library/dd304019.aspx
const (
	fUseDB   = 0x20
	fSetLang = 0x80
)

// OptionFlags2
// http://msdn.microsoft.com/en-us/library/dd304019.aspx
const (
	fLanguageFatal = 1
	fODBC          = 2
	fTransBoundary = 4
	fCacheConnect  = 8
	fIntSecurity   = 0x80
)

// OptionFlags3
// http://msdn.microsoft.com/en-us/library/dd304019.aspx
const (
	fChangePassword           = 1
	fSendYukonBinaryXML       = 2
	fUserInstance             = 4
	fUnknownCollationHandling = 8
	fExtension                = 0x10
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
	FeatureExt     featureExts
}

type featureExts struct {
	features map[byte]featureExt
}

type featureExt interface {
	featureID() byte
	toBytes() []byte
}

func (e *featureExts) Add(f featureExt) error {
	if f == nil {
		return nil
	}
	id := f.featureID()
	if _, exists := e.features[id]; exists {
		f := "login error: Feature with ID '%v' is already present in FeatureExt block"
		return fmt.Errorf(f, id)
	}
	if e.features == nil {
		e.features = make(map[byte]featureExt)
	}
	e.features[id] = f
	return nil
}

func (e featureExts) toBytes() []byte {
	if len(e.features) == 0 {
		return nil
	}
	var d []byte
	for featureID, f := range e.features {
		featureData := f.toBytes()

		hdr := make([]byte, 5)
		hdr[0] = featureID                                               // FedAuth feature extension BYTE
		binary.LittleEndian.PutUint32(hdr[1:], uint32(len(featureData))) // FeatureDataLen DWORD
		d = append(d, hdr...)

		d = append(d, featureData...) // FeatureData *BYTE
	}
	if d != nil {
		d = append(d, 0xff) // Terminator
	}
	return d
}

// featureExtFedAuth tracks federated authentication state before and during login
type featureExtFedAuth struct {
	// FedAuthLibrary is populated by the federated authentication provider.
	FedAuthLibrary int

	// ADALWorkflow is populated by the federated authentication provider.
	ADALWorkflow byte

	// FedAuthEcho is populated from the prelogin response
	FedAuthEcho bool

	// FedAuthToken is populated during login with the value from the provider.
	FedAuthToken string

	// Nonce is populated during login with the value from the provider.
	Nonce []byte

	// Signature is populated during login with the value from the server.
	Signature []byte
}

func (e *featureExtFedAuth) featureID() byte {
	return featExtFEDAUTH
}

func (e *featureExtFedAuth) toBytes() []byte {
	if e == nil {
		return nil
	}

	options := byte(e.FedAuthLibrary) << 1
	if e.FedAuthEcho {
		options |= 1 // fFedAuthEcho
	}

	// Feature extension format depends on the federated auth library.
	// Options are described at
	// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-tds/773a62b6-ee89-4c02-9e5e-344882630aac
	var d []byte

	switch e.FedAuthLibrary {
	case FedAuthLibrarySecurityToken:
		d = make([]byte, 5)
		d[0] = options

		// looks like string in
		// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-tds/f88b63bb-b479-49e1-a87b-deda521da508
		tokenBytes := str2ucs2(e.FedAuthToken)
		binary.LittleEndian.PutUint32(d[1:], uint32(len(tokenBytes))) // Should be a signed int32, but since the length is relatively small, this should work
		d = append(d, tokenBytes...)

		if len(e.Nonce) == 32 {
			d = append(d, e.Nonce...)
		}

	case FedAuthLibraryADAL:
		d = []byte{options, e.ADALWorkflow}
	}

	return d
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
	ExtensionLength      uint16
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

const (
	mask64 uint64 = 0xFF80FF80FF80FF80
	mask32 uint32 = 0xFF80FF80
	mask16 uint16 = 0xFF80
)

func manglePassword(password string) []byte {
	var ucs2password []byte = str2ucs2(password)
	for i, ch := range ucs2password {
		ucs2password[i] = ((ch<<4)&0xff | (ch >> 4)) ^ 0xA5
	}
	return ucs2password
}

// http://msdn.microsoft.com/en-us/library/dd304019.aspx
func sendLogin(w *tdsBuffer, login *login) error {
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
	changepassword := manglePassword(login.ChangePassword)
	featureExt := login.FeatureExt.toBytes()

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

	featureExtOffset := uint32(0)
	featureExtLen := len(featureExt)
	if featureExtLen > 0 {
		hdr.OptionFlags3 |= fExtension
		hdr.ExtensionOffset = offset
		hdr.ExtensionLength = 4
		offset += hdr.ExtensionLength // DWORD
		featureExtOffset = uint32(offset)
	}
	if len(changepassword) > 0 {
		hdr.OptionFlags3 |= fChangePassword
	}
	hdr.Length = uint32(offset) + uint32(featureExtLen)

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
	if featureExtOffset > 0 {
		err = binary.Write(w, binary.LittleEndian, featureExtOffset)
		if err != nil {
			return err
		}
		_, err = w.Write(featureExt)
		if err != nil {
			return err
		}
	}
	return w.FinishPacket()
}

// https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-tds/827d9632-2957-4d54-b9ea-384530ae79d0
func sendFedAuthInfo(w *tdsBuffer, fedAuth *featureExtFedAuth) (err error) {
	fedauthtoken := str2ucs2(fedAuth.FedAuthToken)
	tokenlen := len(fedauthtoken)
	datalen := 4 + tokenlen + len(fedAuth.Nonce)

	w.BeginPacket(packFedAuthToken, false)
	err = binary.Write(w, binary.LittleEndian, uint32(datalen))
	if err != nil {
		return
	}

	err = binary.Write(w, binary.LittleEndian, uint32(tokenlen))
	if err != nil {
		return
	}

	_, err = w.Write(fedauthtoken)
	if err != nil {
		return
	}

	_, err = w.Write(fedAuth.Nonce)
	if err != nil {
		return
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
	numchars, err := readUshort(r)
	if err != nil {
		return
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

func readBVarChar(r io.Reader) (string, error) {
	numchars, err := readByte(r)
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
	length, err := readByte(r)
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

// Makes an attempt to connect with each available protocol, in order, until one succeeds or the timeout elapses
func dialConnection(ctx context.Context, c *Connector, p *msdsn.Config, logger ContextLogger) (conn net.Conn, err error) {
	var instances msdsn.BrowserData
	for _, protocol := range p.Protocols {
		dialer := msdsn.ProtocolDialers[protocol]
		if dialer.CallBrowser(p) {
			if instances == nil {
				d := c.getDialer(p)
				instances, err = getInstances(ctx, d, p.Host, p.BrowserMessage, p.Instance)
				if err != nil && logger != nil && uint64(p.LogFlags)&logErrors != 0 {
					e := fmt.Sprintf("unable to get instances from Sql Server Browser on host %v: %v", p.Host, err.Error())
					logger.Log(ctx, msdsn.Log(logErrors), e)
				}
			}
			err = dialer.ParseBrowserData(instances, p)
			if err != nil {
				if logger != nil && uint64(p.LogFlags)&logErrors != 0 {
					logger.Log(ctx, msdsn.Log(logErrors), "Skipping protocol "+protocol+". Error:"+err.Error())
				}
				continue
			}
		}
		sqlDialer, ok := dialer.(MssqlProtocolDialer)
		if logger != nil && uint64(p.LogFlags)&logDebug != 0 {
			logger.Log(ctx, msdsn.LogDebug, "Dialing with protocol "+protocol)
		}
		if !ok {
			conn, err = dialer.DialConnection(ctx, p)
		} else {
			conn, err = sqlDialer.DialSqlConnection(ctx, c, p)
		}
		if err != nil && logger != nil && uint64(p.LogFlags)&logErrors != 0 {
			logger.Log(ctx, msdsn.LogErrors, "Unable to connect with protocol "+protocol+":"+err.Error())
		}
		if conn != nil {
			if logger != nil && uint64(p.LogFlags)&logDebug != 0 {
				logger.Log(ctx, msdsn.LogDebug, "Returning connection from protocol "+protocol)
			}
			return
		}
	}
	return
}

func interpretPreloginResponse(p msdsn.Config, fe *featureExtFedAuth, fields map[uint8][]byte) (encrypt byte, err error) {
	// If the server returns the preloginFEDAUTHREQUIRED field, then federated authentication
	// is supported. The actual value may be 0 or 1, where 0 means either SSPI or federated
	// authentication is allowed, while 1 means only federated authentication is allowed.
	if fedAuthSupport, ok := fields[preloginFEDAUTHREQUIRED]; ok {
		if len(fedAuthSupport) != 1 {
			return 0, fmt.Errorf("federated authentication flag length should be 1: is %d", len(fedAuthSupport))
		}

		// We need to be able to echo the value back to the server
		fe.FedAuthEcho = fedAuthSupport[0] != 0
	} else if fe.FedAuthLibrary != FedAuthLibraryReserved && fe.ADALWorkflow > 0 {
		return 0, fmt.Errorf("federated authentication is not supported by the server")
	}

	encryptBytes, ok := fields[preloginENCRYPTION]
	if !ok {
		return 0, fmt.Errorf("encrypt negotiation failed")
	}
	encrypt = encryptBytes[0]
	if p.Encryption == msdsn.EncryptionRequired && (encrypt == encryptNotSup || encrypt == encryptOff) {
		return 0, fmt.Errorf("server does not support encryption")
	}

	return
}

func prepareLogin(ctx context.Context, c *Connector, p msdsn.Config, logger ContextLogger, auth integratedauth.IntegratedAuthenticator, fe *featureExtFedAuth, packetSize uint32) (l *login, err error) {
	var TDSVersion uint32
	if p.Encryption == msdsn.EncryptionStrict {
		TDSVersion = verTDS80
	} else {
		TDSVersion = verTDS74
	}
	var typeFlags uint8
	if p.ReadOnlyIntent {
		typeFlags |= fReadOnlyIntent
	}
	// We need to include Instance in ServerName field of LOGIN7 record
	var serverName string
	if len(p.Instance) > 0 {
		serverName = p.Host + "\\" + p.Instance
	} else {
		serverName = p.Host
	}
	l = &login{
		TDSVersion:     TDSVersion,
		PacketSize:     packetSize,
		Database:       p.Database,
		OptionFlags2:   fODBC, // to get unlimited TEXTSIZE
		OptionFlags1:   fUseDB | fSetLang,
		HostName:       p.Workstation,
		ServerName:     serverName,
		AppName:        p.AppName,
		TypeFlags:      typeFlags,
		CtlIntName:     "go-mssqldb",
		ClientProgVer:  getDriverVersion(driverVersion),
		ChangePassword: p.ChangePassword,
		ClientPID:      uint32(os.Getpid()),
	}
	getClientId(&l.ClientID)
	if p.ColumnEncryption {
		_ = l.FeatureExt.Add(&featureExtColumnEncryption{})
	}
	switch {
	case fe.FedAuthLibrary == FedAuthLibrarySecurityToken:
		if uint64(p.LogFlags)&logDebug != 0 {
			logger.Log(ctx, msdsn.LogDebug, "Starting federated authentication using security token")
		}

		fe.FedAuthToken, err = c.securityTokenProvider(ctx)
		if err != nil {
			if uint64(p.LogFlags)&logDebug != 0 {
				logger.Log(ctx, msdsn.LogDebug, fmt.Sprintf("Failed to retrieve service principal token for federated authentication security token library: %v", err))
			}
			return nil, err
		}

		_ = l.FeatureExt.Add(fe)

	case fe.FedAuthLibrary == FedAuthLibraryADAL:
		if uint64(p.LogFlags)&logDebug != 0 {
			logger.Log(ctx, msdsn.LogDebug, "Starting federated authentication using ADAL")
		}

		_ = l.FeatureExt.Add(fe)

	case auth != nil:
		if uint64(p.LogFlags)&logDebug != 0 {
			logger.Log(ctx, msdsn.LogDebug, "Starting SSPI login")
		}

		l.SSPI, err = auth.InitialBytes()
		if err != nil {
			return nil, err
		}

		l.OptionFlags2 |= fIntSecurity
		return l, nil

	default:
		// Default to SQL server authentication with user and password
		l.UserName = p.User
		l.Password = p.Password
	}

	return l, nil
}

func getTLSConn(conn *timeoutConn, p msdsn.Config, alpnSeq string) (tlsConn *tls.Conn, err error) {
	var config *tls.Config
	if pc := p.TLSConfig; pc != nil {
		config = pc
	}
	if config == nil {
		config, err = msdsn.SetupTLS("", false, p.Host, "")
		if err != nil {
			return nil, err
		}
	}
	//Set ALPN Sequence
	config.NextProtos = []string{alpnSeq}
	tlsConn = tls.Client(conn.c, config)
	err = tlsConn.Handshake()
	if err != nil {
		return nil, fmt.Errorf("TLS Handshake failed: %w", err)
	}
	return tlsConn, nil
}

func connect(ctx context.Context, c *Connector, logger ContextLogger, p msdsn.Config) (res *tdsSession, err error) {
	isTransportEncrypted := false
	// if instance is specified use instance resolution service
	if len(p.Instance) > 0 && p.Port != 0 && uint64(p.LogFlags)&logDebug != 0 {
		// both instance name and port specified
		// when port is specified instance name is not used
		// you should not provide instance name when you provide port
		logger.Log(ctx, msdsn.LogDebug, "WARN: You specified both instance name and port in the connection string, port will be used and instance name will be ignored")
	}

	packetSize := p.PacketSize
	if packetSize == 0 {
		packetSize = defaultPacketSize
	}
	// Ensure packet size falls within the TDS protocol range of 512 to 32767 bytes
	// NOTE: Encrypted connections have a maximum size of 16383 bytes.  If you request
	// a higher packet size, the server will respond with an ENVCHANGE request to
	// alter the packet size to 16383 bytes.
	if packetSize < 512 {
		packetSize = 512
	} else if packetSize > 32767 {
		packetSize = 32767
	}

initiate_connection:
	dialCtx := ctx
	if p.DialTimeout >= 0 {
		dt := p.DialTimeout
		if dt == 0 {
			dt = time.Duration(15*len(p.Protocols)) * time.Second
		}
		var cancel func()
		dialCtx, cancel = context.WithTimeout(ctx, dt)
		defer cancel()
	}
	conn, err := dialConnection(dialCtx, c, &p, logger)
	if err != nil {
		return nil, err
	}

	toconn := newTimeoutConn(conn, p.ConnTimeout)
	outbuf := newTdsBuffer(packetSize, toconn)

	if p.Encryption == msdsn.EncryptionStrict {
		outbuf.transport, err = getTLSConn(toconn, p, "tds/8.0")
		if err != nil {
			return nil, err
		}
		isTransportEncrypted = true
	}
	sess := newSession(outbuf, logger, p)

	for i, p := range c.keyProviders {
		sess.aeSettings.keyProviders[i] = p
	}
	fedAuth := &featureExtFedAuth{
		FedAuthLibrary: FedAuthLibraryReserved,
	}
	if c.fedAuthRequired {
		fedAuth.FedAuthLibrary = c.fedAuthLibrary
		fedAuth.ADALWorkflow = c.fedAuthADALWorkflow
	}

	fields := sess.preparePreloginFields(ctx, p, fedAuth)

	err = writePrelogin(packPrelogin, outbuf, fields)
	if err != nil {
		return nil, err
	}

	fields, err = readPrelogin(outbuf)
	if err != nil {
		return nil, err
	}

	encrypt, err := interpretPreloginResponse(p, fedAuth, fields)
	if err != nil {
		return nil, err
	}

	//We need not perform TLS handshake if the communication channel is already encrypted (encrypt=strict)
	if !isTransportEncrypted {
		if encrypt != encryptNotSup {
			var config *tls.Config
			if pc := p.TLSConfig; pc != nil {
				config = pc
				if !config.DynamicRecordSizingDisabled {
					config = config.Clone()

					// fix for https://github.com/microsoft/go-mssqldb/issues/166
					// Go implementation of TLS payload size heuristic algorithm splits single TDS package to multiple TCP segments,
					// while SQL Server seems to expect one TCP segment per encrypted TDS package.
					// Setting DynamicRecordSizingDisabled to true disables that algorithm and uses 16384 bytes per TLS package
					config.DynamicRecordSizingDisabled = true
				}
			}
			if config == nil {
				config, err = msdsn.SetupTLS("", false, p.Host, "")
				if err != nil {
					return nil, err
				}

			}

			// setting up connection handler which will allow wrapping of TLS handshake packets inside TDS stream
			handshakeConn := tlsHandshakeConn{buf: outbuf}
			passthrough := passthroughConn{c: &handshakeConn}
			tlsConn := tls.Client(&passthrough, config)
			err = tlsConn.Handshake()
			passthrough.c = toconn
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

	}

	auth, err := integratedauth.GetIntegratedAuthenticator(p)
	if err != nil {
		if uint64(p.LogFlags)&logDebug != 0 {
			logger.Log(ctx, msdsn.LogDebug, fmt.Sprintf("Error while creating integrated authenticator: %v", err))
		}

		return nil, err
	}

	if auth != nil {
		defer auth.Free()
	}

	login, err := prepareLogin(ctx, c, p, logger, auth, fedAuth, uint32(outbuf.PackageSize()))
	if err != nil {
		return nil, err
	}

	err = sendLogin(outbuf, login)
	if err != nil {
		return nil, err
	}

	// Loop until a packet containing a login acknowledgement is received.
	// SSPI and federated authentication scenarios may require multiple
	// packet exchanges to complete the login sequence.
	for loginAck := false; !loginAck; {
		reader := startReading(sess, ctx, outputs{})
		// don't send attention or wait for cancel confirmation during login
		reader.noAttn = true

		for {
			tok, err := reader.nextToken()
			if err != nil {
				return nil, err
			}

			if tok == nil {
				break
			}

			switch token := tok.(type) {
			case sspiMsg:
				sspi_msg, err := auth.NextBytes(token)
				if err != nil {
					return nil, err
				}
				if len(sspi_msg) > 0 {
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
			// TODO: for Live ID authentication it may be necessary to
			// compare fedAuth.Nonce == token.Nonce and keep track of signature
			//case fedAuthAckStruct:
			//fedAuth.Signature = token.Signature
			case fedAuthInfoStruct:
				// For ADAL workflows this contains the STS URL and server SPN.
				// If received outside of an ADAL workflow, ignore.
				if c == nil || c.adalTokenProvider == nil {
					continue
				}

				// Request the AD token given the server SPN and STS URL
				fedAuth.FedAuthToken, err = c.adalTokenProvider(ctx, token.ServerSPN, token.STSURL)
				if err != nil {
					return nil, err
				}

				// Now need to send the token as a FEDINFO packet
				err = sendFedAuthInfo(outbuf, fedAuth)
				if err != nil {
					return nil, err
				}
			case loginAckStruct:
				sess.loginAck = token
				loginAck = true
			case featureExtAck:
				for _, v := range token {
					switch v := v.(type) {
					case colAckStruct:
						if v.Version <= 2 && v.Version > 0 {
							sess.alwaysEncrypted = true
							if len(v.EnclaveType) > 0 {
								sess.aeSettings.enclaveType = string(v.EnclaveType)
							}
						}
					}
				}
			case doneStruct:
				if token.isError() {
					tokenErr := token.getError()
					tokenErr.Message = "login error: " + tokenErr.Message
					conn.Close()
					return nil, tokenErr
				}
			case error:
				return nil, fmt.Errorf("login error: %s", token.Error())
			}
		}
	}

	if sess.routedServer != "" {
		toconn.Close()
		// Need to handle case when routedServer is in "host\instance" format.
		routedParts := strings.SplitN(sess.routedServer, "\\", 2)
		p.Host = routedParts[0]
		if len(routedParts) == 2 {
			p.Instance = routedParts[1]
		}
		p.Port = uint64(sess.routedPort)
		if !p.HostInCertificateProvided && p.TLSConfig != nil {
			p.TLSConfig = p.TLSConfig.Clone()
			p.TLSConfig.ServerName = p.Host
		}
		goto initiate_connection
	}
	return sess, nil
}

type featureExtColumnEncryption struct {
}

func (f *featureExtColumnEncryption) featureID() byte {
	return featExtCOLUMNENCRYPTION
}

func (f *featureExtColumnEncryption) toBytes() []byte {
	/*
		1 = The client supports column encryption without enclave computations.
		2 = The client SHOULD<25> support column encryption when encrypted data require enclave computations.
		3 = The client SHOULD<26> support column encryption when encrypted data require enclave computations
		with the additional ability to cache column encryption keys that are to be sent to the enclave
		and the ability to retry queries when the keys sent by the client do not match what is needed for the query to run.
	*/
	return []byte{0x01}
}

// return the 6 byte hardware identifier for the LOGIN7 packet
func getClientId(mac *[6]byte) {
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, i := range interfaces {
			if i.Flags&net.FlagUp != 0 && i.HardwareAddr != nil {
				c := 6
				if len(i.HardwareAddr) < 6 {
					c = len(i.HardwareAddr)
				}
				copy(mac[:], i.HardwareAddr[:c])
				return
			}
		}
	}
}
