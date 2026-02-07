package pgconn

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgpassfile"
	"github.com/jackc/pgservicefile"
	"github.com/jackc/pgx/v5/pgconn/ctxwatch"
	"github.com/jackc/pgx/v5/pgproto3"
)

type (
	AfterConnectFunc    func(ctx context.Context, pgconn *PgConn) error
	ValidateConnectFunc func(ctx context.Context, pgconn *PgConn) error
	GetSSLPasswordFunc  func(ctx context.Context) string
)

// Config is the settings used to establish a connection to a PostgreSQL server. It must be created by [ParseConfig]. A
// manually initialized Config will cause ConnectConfig to panic.
type Config struct {
	Host           string // host (e.g. localhost) or absolute path to unix domain socket directory (e.g. /private/tmp)
	Port           uint16
	Database       string
	User           string
	Password       string
	TLSConfig      *tls.Config // nil disables TLS
	ConnectTimeout time.Duration
	DialFunc       DialFunc   // e.g. net.Dialer.DialContext
	LookupFunc     LookupFunc // e.g. net.Resolver.LookupHost
	BuildFrontend  BuildFrontendFunc

	// BuildContextWatcherHandler is called to create a ContextWatcherHandler for a connection. The handler is called
	// when a context passed to a PgConn method is canceled.
	BuildContextWatcherHandler func(*PgConn) ctxwatch.Handler

	RuntimeParams map[string]string // Run-time parameters to set on connection as session default values (e.g. search_path or application_name)

	KerberosSrvName string
	KerberosSpn     string
	Fallbacks       []*FallbackConfig

	SSLNegotiation string // sslnegotiation=postgres or sslnegotiation=direct

	// ValidateConnect is called during a connection attempt after a successful authentication with the PostgreSQL server.
	// It can be used to validate that the server is acceptable. If this returns an error the connection is closed and the next
	// fallback config is tried. This allows implementing high availability behavior such as libpq does with target_session_attrs.
	ValidateConnect ValidateConnectFunc

	// AfterConnect is called after ValidateConnect. It can be used to set up the connection (e.g. Set session variables
	// or prepare statements). If this returns an error the connection attempt fails.
	AfterConnect AfterConnectFunc

	// OnNotice is a callback function called when a notice response is received.
	OnNotice NoticeHandler

	// OnNotification is a callback function called when a notification from the LISTEN/NOTIFY system is received.
	OnNotification NotificationHandler

	// OnPgError is a callback function called when a Postgres error is received by the server. The default handler will close
	// the connection on any FATAL errors. If you override this handler you should call the previously set handler or ensure
	// that you close on FATAL errors by returning false.
	OnPgError PgErrorHandler

	createdByParseConfig bool // Used to enforce created by ParseConfig rule.
}

// ParseConfigOptions contains options that control how a config is built such as GetSSLPassword.
type ParseConfigOptions struct {
	// GetSSLPassword gets the password to decrypt a SSL client certificate. This is analogous to the libpq function
	// PQsetSSLKeyPassHook_OpenSSL.
	GetSSLPassword GetSSLPasswordFunc
}

// Copy returns a deep copy of the config that is safe to use and modify.
// The only exception is the TLSConfig field:
// according to the tls.Config docs it must not be modified after creation.
func (c *Config) Copy() *Config {
	newConf := new(Config)
	*newConf = *c
	if newConf.TLSConfig != nil {
		newConf.TLSConfig = c.TLSConfig.Clone()
	}
	if newConf.RuntimeParams != nil {
		newConf.RuntimeParams = make(map[string]string, len(c.RuntimeParams))
		for k, v := range c.RuntimeParams {
			newConf.RuntimeParams[k] = v
		}
	}
	if newConf.Fallbacks != nil {
		newConf.Fallbacks = make([]*FallbackConfig, len(c.Fallbacks))
		for i, fallback := range c.Fallbacks {
			newFallback := new(FallbackConfig)
			*newFallback = *fallback
			if newFallback.TLSConfig != nil {
				newFallback.TLSConfig = fallback.TLSConfig.Clone()
			}
			newConf.Fallbacks[i] = newFallback
		}
	}
	return newConf
}

