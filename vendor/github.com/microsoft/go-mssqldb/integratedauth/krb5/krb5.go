// Package krb5 implements the integratedauth.IntegratedAuthenticator interface in order to provide kerberos/active directory (Windows) based authentication.
package krb5

import (
	"errors"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/jcmturner/gokrb5/v8/client"
	"github.com/jcmturner/gokrb5/v8/config"
	"github.com/jcmturner/gokrb5/v8/credentials"
	"github.com/jcmturner/gokrb5/v8/gssapi"
	"github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/jcmturner/gokrb5/v8/spnego"

	"github.com/microsoft/go-mssqldb/integratedauth"
	"github.com/microsoft/go-mssqldb/msdsn"
)

const (
	keytabConfigFile   = "krb5-configfile"
	keytabFile         = "krb5-keytabfile"
	credCacheFile      = "krb5-credcachefile"
	realm              = "krb5-realm"
	dnsLookupKDC       = "krb5-dnslookupkdc"
	udpPreferenceLimit = "krb5-udppreferencelimit"
)

var (
	ErrRequiredParametersMissing                     = errors.New("failed to create krb5 client from login parameters")
	ErrRealmRequiredWithUsernameAndPassword          = errors.New("krb5-realm is required to login with krb5 when using user id and password")
	ErrKrb5ConfigFileRequiredWithUsernameAndPassword = errors.New("krb5-configfile is required to login with krb5 when using user id and password")
	ErrUsernameRequiredWithKeytab                    = errors.New("user id is required to login with krb5 when using krb5-keytabfile")
	ErrRealmRequiredWithKeytab                       = errors.New("krb5-realm is required to login with krb5 when using krb5-keytabfile")
	ErrKrb5ConfigFileRequiredWithKeytab              = errors.New("krb5-configfile is required to login with krb5 when using krb5-keytabfile")
	ErrKrb5ConfigFileDoesNotExist                    = errors.New("krb5-configfile does not exist")
	ErrKeytabFileDoesNotExist                        = errors.New("krb5-keytabfile does not exist")
	ErrKrb5ConfigFileRequiredWithCredCache           = errors.New("krb5-configfile is required to login with krb5 when using krb5-credcachefile")
	ErrCredCacheFileDoesNotExist                     = errors.New("krb5-credcachefile does not exist")
)

var (
	_                         integratedauth.IntegratedAuthenticator = (*krbAuth)(nil)
	fileExists                                                       = fileExistsOS
	loadDefaultConfigFromFile                                        = newKrb5ConfigFromFile
	AuthProviderFunc          integratedauth.Provider                = integratedauth.ProviderFunc(getAuth)
)

func init() {
	err := integratedauth.SetIntegratedAuthenticationProvider("krb5", AuthProviderFunc)
	if err != nil {
		panic(err)
	}
}

func getAuth(config msdsn.Config) (integratedauth.IntegratedAuthenticator, error) {
	krb5Config, err := readKrb5Config(config)
	if err != nil {
		return nil, err
	}

	err = validateKrb5LoginParams(krb5Config)
	if err != nil {
		return nil, err
	}

	return &krbAuth{
		krb5Config: krb5Config,
	}, nil
}

type loginMethod uint8

const (
	none loginMethod = iota
	usernameAndPassword
	keyTabFile
	cachedCredentialsFile
)

type krb5Login struct {
	Krb5ConfigFile     string
	KeytabFile         string
	CredCacheFile      string
	Realm              string
	UserName           string
	Password           string
	ServerSPN          string
	DNSLookupKDC       bool
	UDPPreferenceLimit int
	loginMethod        loginMethod
}

