package msdsn

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
)

type (
	Encryption int
	Log        uint64
	BrowserMsg byte
)

const (
	DsnTypeURL  = 1
	DsnTypeOdbc = 2
	DsnTypeAdo  = 3
)

const (
	EncryptionOff      = 0
	EncryptionRequired = 1
	EncryptionDisabled = 3
	EncryptionStrict   = 4
)

const (
	LogErrors      Log = 1
	LogMessages    Log = 2
	LogRows        Log = 4
	LogSQL         Log = 8
	LogParams      Log = 16
	LogTransaction Log = 32
	LogDebug       Log = 64
	LogRetries     Log = 128
	// LogSessionIDs tells the session logger to include activity id and connection id
	LogSessionIDs Log = 0x8000
)

const (
	BrowserDefault      BrowserMsg = 0
	BrowserAllInstances BrowserMsg = 0x03
	BrowserDAC          BrowserMsg = 0x0f
)

const (
	Database               = "database"
	Encrypt                = "encrypt"
	Password               = "password"
	ChangePassword         = "change password"
	UserID                 = "user id"
	Port                   = "port"
	TrustServerCertificate = "trustservercertificate"
	Certificate            = "certificate"
	TLSMin                 = "tlsmin"
	PacketSize             = "packet size"
	LogParam               = "log"
	ConnectionTimeout      = "connection timeout"
	HostNameInCertificate  = "hostnameincertificate"
	KeepAlive              = "keepalive"
	ServerSpn              = "serverspn"
	WorkstationID          = "workstation id"
	AppName                = "app name"
	ApplicationIntent      = "applicationintent"
	FailoverPartner        = "failoverpartner"
	FailOverPort           = "failoverport"
	DisableRetry           = "disableretry"
	Server                 = "server"
	Protocol               = "protocol"
	DialTimeout            = "dial timeout"
	Pipe                   = "pipe"
	MultiSubnetFailover    = "multisubnetfailover"
	NoTraceID              = "notraceid"
	GuidConversion         = "guid conversion"
	Timezone               = "timezone"
)

type EncodeParameters struct {
	// Properly convert GUIDs, using correct byte endianness
	GuidConversion bool
	// Timezone is the timezone to use for encoding and decoding datetime values.
	Timezone *time.Location
}

func (e EncodeParameters) GetTimezone() *time.Location {
	if e.Timezone == nil {
		return time.UTC
	}
	return e.Timezone
}

type Config struct {
	Port       uint64
	Host       string
	Instance   string
	Database   string
	User       string
	Password   string
	Encryption Encryption
	TLSConfig  *tls.Config

	FailOverPartner string
	FailOverPort    uint64

	// If true the TLSConfig servername should use the routed server.
	HostInCertificateProvided bool

	// Read Only intent for application database.
	// NOTE: This does not make queries to most databases read-only.
	ReadOnlyIntent bool

	LogFlags Log

	ServerSPN   string
	Workstation string
	AppName     string

	// If true disables database/sql's automatic retry of queries
	// that start on bad connections.
	DisableRetry bool

	// Do not use the following.

	DialTimeout time.Duration // DialTimeout defaults to 15s per protocol. Set negative to disable.
	ConnTimeout time.Duration // Use context for timeouts.
	KeepAlive   time.Duration // Leave at default.
	PacketSize  uint16

	Parameters map[string]string
	// Protocols is an ordered list of protocols to dial
	Protocols []string
	// ProtocolParameters are written by non-tcp ProtocolParser implementations
	ProtocolParameters map[string]interface{}
	// BrowserMsg is the message identifier to fetch instance data from SQL browser
	BrowserMessage BrowserMsg
	// ChangePassword is used to set the login's password during login. Ignored for non-SQL authentication.
	ChangePassword string
	//ColumnEncryption is true if the application needs to decrypt or encrypt Always Encrypted values
	ColumnEncryption bool
	// Attempt to connect to all IPs in parallel when MultiSubnetFailover is true
	MultiSubnetFailover bool
	// guid to set as Activity Id in the prelogin packet. Defaults to a new value for each Config.
	ActivityID []byte
	// When true, no connection id or trace id value is sent in the prelogin packet.
	// Some cloud servers may block connections that lack such values.
	NoTraceID bool
	// Parameters related to type encoding
	Encoding EncodeParameters
}