// FallbackConfig is additional settings to attempt a connection with when the primary Config fails to establish a
// network connection. It is used for TLS fallback such as sslmode=prefer and high availability (HA) connections.
type FallbackConfig struct {
	Host      string // host (e.g. localhost) or path to unix domain socket directory (e.g. /private/tmp)
	Port      uint16
	TLSConfig *tls.Config // nil disables TLS
}

// connectOneConfig is the configuration for a single attempt to connect to a single host.
type connectOneConfig struct {
	network          string
	address          string
	originalHostname string      // original hostname before resolving
	tlsConfig        *tls.Config // nil disables TLS
}

// isAbsolutePath checks if the provided value is an absolute path either
// beginning with a forward slash (as on Linux-based systems) or with a capital
// letter A-Z followed by a colon and a backslash, e.g., "C:\", (as on Windows).
func isAbsolutePath(path string) bool {
	isWindowsPath := func(p string) bool {
		if len(p) < 3 {
			return false
		}
		drive := p[0]
		colon := p[1]
		backslash := p[2]
		if drive >= 'A' && drive <= 'Z' && colon == ':' && backslash == '\\' {
			return true
		}
		return false
	}
	return strings.HasPrefix(path, "/") || isWindowsPath(path)
}

// NetworkAddress converts a PostgreSQL host and port into network and address suitable for use with
// net.Dial.
func NetworkAddress(host string, port uint16) (network, address string) {
	if isAbsolutePath(host) {
		network = "unix"
		address = filepath.Join(host, ".s.PGSQL.") + strconv.FormatInt(int64(port), 10)
	} else {
		network = "tcp"
		address = net.JoinHostPort(host, strconv.Itoa(int(port)))
	}
	return network, address
}

// ParseConfig builds a *Config from connString with similar behavior to the PostgreSQL standard C library libpq. It
// uses the same defaults as libpq (e.g. port=5432) and understands most PG* environment variables. ParseConfig closely
// matches the parsing behavior of libpq. connString may either be in URL format or keyword = value format. See
// https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING for details. connString also may be empty
// to only read from the environment. If a password is not supplied it will attempt to read the .pgpass file.
//
//	# Example Keyword/Value
//	user=jack password=secret host=pg.example.com port=5432 dbname=mydb sslmode=verify-ca
//
//	# Example URL
//	postgres://jack:secret@pg.example.com:5432/mydb?sslmode=verify-ca
//
// The returned *Config may be modified. However, it is strongly recommended that any configuration that can be done
// through the connection string be done there. In particular the fields Host, Port, TLSConfig, and Fallbacks can be
// interdependent (e.g. TLSConfig needs knowledge of the host to validate the server certificate). These fields should
// not be modified individually. They should all be modified or all left unchanged.
//
// ParseConfig supports specifying multiple hosts in similar manner to libpq. Host and port may include comma separated
// values that will be tried in order. This can be used as part of a high availability system. See
// https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-MULTIPLE-HOSTS for more information.
//
//	# Example URL
//	postgres://jack:secret@foo.example.com:5432,bar.example.com:5432/mydb
//
// ParseConfig currently recognizes the following environment variable and their parameter key word equivalents passed
// via database URL or keyword/value:
//
//	PGHOST
//	PGPORT
//	PGDATABASE
//	PGUSER
//	PGPASSWORD
//	PGPASSFILE
//	PGSERVICE
//	PGSERVICEFILE
//	PGSSLMODE
//	PGSSLCERT
//	PGSSLKEY
//	PGSSLROOTCERT
//	PGSSLPASSWORD
//	PGOPTIONS
//	PGAPPNAME
//	PGCONNECT_TIMEOUT
//	PGTARGETSESSIONATTRS
//	PGTZ
//
// See http://www.postgresql.org/docs/current/static/libpq-envars.html for details on the meaning of environment variables.
//
// See https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-PARAMKEYWORDS for parameter key word names. They are
// usually but not always the environment variable name downcased and without the "PG" prefix.
//
// Important Security Notes:
//
// ParseConfig tries to match libpq behavior with regard to PGSSLMODE. This includes defaulting to "prefer" behavior if
// not set.
//
// See http://www.postgresql.org/docs/current/static/libpq-ssl.html#LIBPQ-SSL-PROTECTION for details on what level of
// security each sslmode provides.
//
// The sslmode "prefer" (the default), sslmode "allow", and multiple hosts are implemented via the Fallbacks field of
// the Config struct. If TLSConfig is manually changed it will not affect the fallbacks. For example, in the case of
// sslmode "prefer" this means it will first try the main Config settings which use TLS, then it will try the fallback
// which does not use TLS. This can lead to an unexpected unencrypted connection if the main TLS config is manually
// changed later but the unencrypted fallback is present. Ensure there are no stale fallbacks when manually setting
// TLSConfig.
//
// Other known differences with libpq:
//
// When multiple hosts are specified, libpq allows them to have different passwords set via the .pgpass file. pgconn
// does not.
//
// In addition, ParseConfig accepts the following options:
//
//   - servicefile.
//     libpq only reads servicefile from the PGSERVICEFILE environment variable. ParseConfig accepts servicefile as a
//     part of the connection string.
func ParseConfig(connString string) (*Config, error) {
	var parseConfigOptions ParseConfigOptions
	return ParseConfigWithOptions(connString, parseConfigOptions)
}

