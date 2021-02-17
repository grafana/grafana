package mssql

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const defaultServerPort = 1433

type connectParams struct {
	logFlags                  uint64
	port                      uint64
	host                      string
	instance                  string
	database                  string
	user                      string
	password                  string
	dial_timeout              time.Duration
	conn_timeout              time.Duration
	keepAlive                 time.Duration
	encrypt                   bool
	disableEncryption         bool
	trustServerCertificate    bool
	certificate               string
	hostInCertificate         string
	hostInCertificateProvided bool
	serverSPN                 string
	workstation               string
	appname                   string
	typeFlags                 uint8
	failOverPartner           string
	failOverPort              uint64
	packetSize                uint16
	fedAuthAccessToken        string
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

	p.port = 0
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
	if ok {
		p.hostInCertificateProvided = true
	} else {
		p.hostInCertificate = p.host
		p.hostInCertificateProvided = false
	}

	serverSPN, ok := params["serverspn"]
	if ok {
		p.serverSPN = serverSPN
	} else {
		p.serverSPN = generateSpn(p.host, resolveServerPort(p.port))
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
			if p.database == "" {
				return p, fmt.Errorf("Database must be specified when ApplicationIntent is ReadOnly")
			}
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

func resolveServerPort(port uint64) uint64 {
	if port == 0 {
		return defaultServerPort
	}

	return port
}

func generateSpn(host string, port uint64) string {
	return fmt.Sprintf("MSSQLSvc/%s:%d", host, port)
}