func readDERFile(filename string) ([]byte, error) {
	derBytes, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	cert, err := x509.ParseCertificate(derBytes)
	if err != nil {
		return nil, err
	}

	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert.Raw,
	})
	return pemBytes, nil
}

func readCertificate(certificate string) ([]byte, error) {
	certType := strings.ToLower(filepath.Ext(certificate))

	switch certType {
	case ".pem":
		return os.ReadFile(certificate)
	case ".der":
		return readDERFile(certificate)
	default:
		return nil, fmt.Errorf("certificate type %s is not supported", certType)
	}
}

// Build a tls.Config object from the supplied certificate.
func SetupTLS(certificate string, insecureSkipVerify bool, hostInCertificate string, minTLSVersion string) (*tls.Config, error) {
	config := tls.Config{
		ServerName:         hostInCertificate,
		InsecureSkipVerify: insecureSkipVerify,

		// fix for https://github.com/microsoft/go-mssqldb/issues/166
		// Go implementation of TLS payload size heuristic algorithm splits single TDS package to multiple TCP segments,
		// while SQL Server seems to expect one TCP segment per encrypted TDS package.
		// Setting DynamicRecordSizingDisabled to true disables that algorithm and uses 16384 bytes per TLS package
		DynamicRecordSizingDisabled: true,
		MinVersion:                  TLSVersionFromString(minTLSVersion),
	}

	if len(certificate) == 0 {
		return &config, nil
	}
	pem, err := readCertificate(certificate)
	if err != nil {
		return nil, fmt.Errorf("cannot read certificate %q: %w", certificate, err)
	}
	if strings.Contains(config.ServerName, ":") && !insecureSkipVerify {
		err := setupTLSCommonName(&config, pem)
		if err != skipSetup {
			return &config, err
		}
	}
	certs := x509.NewCertPool()
	certs.AppendCertsFromPEM(pem)
	config.RootCAs = certs
	return &config, nil
}

// Parse and handle encryption parameters. If encryption is desired, it returns the corresponding tls.Config object.
func parseTLS(params map[string]string, host string) (Encryption, *tls.Config, error) {
	trustServerCert := false

	var encryption Encryption = EncryptionOff
	encrypt, ok := params[Encrypt]
	if ok {
		encrypt = strings.ToLower(encrypt)
		switch encrypt {
		case "mandatory", "yes", "1", "t", "true":
			encryption = EncryptionRequired
		case "disable":
			encryption = EncryptionDisabled
		case "strict":
			encryption = EncryptionStrict
		case "optional", "no", "0", "f", "false":
			encryption = EncryptionOff
		default:
			f := "invalid encrypt '%s'"
			return encryption, nil, fmt.Errorf(f, encrypt)
		}
	} else {
		trustServerCert = true
	}
	trust, ok := params[TrustServerCertificate]
	if ok {
		var err error
		trustServerCert, err = strconv.ParseBool(trust)
		if err != nil {
			f := "invalid trust server certificate '%s': %s"
			return encryption, nil, fmt.Errorf(f, trust, err.Error())
		}
	}
	certificate := params[Certificate]
	if encryption != EncryptionDisabled {
		tlsMin := params[TLSMin]
		if encrypt == "strict" {
			trustServerCert = false
		}
		tlsConfig, err := SetupTLS(certificate, trustServerCert, host, tlsMin)
		if err != nil {
			return encryption, nil, fmt.Errorf("failed to setup TLS: %w", err)
		}
		return encryption, tlsConfig, nil
	}
	return encryption, nil, nil
}

var skipSetup = errors.New("skip setting up TLS")