// ParseConfigWithOptions builds a *Config from connString and options with similar behavior to the PostgreSQL standard
// C library libpq. options contains settings that cannot be specified in a connString such as providing a function to
// get the SSL password.
func ParseConfigWithOptions(connString string, options ParseConfigOptions) (*Config, error) {
	defaultSettings := defaultSettings()
	envSettings := parseEnvSettings()

	connStringSettings := make(map[string]string)
	if connString != "" {
		var err error
		// connString may be a database URL or in PostgreSQL keyword/value format
		if strings.HasPrefix(connString, "postgres://") || strings.HasPrefix(connString, "postgresql://") {
			connStringSettings, err = parseURLSettings(connString)
			if err != nil {
				return nil, &ParseConfigError{ConnString: connString, msg: "failed to parse as URL", err: err}
			}
		} else {
			connStringSettings, err = parseKeywordValueSettings(connString)
			if err != nil {
				return nil, &ParseConfigError{ConnString: connString, msg: "failed to parse as keyword/value", err: err}
			}
		}
	}

	settings := mergeSettings(defaultSettings, envSettings, connStringSettings)
	if service, present := settings["service"]; present {
		serviceSettings, err := parseServiceSettings(settings["servicefile"], service)
		if err != nil {
			return nil, &ParseConfigError{ConnString: connString, msg: "failed to read service", err: err}
		}

		settings = mergeSettings(defaultSettings, envSettings, serviceSettings, connStringSettings)
	}

	config := &Config{
		createdByParseConfig: true,
		Database:             settings["database"],
		User:                 settings["user"],
		Password:             settings["password"],
		RuntimeParams:        make(map[string]string),
		BuildFrontend: func(r io.Reader, w io.Writer) *pgproto3.Frontend {
			return pgproto3.NewFrontend(r, w)
		},
		BuildContextWatcherHandler: func(pgConn *PgConn) ctxwatch.Handler {
			return &DeadlineContextWatcherHandler{Conn: pgConn.conn}
		},
		OnPgError: func(_ *PgConn, pgErr *PgError) bool {
			// we want to automatically close any fatal errors
			if strings.EqualFold(pgErr.Severity, "FATAL") {
				return false
			}
			return true
		},
	}

	if connectTimeoutSetting, present := settings["connect_timeout"]; present {
		connectTimeout, err := parseConnectTimeoutSetting(connectTimeoutSetting)
		if err != nil {
			return nil, &ParseConfigError{ConnString: connString, msg: "invalid connect_timeout", err: err}
		}
		config.ConnectTimeout = connectTimeout
		config.DialFunc = makeConnectTimeoutDialFunc(connectTimeout)
	} else {
		defaultDialer := makeDefaultDialer()
		config.DialFunc = defaultDialer.DialContext
	}

	config.LookupFunc = makeDefaultResolver().LookupHost

	notRuntimeParams := map[string]struct{}{
		"host":                 {},
		"port":                 {},
		"database":             {},
		"user":                 {},
		"password":             {},
		"passfile":             {},
		"connect_timeout":      {},
		"sslmode":              {},
		"sslkey":               {},
		"sslcert":              {},
		"sslrootcert":          {},
		"sslnegotiation":       {},
		"sslpassword":          {},
		"sslsni":               {},
		"krbspn":               {},
		"krbsrvname":           {},
		"target_session_attrs": {},
		"service":              {},
		"servicefile":          {},
	}

	// Adding kerberos configuration
	if _, present := settings["krbsrvname"]; present {
		config.KerberosSrvName = settings["krbsrvname"]
	}
	if _, present := settings["krbspn"]; present {
		config.KerberosSpn = settings["krbspn"]
	}

	for k, v := range settings {
		if _, present := notRuntimeParams[k]; present {
			continue
		}
		config.RuntimeParams[k] = v
	}

	fallbacks := []*FallbackConfig{}

	hosts := strings.Split(settings["host"], ",")
	ports := strings.Split(settings["port"], ",")

	for i, host := range hosts {
		var portStr string
		if i < len(ports) {
			portStr = ports[i]
		} else {
			portStr = ports[0]
		}

		port, err := parsePort(portStr)
		if err != nil {
			return nil, &ParseConfigError{ConnString: connString, msg: "invalid port", err: err}
		}

		var tlsConfigs []*tls.Config

		// Ignore TLS settings if Unix domain socket like libpq
		if network, _ := NetworkAddress(host, port); network == "unix" {
			tlsConfigs = append(tlsConfigs, nil)
		} else {
			var err error
			tlsConfigs, err = configTLS(settings, host, options)
			if err != nil {
				return nil, &ParseConfigError{ConnString: connString, msg: "failed to configure TLS", err: err}
			}
		}

		for _, tlsConfig := range tlsConfigs {
			fallbacks = append(fallbacks, &FallbackConfig{
				Host:      host,
				Port:      port,
				TLSConfig: tlsConfig,
			})
		}
	}

	config.Host = fallbacks[0].Host
	config.Port = fallbacks[0].Port
	config.TLSConfig = fallbacks[0].TLSConfig
	config.Fallbacks = fallbacks[1:]
	config.SSLNegotiation = settings["sslnegotiation"]

	passfile, err := pgpassfile.ReadPassfile(settings["passfile"])
	if err == nil {
		if config.Password == "" {
			host := config.Host
			if network, _ := NetworkAddress(config.Host, config.Port); network == "unix" {
				host = "localhost"
			}

			config.Password = passfile.FindPassword(host, strconv.Itoa(int(config.Port)), config.Database, config.User)
		}
	}

	switch tsa := settings["target_session_attrs"]; tsa {
	case "read-write":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsReadWrite
	case "read-only":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsReadOnly
	case "primary":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsPrimary
	case "standby":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsStandby
	case "prefer-standby":
		config.ValidateConnect = ValidateConnectTargetSessionAttrsPreferStandby
	case "any":
		// do nothing
	default:
		return nil, &ParseConfigError{ConnString: connString, msg: fmt.Sprintf("unknown target_session_attrs value: %v", tsa)}
	}

	return config, nil
}