// copies string parameters from connection string, parses optional parameters
// Environment variables for Kerberos config are listed at https://web.mit.edu/kerberos/krb5-1.12/doc/admin/env_variables.html
func readKrb5Config(cfg msdsn.Config) (*krb5Login, error) {
	login := &krb5Login{
		Krb5ConfigFile:     cfg.Parameters[keytabConfigFile],
		KeytabFile:         cfg.Parameters[keytabFile],
		CredCacheFile:      cfg.Parameters[credCacheFile],
		Realm:              cfg.Parameters[realm],
		UserName:           cfg.User,
		Password:           cfg.Password,
		ServerSPN:          cfg.ServerSPN,
		DNSLookupKDC:       true,
		UDPPreferenceLimit: 1,
		loginMethod:        none,
	}

	// If no conf file is provided , use the environment variable first then just use the default conf file location if not set
	if len(login.Krb5ConfigFile) == 0 {
		login.Krb5ConfigFile = os.Getenv("KRB5_CONFIG")
	}

	if len(login.Krb5ConfigFile) == 0 {
		login.Krb5ConfigFile = `/etc/krb5.conf`
	}

	defaults, err := loadDefaultConfigFromFile(login)
	if err != nil {
		return nil, fmt.Errorf("Unable to load krb5 config to get default values: %w", err)
	}

	// If no Realm passed, try to split out the user name as `username@realm`
	if len(login.Realm) == 0 {
		nameParts := strings.SplitN(login.UserName, "@", 2)
		if len(nameParts) > 1 {
			login.UserName = nameParts[0]
			login.Realm = nameParts[1]
		}
	}

	if len(login.Realm) == 0 {
		login.Realm = defaults.LibDefaults.DefaultRealm
	}

	// If the app provides a user name with no password, give the keytab file precedence over the credential cache
	if len(login.UserName) > 0 && len(login.Password) == 0 {
		if len(login.KeytabFile) == 0 {
			login.KeytabFile = os.Getenv("KRB5_KTNAME")
		}
		if len(login.KeytabFile) == 0 {
			kt := defaults.LibDefaults.DefaultClientKeytabName
			if ok, _ := fileExists(kt, nil); ok {
				login.KeytabFile = kt
			}
		}
		if len(login.KeytabFile) == 0 {
			kt := defaults.LibDefaults.DefaultKeytabName
			if ok, _ := fileExists(kt, nil); ok {
				login.KeytabFile = kt
			}
		}
	}

	// We fall back to the environment variable if set, but it will be ignored for login if login.KeytabFile is set
	if len(login.CredCacheFile) == 0 {
		login.CredCacheFile = os.Getenv("KRB5CCNAME")
	}

	// read optional parameters
	val, ok := cfg.Parameters[dnsLookupKDC]
	if ok {
		parsed, err := strconv.ParseBool(val)
		if err != nil {
			return nil, fmt.Errorf("invalid '%s' parameter '%s': %w", dnsLookupKDC, val, err)
		}
		login.DNSLookupKDC = parsed
	}

	val, ok = cfg.Parameters[udpPreferenceLimit]
	if ok {
		parsed, err := strconv.Atoi(val)
		if err != nil {
			return nil, fmt.Errorf("invalid '%s' parameter '%s': %s", udpPreferenceLimit, val, err.Error())
		}
		login.UDPPreferenceLimit = parsed
	}
	return login, nil
}

func validateKrb5LoginParams(krbLoginParams *krb5Login) error {
	switch {
	// using explicit credentials
	case krbLoginParams.UserName != "" && krbLoginParams.Password != "":
		if krbLoginParams.Realm == "" {
			return ErrRealmRequiredWithUsernameAndPassword
		}
		if krbLoginParams.Krb5ConfigFile == "" {
			return ErrKrb5ConfigFileRequiredWithUsernameAndPassword
		}
		if ok, err := fileExists(krbLoginParams.Krb5ConfigFile, ErrKrb5ConfigFileDoesNotExist); !ok {
			return err
		}
		krbLoginParams.loginMethod = usernameAndPassword
		return nil

	//using a keytab file
	case krbLoginParams.KeytabFile != "":
		if krbLoginParams.UserName == "" {
			return ErrUsernameRequiredWithKeytab
		}
		if krbLoginParams.Realm == "" {
			return ErrRealmRequiredWithKeytab
		}
		if krbLoginParams.Krb5ConfigFile == "" {
			return ErrKrb5ConfigFileRequiredWithKeytab
		}
		if ok, err := fileExists(krbLoginParams.Krb5ConfigFile, ErrKrb5ConfigFileDoesNotExist); !ok {
			return err
		}
		if ok, err := fileExists(krbLoginParams.KeytabFile, ErrKeytabFileDoesNotExist); !ok {
			return err
		}
		krbLoginParams.loginMethod = keyTabFile
		return nil

	// using a credential cache file
	case krbLoginParams.CredCacheFile != "":
		if krbLoginParams.Krb5ConfigFile == "" {
			return ErrKrb5ConfigFileRequiredWithCredCache
		}
		if ok, err := fileExists(krbLoginParams.Krb5ConfigFile, ErrKrb5ConfigFileDoesNotExist); !ok {
			return err
		}
		if ok, err := fileExists(krbLoginParams.CredCacheFile, ErrCredCacheFileDoesNotExist); !ok {
			return err
		}
		krbLoginParams.loginMethod = cachedCredentialsFile
		return nil
	default:
		return ErrRequiredParametersMissing
	}
}

func fileExistsOS(filename string, errWhenFileNotFound error) (bool, error) {
	_, err := os.Stat(filename)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, os.ErrNotExist) {
		return false, errWhenFileNotFound
	}
	return false, fmt.Errorf("%v : %w", errWhenFileNotFound, err)
}