func getDsnType(dsn string) int {
	if strings.HasPrefix(dsn, "sqlserver://") {
		return DsnTypeURL
	}
	if strings.HasPrefix(dsn, "odbc:") {
		return DsnTypeOdbc
	}
	return DsnTypeAdo
}

func getDsnParams(dsn string) (map[string]string, error) {

	var params map[string]string
	var err error

	switch getDsnType(dsn) {
	case DsnTypeOdbc:
		params, err = splitConnectionStringOdbc(dsn[len("odbc:"):])
		if err != nil {
			return params, err
		}
	case DsnTypeURL:
		params, err = splitConnectionStringURL(dsn)
		if err != nil {
			return params, err
		}
	default:
		params = splitConnectionString(dsn)
	}
	return params, nil
}

func Parse(dsn string) (Config, error) {
	p := Config{
		ProtocolParameters: map[string]interface{}{},
		Protocols:          []string{},
		Encoding: EncodeParameters{
			Timezone: time.UTC,
		},
	}

	activityid, uerr := uuid.NewRandom()
	if uerr == nil {
		p.ActivityID = activityid[:]
	}
	var params map[string]string
	var err error

	params, err = getDsnParams(dsn)
	if err != nil {
		return p, err
	}
	p.Parameters = params

	strlog, ok := params[LogParam]
	if ok {
		flags, err := strconv.ParseUint(strlog, 10, 64)
		if err != nil {
			return p, fmt.Errorf("invalid log parameter '%s': %s", strlog, err.Error())
		}
		p.LogFlags = Log(flags)
	}

	tz, ok := params[Timezone]
	if ok {
		location, err := time.LoadLocation(tz)
		if err != nil {
			return p, fmt.Errorf("invalid timezone '%s': %s", tz, err.Error())
		}
		p.Encoding.Timezone = location
	}

	p.Database = params[Database]
	p.User = params[UserID]
	p.Password = params[Password]
	p.ChangePassword = params[ChangePassword]
	p.Port = 0
	strport, ok := params[Port]
	if ok {
		var err error
		p.Port, err = strconv.ParseUint(strport, 10, 16)
		if err != nil {
			f := "invalid tcp port '%v': %v"
			return p, fmt.Errorf(f, strport, err.Error())
		}
	}

	// https://docs.microsoft.com/en-us/sql/database-engine/configure-windows/configure-the-network-packet-size-server-configuration-option\
	strpsize, ok := params[PacketSize]
	if ok {
		var err error
		psize, err := strconv.ParseUint(strpsize, 0, 16)
		if err != nil {
			f := "invalid packet size '%v': %v"
			return p, fmt.Errorf(f, strpsize, err.Error())
		}

		// Ensure packet size falls within the TDS protocol range of 512 to 32767 bytes
		// NOTE: Encrypted connections have a maximum size of 16383 bytes.  If you request
		// a higher packet size, the server will respond with an ENVCHANGE request to
		// alter the packet size to 16383 bytes.
		p.PacketSize = uint16(psize)
		if p.PacketSize < 512 {
			p.PacketSize = 512
		} else if p.PacketSize > 32767 {
			p.PacketSize = 32767
		}
	}

	// https://msdn.microsoft.com/en-us/library/dd341108.aspx
	//
	// Do not set a connection timeout. Use Context to manage such things.
	// Default to zero, but still allow it to be set.
	if strconntimeout, ok := params[ConnectionTimeout]; ok {
		timeout, err := strconv.ParseUint(strconntimeout, 10, 64)
		if err != nil {
			f := "invalid connection timeout '%v': %v"
			return p, fmt.Errorf(f, strconntimeout, err.Error())
		}
		p.ConnTimeout = time.Duration(timeout) * time.Second
	}

	// default keep alive should be 30 seconds according to spec:
	// https://msdn.microsoft.com/en-us/library/dd341108.aspx
	p.KeepAlive = 30 * time.Second
	if keepAlive, ok := params[KeepAlive]; ok {
		timeout, err := strconv.ParseUint(keepAlive, 10, 64)
		if err != nil {
			f := "invalid keepAlive value '%s': %s"
			return p, fmt.Errorf(f, keepAlive, err.Error())
		}
		p.KeepAlive = time.Duration(timeout) * time.Second
	}

	serverSPN, ok := params[ServerSpn]
	if ok {
		p.ServerSPN = serverSPN
	} // If not set by the app, ServerSPN will be set by the successful dialer.

	workstation, ok := params[WorkstationID]
	if ok {
		p.Workstation = workstation
	} else {
		workstation, err := os.Hostname()
		if err == nil {
			p.Workstation = workstation
		}
	}

	appname, ok := params[AppName]
	if !ok {
		appname = "go-mssqldb"
	}
	p.AppName = appname

	appintent, ok := params[ApplicationIntent]
	if ok {
		if appintent == "ReadOnly" {
			if p.Database == "" {
				return p, fmt.Errorf("database must be specified when ApplicationIntent is ReadOnly")
			}
			p.ReadOnlyIntent = true
		}
	}

	failOverPartner, ok := params[FailoverPartner]
	if ok {
		p.FailOverPartner = failOverPartner
	}

	failOverPort, ok := params[FailOverPort]
	if ok {
		var err error
		p.FailOverPort, err = strconv.ParseUint(failOverPort, 0, 16)
		if err != nil {
			f := "invalid failover port '%v': %v"
			return p, fmt.Errorf(f, failOverPort, err.Error())
		}
	}

	disableRetry, ok := params[DisableRetry]
	if ok {
		var err error
		p.DisableRetry, err = strconv.ParseBool(disableRetry)
		if err != nil {
			f := "invalid disableRetry '%s': %s"
			return p, fmt.Errorf(f, disableRetry, err.Error())
		}
	} else {
		p.DisableRetry = disableRetryDefault
	}

	server := params[Server]
	protocol, ok := params[Protocol]

	for _, parser := range ProtocolParsers {
		if (!ok && !parser.Hidden()) || parser.Protocol() == protocol {
			err = parser.ParseServer(server, &p)
			if err != nil {
				// if the caller only wants this protocol , fail right away
				if ok {
					return p, err
				}
			} else {
				// Only enable a protocol if it can handle the server name
				p.Protocols = append(p.Protocols, parser.Protocol())
			}

		}
	}
	if ok && len(p.Protocols) == 0 {
		return p, fmt.Errorf("No protocol handler is available for protocol: '%s'", protocol)
	}

	f := len(p.Protocols)
	if f == 0 {
		f = 1
	}
	p.DialTimeout = time.Duration(15*f) * time.Second
	if strdialtimeout, ok := params[DialTimeout]; ok {
		timeout, err := strconv.ParseUint(strdialtimeout, 10, 64)
		if err != nil {
			f := "invalid dial timeout '%v': %v"
			return p, fmt.Errorf(f, strdialtimeout, err.Error())
		}

		p.DialTimeout = time.Duration(timeout) * time.Second
	}

	hostInCertificate, ok := params[HostNameInCertificate]
	if ok {
		p.HostInCertificateProvided = true
	} else {
		hostInCertificate = p.Host
		p.HostInCertificateProvided = false
	}

	p.Encryption, p.TLSConfig, err = parseTLS(params, hostInCertificate)
	if err != nil {
		return p, err
	}

	if c, ok := params["columnencryption"]; ok {
		columnEncryption, err := strconv.ParseBool(c)
		if err != nil {
			if strings.EqualFold(c, "Enabled") {
				columnEncryption = true
			} else if strings.EqualFold(c, "Disabled") {
				columnEncryption = false
			} else {
				return p, fmt.Errorf("invalid columnencryption '%v' : %v", columnEncryption, err.Error())
			}
		}
		p.ColumnEncryption = columnEncryption
	}

	msf, ok := params[MultiSubnetFailover]
	if ok {
		multiSubnetFailover, err := strconv.ParseBool(msf)
		if err != nil {
			if strings.EqualFold(msf, "Enabled") {
				multiSubnetFailover = true
			} else if strings.EqualFold(msf, "Disabled") {
				multiSubnetFailover = false
			} else {
				return p, fmt.Errorf("invalid multiSubnetFailover value '%v': %v", multiSubnetFailover, err.Error())
			}
		}
		p.MultiSubnetFailover = multiSubnetFailover
	} else {
		// Defaulting to true to prevent breaking change although other client libraries default to false
		p.MultiSubnetFailover = true
	}
	nti, ok := params[NoTraceID]
	if ok {
		notraceid, err := strconv.ParseBool(nti)
		if err == nil {
			p.NoTraceID = notraceid
		}
	}

	guidConversion, ok := params[GuidConversion]
	if ok {
		var err error
		p.Encoding.GuidConversion, err = strconv.ParseBool(guidConversion)
		if err != nil {
			f := "invalid guid conversion '%s': %s"
			return p, fmt.Errorf(f, guidConversion, err.Error())
		}
	} else {
		// set to false for backward compatibility
		p.Encoding.GuidConversion = false
	}

	return p, nil
}