func mergeSettings(settingSets ...map[string]string) map[string]string {
	settings := make(map[string]string)

	for _, s2 := range settingSets {
		for k, v := range s2 {
			settings[k] = v
		}
	}

	return settings
}

func parseEnvSettings() map[string]string {
	settings := make(map[string]string)

	nameMap := map[string]string{
		"PGHOST":               "host",
		"PGPORT":               "port",
		"PGDATABASE":           "database",
		"PGUSER":               "user",
		"PGPASSWORD":           "password",
		"PGPASSFILE":           "passfile",
		"PGAPPNAME":            "application_name",
		"PGCONNECT_TIMEOUT":    "connect_timeout",
		"PGSSLMODE":            "sslmode",
		"PGSSLKEY":             "sslkey",
		"PGSSLCERT":            "sslcert",
		"PGSSLSNI":             "sslsni",
		"PGSSLROOTCERT":        "sslrootcert",
		"PGSSLPASSWORD":        "sslpassword",
		"PGSSLNEGOTIATION":     "sslnegotiation",
		"PGTARGETSESSIONATTRS": "target_session_attrs",
		"PGSERVICE":            "service",
		"PGSERVICEFILE":        "servicefile",
		"PGTZ":                 "timezone",
		"PGOPTIONS":            "options",
	}

	for envname, realname := range nameMap {
		value := os.Getenv(envname)
		if value != "" {
			settings[realname] = value
		}
	}

	return settings
}