// krbAuth implements the integratedauth.IntegratedAuthenticator interface. It is responsible for kerberos Service Provider Negotiation.
type krbAuth struct {
	krb5Config   *krb5Login
	spnegoClient *spnego.SPNEGO
	krb5Client   *client.Client
}

func (k *krbAuth) InitialBytes() ([]byte, error) {
	krbClient, err := getKrb5Client(k.krb5Config)
	if err != nil {
		return nil, err
	}

	err = krbClient.Login()
	if err != nil {
		return nil, err
	}

	k.krb5Client = krbClient
	k.spnegoClient = spnego.SPNEGOClient(k.krb5Client, canonicalize(k.krb5Config.ServerSPN))

	tkn, err := k.spnegoClient.InitSecContext()
	if err != nil {
		return nil, err
	}
	return tkn.Marshal()
}

func (k *krbAuth) NextBytes(bytes []byte) ([]byte, error) {
	var resp spnego.SPNEGOToken
	if err := resp.Unmarshal(bytes); err != nil {
		return nil, err
	}

	ok, status := resp.Verify()
	if ok { // we're ok, done
		return nil, nil
	}

	switch status.Code {
	case gssapi.StatusContinueNeeded:
		return nil, nil
	default:
		return nil, fmt.Errorf("bad status: %+v", status)
	}
}

func (k *krbAuth) Free() {
	if k.krb5Client != nil {
		k.krb5Client.Destroy()
		k.krb5Client = nil
	}
}

func getKrb5Client(krbLoginParams *krb5Login) (*client.Client, error) {
	cfg, err := newKrb5ConfigFromFile(krbLoginParams)
	if err != nil {
		return nil, err
	}

	switch krbLoginParams.loginMethod {
	case usernameAndPassword:
		return clientFromUsernameAndPassword(krbLoginParams, cfg)
	case keyTabFile:
		return clientFromKeytab(krbLoginParams, cfg)
	case cachedCredentialsFile:
		return clientFromCredentialCache(krbLoginParams, cfg)
	default:
		return nil, ErrRequiredParametersMissing
	}
}

func newKrb5ConfigFromFile(krb5Login *krb5Login) (*config.Config, error) {
	f, err := os.Open(krb5Login.Krb5ConfigFile)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	cfg, err := config.NewFromReader(f)
	if err != nil {
		return nil, err
	}
	cfg.LibDefaults.DNSLookupKDC = krb5Login.DNSLookupKDC
	cfg.LibDefaults.UDPPreferenceLimit = krb5Login.UDPPreferenceLimit

	return cfg, nil
}

// creates a client from hardcoded user id & password credentials in the connection string in addition to realm
func clientFromUsernameAndPassword(krb5Login *krb5Login, cfg *config.Config) (*client.Client, error) {
	return client.NewWithPassword(krb5Login.UserName, krb5Login.Realm, krb5Login.Password, cfg, client.DisablePAFXFAST(true)), nil
}

// loads keytab file specified in keytabFile and creates a client from its content, username and realm
func clientFromKeytab(krb5Login *krb5Login, cfg *config.Config) (*client.Client, error) {
	data, err := os.ReadFile(krb5Login.KeytabFile)
	if err != nil {
		return nil, err
	}
	var kt = &keytab.Keytab{}
	err = kt.Unmarshal(data)
	if err != nil {
		return nil, err
	}

	return client.NewWithKeytab(krb5Login.UserName, krb5Login.Realm, kt, cfg, client.DisablePAFXFAST(true)), nil
}

// loads credential cache file specified in credCacheFile parameter and creates a client
func clientFromCredentialCache(krb5Login *krb5Login, cfg *config.Config) (*client.Client, error) {
	cache, err := credentials.LoadCCache(krb5Login.CredCacheFile)
	if err != nil {
		return nil, err
	}

	return client.NewFromCCache(cache, cfg, client.DisablePAFXFAST(true))
}

// responsible for transforming network CNames into their actual Hostname.
// For cases where service tickets can only be bound to hostnames, not cnames.
func canonicalize(service string) string {
	parts := strings.SplitAfterN(service, "/", 2)
	if len(parts) != 2 {
		return service
	}
	host, port, err := net.SplitHostPort(parts[1])
	if err != nil {
		return service
	}
	cname, err := net.LookupCNAME(strings.ToLower(host))
	if err != nil {
		return service
	}
	// Put service back together with cname (stripped of trailing .) and port
	return parts[0] + net.JoinHostPort(cname[:len(cname)-1], port)
}