// convert connectionParams to url style connection string
// used mostly for testing
func (p Config) URL() *url.URL {
	q := url.Values{}
	if p.Database != "" {
		q.Add(Database, p.Database)
	}
	if p.LogFlags != 0 {
		q.Add(LogParam, strconv.FormatUint(uint64(p.LogFlags), 10))
	}
	host := p.Host
	protocol := ""
	// Can't just check for a : because of IPv6 host names
	if strings.HasPrefix(host, "admin") || strings.HasPrefix(host, "np") || strings.HasPrefix(host, "sm") || strings.HasPrefix(host, "tcp") {
		hostParts := strings.SplitN(p.Host, ":", 2)
		if len(hostParts) > 1 {
			host = hostParts[1]
			protocol = hostParts[0]
		}
	}
	if p.Port > 0 {
		host = fmt.Sprintf("%s:%d", host, p.Port)
	}
	q.Add(DisableRetry, fmt.Sprintf("%t", p.DisableRetry))
	protocolParam, ok := p.Parameters[Protocol]
	if ok {
		if protocol != "" && protocolParam != protocol {
			panic("Mismatched protocol parameters!")
		}
		protocol = protocolParam
	}
	if protocol != "" {
		q.Add(Protocol, protocol)
	}
	pipe, ok := p.Parameters[Pipe]
	if ok {
		q.Add(Pipe, pipe)
	}
	res := url.URL{
		Scheme: "sqlserver",
		Host:   host,
		User:   url.UserPassword(p.User, p.Password),
	}
	if p.Instance != "" {
		res.Path = p.Instance
	}
	q.Add(DialTimeout, strconv.FormatFloat(float64(p.DialTimeout.Seconds()), 'f', 0, 64))

	switch p.Encryption {
	case EncryptionDisabled:
		q.Add(Encrypt, "DISABLE")
	case EncryptionRequired:
		q.Add(Encrypt, "true")
	}
	if p.ColumnEncryption {
		q.Add("columnencryption", "true")
	}

	if p.Encoding.GuidConversion {
		q.Add(GuidConversion, strconv.FormatBool(p.Encoding.GuidConversion))
	}

	if tz := p.Encoding.Timezone; tz != nil && tz != time.UTC {
		q.Add(Timezone, tz.String())
	}

	if len(q) > 0 {
		res.RawQuery = q.Encode()
	}

	return &res
}