func parseURLSettings(connString string) (map[string]string, error) {
	settings := make(map[string]string)

	parsedURL, err := url.Parse(connString)
	if err != nil {
		if urlErr := new(url.Error); errors.As(err, &urlErr) {
			return nil, urlErr.Err
		}
		return nil, err
	}

	if parsedURL.User != nil {
		settings["user"] = parsedURL.User.Username()
		if password, present := parsedURL.User.Password(); present {
			settings["password"] = password
		}
	}

	// Handle multiple host:port's in url.Host by splitting them into host,host,host and port,port,port.
	var hosts []string
	var ports []string
	for _, host := range strings.Split(parsedURL.Host, ",") {
		if host == "" {
			continue
		}
		if isIPOnly(host) {
			hosts = append(hosts, strings.Trim(host, "[]"))
			continue
		}
		h, p, err := net.SplitHostPort(host)
		if err != nil {
			return nil, fmt.Errorf("failed to split host:port in '%s', err: %w", host, err)
		}
		if h != "" {
			hosts = append(hosts, h)
		}
		if p != "" {
			ports = append(ports, p)
		}
	}
	if len(hosts) > 0 {
		settings["host"] = strings.Join(hosts, ",")
	}
	if len(ports) > 0 {
		settings["port"] = strings.Join(ports, ",")
	}

	database := strings.TrimLeft(parsedURL.Path, "/")
	if database != "" {
		settings["database"] = database
	}

	nameMap := map[string]string{
		"dbname": "database",
	}

	for k, v := range parsedURL.Query() {
		if k2, present := nameMap[k]; present {
			k = k2
		}

		settings[k] = v[0]
	}

	return settings, nil
}

func isIPOnly(host string) bool {
	return net.ParseIP(strings.Trim(host, "[]")) != nil || !strings.Contains(host, ":")
}

var asciiSpace = [256]uint8{'\t': 1, '\n': 1, '\v': 1, '\f': 1, '\r': 1, ' ': 1}