// ADO connection string keywords at https://github.com/dotnet/SqlClient/blob/main/src/Microsoft.Data.SqlClient/src/Microsoft/Data/Common/DbConnectionStringCommon.cs
var adoSynonyms = map[string]string{
	"application name":          AppName,
	"data source":               Server,
	"address":                   Server,
	"network address":           Server,
	"addr":                      Server,
	"user":                      UserID,
	"uid":                       UserID,
	"pwd":                       Password,
	"initial catalog":           Database,
	"column encryption setting": "columnencryption",
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
		synonym, hasSynonym := adoSynonyms[name]
		if hasSynonym {
			name = synonym
		}
		// "server" in ADO can include a protocol and a port.
		if name == Server {
			for _, parser := range ProtocolParsers {
				prot := parser.Protocol() + ":"
				if strings.HasPrefix(value, prot) {
					res[Protocol] = parser.Protocol()
				}
				value = strings.TrimPrefix(value, prot)
			}
			serverParts := strings.Split(value, ",")
			if len(serverParts) == 2 && len(serverParts[1]) > 0 {
				value = serverParts[0]
				res[Port] = serverParts[1]
			}
		}
		res[name] = value
	}
	return res
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
		res[UserID] = u.User.Username()
		p, exists := u.User.Password()
		if exists {
			res[Password] = p
		}
	}

	host, port, err := net.SplitHostPort(u.Host)
	if err != nil {
		host = u.Host
	}

	if len(u.Path) > 0 {
		res[Server] = host + "\\" + u.Path[1:]
	} else {
		res[Server] = host
	}

	if len(port) > 0 {
		res[Port] = port
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
				return res, fmt.Errorf("unexpected character = at index %d. Expected start of key or semi-colon or whitespace", i)
			case !unicode.IsSpace(c) && c != ';':
				state = parserStateKey
				key += string(c)
			}

		case parserStateKey:
			switch c {
			case '=':
				key = normalizeOdbcKey(key)
				state = parserStateBeginValue

			case ';':
				// Key without value
				key = normalizeOdbcKey(key)
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
				return res, fmt.Errorf("unexpected character %c at index %d. Expected semi-colon or whitespace", c, i)
			}

		case parserStateEndValue:
			switch {
			case c == ';':
				state = parserStateBeforeKey
			case unicode.IsSpace(c):
				// Ignore whitespace
			default:
				return res, fmt.Errorf("unexpected character %c at index %d. Expected semi-colon or whitespace", c, i)
			}
		}
	}

	switch state {
	case parserStateBeforeKey: // Okay
	case parserStateKey: // Unfinished key. Treat as key without value.
		key = normalizeOdbcKey(key)
		res[key] = value
	case parserStateBeginValue: // Empty value
		res[key] = value
	case parserStateBareValue:
		res[key] = strings.TrimRightFunc(value, unicode.IsSpace)
	case parserStateBracedValue:
		return res, fmt.Errorf("unexpected end of braced value at index %d", len(dsn))
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

// ProtocolParser can populate Config with parameters to dial using its protocol
type ProtocolParser interface {
	// ParseServer updates the Config with protocol properties from the server. Returns an error if the server isn't compatible.
	ParseServer(server string, p *Config) error
	// Protocol returns the name of the protocol dialer
	Protocol() string
	// Hidden returns true if this protocol must be explicitly chosen by the application
	Hidden() bool
}

// ProtocolParsers is an ordered list of protocols that can be dialed. Each parser must have a corresponding Dialer in mssql.ProtocolDialers
var ProtocolParsers []ProtocolParser = []ProtocolParser{
	tcpParser{Prefix: "tcp"},
	tcpParser{Prefix: "admin"},
}

type tcpParser struct {
	Prefix string
}

func (t tcpParser) Hidden() bool {
	return t.Prefix == "admin"
}

func (t tcpParser) ParseServer(server string, p *Config) error {
	// a server name can have different forms
	parts := strings.SplitN(server, `\`, 2)
	p.Host = parts[0]
	if p.Host == "." || strings.ToUpper(p.Host) == "(LOCAL)" || p.Host == "" {
		p.Host = "localhost"
	}
	if len(parts) > 1 {
		p.Instance = parts[1]
	}
	if t.Prefix == "admin" {
		if p.Instance == "" {
			p.Port = 1434
		}
		p.BrowserMessage = BrowserDAC
	} else {
		p.BrowserMessage = BrowserAllInstances
	}
	return nil
}

func (t tcpParser) Protocol() string {
	return t.Prefix
}