func parseKeywordValueSettings(s string) (map[string]string, error) {
	settings := make(map[string]string)

	nameMap := map[string]string{
		"dbname": "database",
	}

	for len(s) > 0 {
		var key, val string
		eqIdx := strings.IndexRune(s, '=')
		if eqIdx < 0 {
			return nil, errors.New("invalid keyword/value")
		}

		key = strings.Trim(s[:eqIdx], " \t\n\r\v\f")
		s = strings.TrimLeft(s[eqIdx+1:], " \t\n\r\v\f")
		if len(s) == 0 {
		} else if s[0] != '\'' {
			end := 0
			for ; end < len(s); end++ {
				if asciiSpace[s[end]] == 1 {
					break
				}
				if s[end] == '\\' {
					end++
					if end == len(s) {
						return nil, errors.New("invalid backslash")
					}
				}
			}
			val = strings.Replace(strings.Replace(s[:end], "\\\\", "\\", -1), "\\'", "'", -1)
			if end == len(s) {
				s = ""
			} else {
				s = s[end+1:]
			}
		} else { // quoted string
			s = s[1:]
			end := 0
			for ; end < len(s); end++ {
				if s[end] == '\'' {
					break
				}
				if s[end] == '\\' {
					end++
				}
			}
			if end == len(s) {
				return nil, errors.New("unterminated quoted string in connection info string")
			}
			val = strings.Replace(strings.Replace(s[:end], "\\\\", "\\", -1), "\\'", "'", -1)
			if end == len(s) {
				s = ""
			} else {
				s = s[end+1:]
			}
		}

		if k, ok := nameMap[key]; ok {
			key = k
		}

		if key == "" {
			return nil, errors.New("invalid keyword/value")
		}

		settings[key] = val
	}

	return settings, nil
}

func parseServiceSettings(servicefilePath, serviceName string) (map[string]string, error) {
	servicefile, err := pgservicefile.ReadServicefile(servicefilePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read service file: %v", servicefilePath)
	}

	service, err := servicefile.GetService(serviceName)
	if err != nil {
		return nil, fmt.Errorf("unable to find service: %v", serviceName)
	}

	nameMap := map[string]string{
		"dbname": "database",
	}

	settings := make(map[string]string, len(service.Settings))
	for k, v := range service.Settings {
		if k2, present := nameMap[k]; present {
			k = k2
		}
		settings[k] = v
	}

	return settings, nil
}

// configTLS uses libpq's TLS parameters to construct  []*tls.Config. It is
// necessary to allow returning multiple TLS configs as sslmode "allow" and
// "prefer" allow fallback.
func configTLS(settings map[string]string, thisHost string, parseConfigOptions ParseConfigOptions) ([]*tls.Config, error) {
	host := thisHost
	sslmode := settings["sslmode"]
	sslrootcert := settings["sslrootcert"]
	sslcert := settings["sslcert"]
	sslkey := settings["sslkey"]
	sslpassword := settings["sslpassword"]
	sslsni := settings["sslsni"]
	sslnegotiation := settings["sslnegotiation"]

	// Match libpq default behavior
	if sslmode == "" {
		sslmode = "prefer"
	}
	if sslsni == "" {
		sslsni = "1"
	}

	tlsConfig := &tls.Config{}

	if sslnegotiation == "direct" {
		tlsConfig.NextProtos = []string{"postgresql"}
		if sslmode == "prefer" {
			sslmode = "require"
		}
	}

	if sslrootcert != "" {
		var caCertPool *x509.CertPool

		if sslrootcert == "system" {
			var err error

			caCertPool, err = x509.SystemCertPool()
			if err != nil {
				return nil, fmt.Errorf("unable to load system certificate pool: %w", err)
			}

			sslmode = "verify-full"
		} else {
			caCertPool = x509.NewCertPool()

			caPath := sslrootcert
			caCert, err := os.ReadFile(caPath)
			if err != nil {
				return nil, fmt.Errorf("unable to read CA file: %w", err)
			}

			if !caCertPool.AppendCertsFromPEM(caCert) {
				return nil, errors.New("unable to add CA to cert pool")
			}
		}

		tlsConfig.RootCAs = caCertPool
		tlsConfig.ClientCAs = caCertPool
	}

	switch sslmode {
	case "disable":
		return []*tls.Config{nil}, nil
	case "allow", "prefer":
		tlsConfig.InsecureSkipVerify = true
	case "require":
		// According to PostgreSQL documentation, if a root CA file exists,
		// the behavior of sslmode=require should be the same as that of verify-ca
		//
		// See https://www.postgresql.org/docs/current/libpq-ssl.html
		if sslrootcert != "" {
			goto nextCase
		}
		tlsConfig.InsecureSkipVerify = true
		break
	nextCase:
		fallthrough
	case "verify-ca":
		// Don't perform the default certificate verification because it
		// will verify the hostname. Instead, verify the server's
		// certificate chain ourselves in VerifyPeerCertificate and
		// ignore the server name. This emulates libpq's verify-ca
		// behavior.
		//
		// See https://github.com/golang/go/issues/21971#issuecomment-332693931
		// and https://pkg.go.dev/crypto/tls?tab=doc#example-Config-VerifyPeerCertificate
		// for more info.
		tlsConfig.InsecureSkipVerify = true
		tlsConfig.VerifyPeerCertificate = func(certificates [][]byte, _ [][]*x509.Certificate) error {
			certs := make([]*x509.Certificate, len(certificates))
			for i, asn1Data := range certificates {
				cert, err := x509.ParseCertificate(asn1Data)
				if err != nil {
					return errors.New("failed to parse certificate from server: " + err.Error())
				}
				certs[i] = cert
			}

			// Leave DNSName empty to skip hostname verification.
			opts := x509.VerifyOptions{
				Roots:         tlsConfig.RootCAs,
				Intermediates: x509.NewCertPool(),
			}
			// Skip the first cert because it's the leaf. All others
			// are intermediates.
			for _, cert := range certs[1:] {
				opts.Intermediates.AddCert(cert)
			}
			_, err := certs[0].Verify(opts)
			return err
		}
	case "verify-full":
		tlsConfig.ServerName = host
	default:
		return nil, errors.New("sslmode is invalid")
	}

	if (sslcert != "" && sslkey == "") || (sslcert == "" && sslkey != "") {
		return nil, errors.New(`both "sslcert" and "sslkey" are required`)
	}

	if sslcert != "" && sslkey != "" {
		buf, err := os.ReadFile(sslkey)
		if err != nil {
			return nil, fmt.Errorf("unable to read sslkey: %w", err)
		}
		block, _ := pem.Decode(buf)
		if block == nil {
			return nil, errors.New("failed to decode sslkey")
		}
		var pemKey []byte
		var decryptedKey []byte
		var decryptedError error
		// If PEM is encrypted, attempt to decrypt using pass phrase
		if x509.IsEncryptedPEMBlock(block) {
			// Attempt decryption with pass phrase
			// NOTE: only supports RSA (PKCS#1)
			if sslpassword != "" {
				decryptedKey, decryptedError = x509.DecryptPEMBlock(block, []byte(sslpassword))
			}
			// if sslpassword not provided or has decryption error when use it
			// try to find sslpassword with callback function
			if sslpassword == "" || decryptedError != nil {
				if parseConfigOptions.GetSSLPassword != nil {
					sslpassword = parseConfigOptions.GetSSLPassword(context.Background())
				}
				if sslpassword == "" {
					return nil, fmt.Errorf("unable to find sslpassword")
				}
			}
			decryptedKey, decryptedError = x509.DecryptPEMBlock(block, []byte(sslpassword))
			// Should we also provide warning for PKCS#1 needed?
			if decryptedError != nil {
				return nil, fmt.Errorf("unable to decrypt key: %w", err)
			}

			pemBytes := pem.Block{
				Type:  "RSA PRIVATE KEY",
				Bytes: decryptedKey,
			}
			pemKey = pem.EncodeToMemory(&pemBytes)
		} else {
			pemKey = pem.EncodeToMemory(block)
		}
		certfile, err := os.ReadFile(sslcert)
		if err != nil {
			return nil, fmt.Errorf("unable to read cert: %w", err)
		}
		cert, err := tls.X509KeyPair(certfile, pemKey)
		if err != nil {
			return nil, fmt.Errorf("unable to load cert: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	// Set Server Name Indication (SNI), if enabled by connection parameters.
	// Per RFC 6066, do not set it if the host is a literal IP address (IPv4
	// or IPv6).
	if sslsni == "1" && net.ParseIP(host) == nil {
		tlsConfig.ServerName = host
	}

	switch sslmode {
	case "allow":
		return []*tls.Config{nil, tlsConfig}, nil
	case "prefer":
		return []*tls.Config{tlsConfig, nil}, nil
	case "require", "verify-ca", "verify-full":
		return []*tls.Config{tlsConfig}, nil
	default:
		panic("BUG: bad sslmode should already have been caught")
	}
}

func parsePort(s string) (uint16, error) {
	port, err := strconv.ParseUint(s, 10, 16)
	if err != nil {
		return 0, err
	}
	if port < 1 || port > math.MaxUint16 {
		return 0, errors.New("outside range")
	}
	return uint16(port), nil
}

func makeDefaultDialer() *net.Dialer {
	// rely on GOLANG KeepAlive settings
	return &net.Dialer{}
}

func makeDefaultResolver() *net.Resolver {
	return net.DefaultResolver
}

func parseConnectTimeoutSetting(s string) (time.Duration, error) {
	timeout, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, err
	}
	if timeout < 0 {
		return 0, errors.New("negative timeout")
	}
	return time.Duration(timeout) * time.Second, nil
}

func makeConnectTimeoutDialFunc(timeout time.Duration) DialFunc {
	d := makeDefaultDialer()
	d.Timeout = timeout
	return d.DialContext
}

// ValidateConnectTargetSessionAttrsReadWrite is a ValidateConnectFunc that implements libpq compatible
// target_session_attrs=read-write.
func ValidateConnectTargetSessionAttrsReadWrite(ctx context.Context, pgConn *PgConn) error {
	result, err := pgConn.Exec(ctx, "show transaction_read_only").ReadAll()
	if err != nil {
		return err
	}

	if string(result[0].Rows[0][0]) == "on" {
		return errors.New("read only connection")
	}

	return nil
}

// ValidateConnectTargetSessionAttrsReadOnly is a ValidateConnectFunc that implements libpq compatible
// target_session_attrs=read-only.
func ValidateConnectTargetSessionAttrsReadOnly(ctx context.Context, pgConn *PgConn) error {
	result, err := pgConn.Exec(ctx, "show transaction_read_only").ReadAll()
	if err != nil {
		return err
	}

	if string(result[0].Rows[0][0]) != "on" {
		return errors.New("connection is not read only")
	}

	return nil
}

// ValidateConnectTargetSessionAttrsStandby is a ValidateConnectFunc that implements libpq compatible
// target_session_attrs=standby.
func ValidateConnectTargetSessionAttrsStandby(ctx context.Context, pgConn *PgConn) error {
	result, err := pgConn.Exec(ctx, "select pg_is_in_recovery()").ReadAll()
	if err != nil {
		return err
	}

	if string(result[0].Rows[0][0]) != "t" {
		return errors.New("server is not in hot standby mode")
	}

	return nil
}

// ValidateConnectTargetSessionAttrsPrimary is a ValidateConnectFunc that implements libpq compatible
// target_session_attrs=primary.
func ValidateConnectTargetSessionAttrsPrimary(ctx context.Context, pgConn *PgConn) error {
	result, err := pgConn.Exec(ctx, "select pg_is_in_recovery()").ReadAll()
	if err != nil {
		return err
	}

	if string(result[0].Rows[0][0]) == "t" {
		return errors.New("server is in standby mode")
	}

	return nil
}

// ValidateConnectTargetSessionAttrsPreferStandby is a ValidateConnectFunc that implements libpq compatible
// target_session_attrs=prefer-standby.
func ValidateConnectTargetSessionAttrsPreferStandby(ctx context.Context, pgConn *PgConn) error {
	result, err := pgConn.Exec(ctx, "select pg_is_in_recovery()").ReadAll()
	if err != nil {
		return err
	}

	if string(result[0].Rows[0][0]) != "t" {
		return &NotPreferredError{err: errors.New("server is not in hot standby mode")}
	}

	return nil
}
