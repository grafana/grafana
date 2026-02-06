// Package config implements KRB5 client and service configuration as described at https://web.mit.edu/kerberos/krb5-latest/doc/admin/conf_files/krb5_conf.html
package config

import (
	"bufio"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"os/user"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jcmturner/gofork/encoding/asn1"
	"github.com/jcmturner/gokrb5/v8/iana/etypeID"
)

// Config represents the KRB5 configuration.
type Config struct {
	LibDefaults LibDefaults
	Realms      []Realm
	DomainRealm DomainRealm
	//CaPaths
	//AppDefaults
	//Plugins
}

// WeakETypeList is a list of encryption types that have been deemed weak.
const WeakETypeList = "des-cbc-crc des-cbc-md4 des-cbc-md5 des-cbc-raw des3-cbc-raw des-hmac-sha1 arcfour-hmac-exp rc4-hmac-exp arcfour-hmac-md5-exp des"

// New creates a new config struct instance.
func New() *Config {
	d := make(DomainRealm)
	return &Config{
		LibDefaults: newLibDefaults(),
		DomainRealm: d,
	}
}

// LibDefaults represents the [libdefaults] section of the configuration.
type LibDefaults struct {
	AllowWeakCrypto bool //default false
	// ap_req_checksum_type int //unlikely to support this
	Canonicalize bool          //default false
	CCacheType   int           //default is 4. unlikely to implement older
	Clockskew    time.Duration //max allowed skew in seconds, default 300
	//Default_ccache_name string // default /tmp/krb5cc_%{uid} //Not implementing as will hold in memory
	DefaultClientKeytabName string //default /usr/local/var/krb5/user/%{euid}/client.keytab
	DefaultKeytabName       string //default /etc/krb5.keytab
	DefaultRealm            string
	DefaultTGSEnctypes      []string //default aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96 des3-cbc-sha1 arcfour-hmac-md5 camellia256-cts-cmac camellia128-cts-cmac des-cbc-crc des-cbc-md5 des-cbc-md4
	DefaultTktEnctypes      []string //default aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96 des3-cbc-sha1 arcfour-hmac-md5 camellia256-cts-cmac camellia128-cts-cmac des-cbc-crc des-cbc-md5 des-cbc-md4
	DefaultTGSEnctypeIDs    []int32  //default aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96 des3-cbc-sha1 arcfour-hmac-md5 camellia256-cts-cmac camellia128-cts-cmac des-cbc-crc des-cbc-md5 des-cbc-md4
	DefaultTktEnctypeIDs    []int32  //default aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96 des3-cbc-sha1 arcfour-hmac-md5 camellia256-cts-cmac camellia128-cts-cmac des-cbc-crc des-cbc-md5 des-cbc-md4
	DNSCanonicalizeHostname bool     //default true
	DNSLookupKDC            bool     //default false
	DNSLookupRealm          bool
	ExtraAddresses          []net.IP       //Not implementing yet
	Forwardable             bool           //default false
	IgnoreAcceptorHostname  bool           //default false
	K5LoginAuthoritative    bool           //default false
	K5LoginDirectory        string         //default user's home directory. Must be owned by the user or root
	KDCDefaultOptions       asn1.BitString //default 0x00000010 (KDC_OPT_RENEWABLE_OK)
	KDCTimeSync             int            //default 1
	//kdc_req_checksum_type int //unlikely to implement as for very old KDCs
	NoAddresses         bool     //default true
	PermittedEnctypes   []string //default aes256-cts-hmac-sha1-96 aes128-cts-hmac-sha1-96 des3-cbc-sha1 arcfour-hmac-md5 camellia256-cts-cmac camellia128-cts-cmac des-cbc-crc des-cbc-md5 des-cbc-md4
	PermittedEnctypeIDs []int32
	//plugin_base_dir string //not supporting plugins
	PreferredPreauthTypes []int         //default “17, 16, 15, 14”, which forces libkrb5 to attempt to use PKINIT if it is supported
	Proxiable             bool          //default false
	RDNS                  bool          //default true
	RealmTryDomains       int           //default -1
	RenewLifetime         time.Duration //default 0
	SafeChecksumType      int           //default 8
	TicketLifetime        time.Duration //default 1 day
	UDPPreferenceLimit    int           // 1 means to always use tcp. MIT krb5 has a default value of 1465, and it prevents user setting more than 32700.
	VerifyAPReqNofail     bool          //default false
}

// Create a new LibDefaults struct.
func newLibDefaults() LibDefaults {
	uid := "0"
	var hdir string
	usr, _ := user.Current()
	if usr != nil {
		uid = usr.Uid
		hdir = usr.HomeDir
	}
	opts := asn1.BitString{}
	opts.Bytes, _ = hex.DecodeString("00000010")
	opts.BitLength = len(opts.Bytes) * 8
	l := LibDefaults{
		CCacheType:              4,
		Clockskew:               time.Duration(300) * time.Second,
		DefaultClientKeytabName: fmt.Sprintf("/usr/local/var/krb5/user/%s/client.keytab", uid),
		DefaultKeytabName:       "/etc/krb5.keytab",
		DefaultTGSEnctypes:      []string{"aes256-cts-hmac-sha1-96", "aes128-cts-hmac-sha1-96", "des3-cbc-sha1", "arcfour-hmac-md5", "camellia256-cts-cmac", "camellia128-cts-cmac", "des-cbc-crc", "des-cbc-md5", "des-cbc-md4"},
		DefaultTktEnctypes:      []string{"aes256-cts-hmac-sha1-96", "aes128-cts-hmac-sha1-96", "des3-cbc-sha1", "arcfour-hmac-md5", "camellia256-cts-cmac", "camellia128-cts-cmac", "des-cbc-crc", "des-cbc-md5", "des-cbc-md4"},
		DNSCanonicalizeHostname: true,
		K5LoginDirectory:        hdir,
		KDCDefaultOptions:       opts,
		KDCTimeSync:             1,
		NoAddresses:             true,
		PermittedEnctypes:       []string{"aes256-cts-hmac-sha1-96", "aes128-cts-hmac-sha1-96", "des3-cbc-sha1", "arcfour-hmac-md5", "camellia256-cts-cmac", "camellia128-cts-cmac", "des-cbc-crc", "des-cbc-md5", "des-cbc-md4"},
		RDNS:                    true,
		RealmTryDomains:         -1,
		SafeChecksumType:        8,
		TicketLifetime:          time.Duration(24) * time.Hour,
		UDPPreferenceLimit:      1465,
		PreferredPreauthTypes:   []int{17, 16, 15, 14},
	}
	l.DefaultTGSEnctypeIDs = parseETypes(l.DefaultTGSEnctypes, l.AllowWeakCrypto)
	l.DefaultTktEnctypeIDs = parseETypes(l.DefaultTktEnctypes, l.AllowWeakCrypto)
	l.PermittedEnctypeIDs = parseETypes(l.PermittedEnctypes, l.AllowWeakCrypto)
	return l
}

// Parse the lines of the [libdefaults] section of the configuration into the LibDefaults struct.
func (l *LibDefaults) parseLines(lines []string) error {
	for _, line := range lines {
		//Remove comments after the values
		if idx := strings.IndexAny(line, "#;"); idx != -1 {
			line = line[:idx]
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.Contains(line, "=") {
			return InvalidErrorf("libdefaults section line (%s)", line)
		}

		p := strings.Split(line, "=")
		key := strings.TrimSpace(strings.ToLower(p[0]))
		switch key {
		case "allow_weak_crypto":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.AllowWeakCrypto = v
		case "canonicalize":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.Canonicalize = v
		case "ccache_type":
			p[1] = strings.TrimSpace(p[1])
			v, err := strconv.ParseUint(p[1], 10, 32)
			if err != nil || v < 0 || v > 4 {
				return InvalidErrorf("libdefaults section line (%s)", line)
			}
			l.CCacheType = int(v)
		case "clockskew":
			d, err := parseDuration(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.Clockskew = d
		case "default_client_keytab_name":
			l.DefaultClientKeytabName = strings.TrimSpace(p[1])
		case "default_keytab_name":
			l.DefaultKeytabName = strings.TrimSpace(p[1])
		case "default_realm":
			l.DefaultRealm = strings.TrimSpace(p[1])
		case "default_tgs_enctypes":
			l.DefaultTGSEnctypes = strings.Fields(p[1])
		case "default_tkt_enctypes":
			l.DefaultTktEnctypes = strings.Fields(p[1])
		case "dns_canonicalize_hostname":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.DNSCanonicalizeHostname = v
		case "dns_lookup_kdc":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.DNSLookupKDC = v
		case "dns_lookup_realm":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.DNSLookupRealm = v
		case "extra_addresses":
			ipStr := strings.TrimSpace(p[1])
			for _, ip := range strings.Split(ipStr, ",") {
				if eip := net.ParseIP(ip); eip != nil {
					l.ExtraAddresses = append(l.ExtraAddresses, eip)
				}
			}
		case "forwardable":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.Forwardable = v
		case "ignore_acceptor_hostname":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.IgnoreAcceptorHostname = v
		case "k5login_authoritative":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.K5LoginAuthoritative = v
		case "k5login_directory":
			l.K5LoginDirectory = strings.TrimSpace(p[1])
		case "kdc_default_options":
			v := strings.TrimSpace(p[1])
			v = strings.Replace(v, "0x", "", -1)
			b, err := hex.DecodeString(v)
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.KDCDefaultOptions.Bytes = b
			l.KDCDefaultOptions.BitLength = len(b) * 8
		case "kdc_timesync":
			p[1] = strings.TrimSpace(p[1])
			v, err := strconv.ParseInt(p[1], 10, 32)
			if err != nil || v < 0 {
				return InvalidErrorf("libdefaults section line (%s)", line)
			}
			l.KDCTimeSync = int(v)
		case "noaddresses":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.NoAddresses = v
		case "permitted_enctypes":
			l.PermittedEnctypes = strings.Fields(p[1])
		case "preferred_preauth_types":
			p[1] = strings.TrimSpace(p[1])
			t := strings.Split(p[1], ",")
			var v []int
			for _, s := range t {
				i, err := strconv.ParseInt(s, 10, 32)
				if err != nil {
					return InvalidErrorf("libdefaults section line (%s): %v", line, err)
				}
				v = append(v, int(i))
			}
			l.PreferredPreauthTypes = v
		case "proxiable":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.Proxiable = v
		case "rdns":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.RDNS = v
		case "realm_try_domains":
			p[1] = strings.TrimSpace(p[1])
			v, err := strconv.ParseInt(p[1], 10, 32)
			if err != nil || v < -1 {
				return InvalidErrorf("libdefaults section line (%s)", line)
			}
			l.RealmTryDomains = int(v)
		case "renew_lifetime":
			d, err := parseDuration(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.RenewLifetime = d
		case "safe_checksum_type":
			p[1] = strings.TrimSpace(p[1])
			v, err := strconv.ParseInt(p[1], 10, 32)
			if err != nil || v < 0 {
				return InvalidErrorf("libdefaults section line (%s)", line)
			}
			l.SafeChecksumType = int(v)
		case "ticket_lifetime":
			d, err := parseDuration(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.TicketLifetime = d
		case "udp_preference_limit":
			p[1] = strings.TrimSpace(p[1])
			v, err := strconv.ParseUint(p[1], 10, 32)
			if err != nil || v > 32700 {
				return InvalidErrorf("libdefaults section line (%s)", line)
			}
			l.UDPPreferenceLimit = int(v)
		case "verify_ap_req_nofail":
			v, err := parseBoolean(p[1])
			if err != nil {
				return InvalidErrorf("libdefaults section line (%s): %v", line, err)
			}
			l.VerifyAPReqNofail = v
		}
	}
	l.DefaultTGSEnctypeIDs = parseETypes(l.DefaultTGSEnctypes, l.AllowWeakCrypto)
	l.DefaultTktEnctypeIDs = parseETypes(l.DefaultTktEnctypes, l.AllowWeakCrypto)
	l.PermittedEnctypeIDs = parseETypes(l.PermittedEnctypes, l.AllowWeakCrypto)
	return nil
}

// Realm represents an entry in the [realms] section of the configuration.
type Realm struct {
	Realm       string
	AdminServer []string
	//auth_to_local //Not implementing for now
	//auth_to_local_names //Not implementing for now
	DefaultDomain string
	KDC           []string
	KPasswdServer []string //default admin_server:464
	MasterKDC     []string
}

// Parse the lines of a [realms] entry into the Realm struct.
func (r *Realm) parseLines(name string, lines []string) (err error) {
	r.Realm = name
	var adminServerFinal bool
	var KDCFinal bool
	var kpasswdServerFinal bool
	var masterKDCFinal bool
	var ignore bool
	var c int // counts the depth of blocks within brackets { }
	for _, line := range lines {
		if ignore && c > 0 && !strings.Contains(line, "{") && !strings.Contains(line, "}") {
			continue
		}
		//Remove comments after the values
		if idx := strings.IndexAny(line, "#;"); idx != -1 {
			line = line[:idx]
		}
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.Contains(line, "=") && !strings.Contains(line, "}") {
			return InvalidErrorf("realms section line (%s)", line)
		}
		if strings.Contains(line, "v4_") {
			ignore = true
			err = UnsupportedDirective{"v4 configurations are not supported"}
		}
		if strings.Contains(line, "{") {
			c++
			if ignore {
				continue
			}
		}
		if strings.Contains(line, "}") {
			c--
			if c < 0 {
				return InvalidErrorf("unpaired curly brackets")
			}
			if ignore {
				if c < 1 {
					c = 0
					ignore = false
				}
				continue
			}
		}

		p := strings.Split(line, "=")
		key := strings.TrimSpace(strings.ToLower(p[0]))
		v := strings.TrimSpace(p[1])
		switch key {
		case "admin_server":
			appendUntilFinal(&r.AdminServer, v, &adminServerFinal)
		case "default_domain":
			r.DefaultDomain = v
		case "kdc":
			if !strings.Contains(v, ":") {
				// No port number specified default to 88
				if strings.HasSuffix(v, `*`) {
					v = strings.TrimSpace(strings.TrimSuffix(v, `*`)) + ":88*"
				} else {
					v = strings.TrimSpace(v) + ":88"
				}
			}
			appendUntilFinal(&r.KDC, v, &KDCFinal)
		case "kpasswd_server":
			appendUntilFinal(&r.KPasswdServer, v, &kpasswdServerFinal)
		case "master_kdc":
			appendUntilFinal(&r.MasterKDC, v, &masterKDCFinal)
		}
	}
	//default for Kpasswd_server = admin_server:464
	if len(r.KPasswdServer) < 1 {
		for _, a := range r.AdminServer {
			s := strings.Split(a, ":")
			r.KPasswdServer = append(r.KPasswdServer, s[0]+":464")
		}
	}
	return
}

// Parse the lines of the [realms] section of the configuration into an slice of Realm structs.
func parseRealms(lines []string) (realms []Realm, err error) {
	var name string
	var start int
	var c int
	for i, l := range lines {
		//Remove comments after the values
		if idx := strings.IndexAny(l, "#;"); idx != -1 {
			l = l[:idx]
		}
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		//if strings.Contains(l, "v4_") {
		//	return nil, errors.New("v4 configurations are not supported in Realms section")
		//}
		if strings.Contains(l, "{") {
			c++
			if !strings.Contains(l, "=") {
				return nil, fmt.Errorf("realm configuration line invalid: %s", l)
			}
			if c == 1 {
				start = i
				p := strings.Split(l, "=")
				name = strings.TrimSpace(p[0])
			}
		}
		if strings.Contains(l, "}") {
			if c < 1 {
				// but not started a block!!!
				return nil, errors.New("invalid Realms section in configuration")
			}
			c--
			if c == 0 {
				var r Realm
				e := r.parseLines(name, lines[start+1:i])
				if e != nil {
					if _, ok := e.(UnsupportedDirective); !ok {
						err = e
						return
					}
					err = e
				}
				realms = append(realms, r)
			}
		}
	}
	return
}

// DomainRealm maps the domains to realms representing the [domain_realm] section of the configuration.
type DomainRealm map[string]string

// Parse the lines of the [domain_realm] section of the configuration and add to the mapping.
func (d *DomainRealm) parseLines(lines []string) error {
	for _, line := range lines {
		//Remove comments after the values
		if idx := strings.IndexAny(line, "#;"); idx != -1 {
			line = line[:idx]
		}
		if strings.TrimSpace(line) == "" {
			continue
		}
		if !strings.Contains(line, "=") {
			return InvalidErrorf("realm line (%s)", line)
		}
		p := strings.Split(line, "=")
		domain := strings.TrimSpace(strings.ToLower(p[0]))
		realm := strings.TrimSpace(p[1])
		d.addMapping(domain, realm)
	}
	return nil
}

// Add a domain to realm mapping.
func (d *DomainRealm) addMapping(domain, realm string) {
	(*d)[domain] = realm
}

// Delete a domain to realm mapping.
func (d *DomainRealm) deleteMapping(domain, realm string) {
	delete(*d, domain)
}

// ResolveRealm resolves the kerberos realm for the specified domain name from the domain to realm mapping.
// The most specific mapping is returned.
func (c *Config) ResolveRealm(domainName string) string {
	domainName = strings.TrimSuffix(domainName, ".")

	// Try to match the entire hostname first
	if r, ok := c.DomainRealm[domainName]; ok {
		return r
	}

	// Try to match all DNS domain parts
	periods := strings.Count(domainName, ".") + 1
	for i := 2; i <= periods; i++ {
		z := strings.SplitN(domainName, ".", i)
		if r, ok := c.DomainRealm["."+z[len(z)-1]]; ok {
			return r
		}
	}
	return ""
}

// Load the KRB5 configuration from the specified file path.
func Load(cfgPath string) (*Config, error) {
	fh, err := os.Open(cfgPath)
	if err != nil {
		return nil, errors.New("configuration file could not be opened: " + cfgPath + " " + err.Error())
	}
	defer fh.Close()
	scanner := bufio.NewScanner(fh)
	return NewFromScanner(scanner)
}

// NewFromString creates a new Config struct from a string.
func NewFromString(s string) (*Config, error) {
	reader := strings.NewReader(s)
	return NewFromReader(reader)
}

// NewFromReader creates a new Config struct from an io.Reader.
func NewFromReader(r io.Reader) (*Config, error) {
	scanner := bufio.NewScanner(r)
	return NewFromScanner(scanner)
}

// NewFromScanner creates a new Config struct from a bufio.Scanner.
func NewFromScanner(scanner *bufio.Scanner) (*Config, error) {
	c := New()
	var e error
	sections := make(map[int]string)
	var sectionLineNum []int
	var lines []string
	for scanner.Scan() {
		// Skip comments and blank lines
		if matched, _ := regexp.MatchString(`^\s*(#|;|\n)`, scanner.Text()); matched {
			continue
		}
		if matched, _ := regexp.MatchString(`^\s*\[libdefaults\]\s*`, scanner.Text()); matched {
			sections[len(lines)] = "libdefaults"
			sectionLineNum = append(sectionLineNum, len(lines))
			continue
		}
		if matched, _ := regexp.MatchString(`^\s*\[realms\]\s*`, scanner.Text()); matched {
			sections[len(lines)] = "realms"
			sectionLineNum = append(sectionLineNum, len(lines))
			continue
		}
		if matched, _ := regexp.MatchString(`^\s*\[domain_realm\]\s*`, scanner.Text()); matched {
			sections[len(lines)] = "domain_realm"
			sectionLineNum = append(sectionLineNum, len(lines))
			continue
		}
		if matched, _ := regexp.MatchString(`^\s*\[.*\]\s*`, scanner.Text()); matched {
			sections[len(lines)] = "unknown_section"
			sectionLineNum = append(sectionLineNum, len(lines))
			continue
		}
		lines = append(lines, scanner.Text())
	}
	for i, start := range sectionLineNum {
		var end int
		if i+1 >= len(sectionLineNum) {
			end = len(lines)
		} else {
			end = sectionLineNum[i+1]
		}
		switch section := sections[start]; section {
		case "libdefaults":
			err := c.LibDefaults.parseLines(lines[start:end])
			if err != nil {
				if _, ok := err.(UnsupportedDirective); !ok {
					return nil, fmt.Errorf("error processing libdefaults section: %v", err)
				}
				e = err
			}
		case "realms":
			realms, err := parseRealms(lines[start:end])
			if err != nil {
				if _, ok := err.(UnsupportedDirective); !ok {
					return nil, fmt.Errorf("error processing realms section: %v", err)
				}
				e = err
			}
			c.Realms = realms
		case "domain_realm":
			err := c.DomainRealm.parseLines(lines[start:end])
			if err != nil {
				if _, ok := err.(UnsupportedDirective); !ok {
					return nil, fmt.Errorf("error processing domaain_realm section: %v", err)
				}
				e = err
			}
		}
	}
	return c, e
}

// Parse a space delimited list of ETypes into a list of EType numbers optionally filtering out weak ETypes.
func parseETypes(s []string, w bool) []int32 {
	var eti []int32
	for _, et := range s {
		if !w {
			var weak bool
			for _, wet := range strings.Fields(WeakETypeList) {
				if et == wet {
					weak = true
					break
				}
			}
			if weak {
				continue
			}
		}
		i := etypeID.EtypeSupported(et)
		if i != 0 {
			eti = append(eti, i)
		}
	}
	return eti
}

// Parse a time duration string in the configuration to a golang time.Duration.
func parseDuration(s string) (time.Duration, error) {
	s = strings.Replace(strings.TrimSpace(s), " ", "", -1)

	// handle Nd[NmNs]
	if strings.Contains(s, "d") {
		ds := strings.SplitN(s, "d", 2)
		dn, err := strconv.ParseUint(ds[0], 10, 32)
		if err != nil {
			return time.Duration(0), errors.New("invalid time duration")
		}
		d := time.Duration(dn*24) * time.Hour
		if ds[1] != "" {
			dp, err := time.ParseDuration(ds[1])
			if err != nil {
				return time.Duration(0), errors.New("invalid time duration")
			}
			d = d + dp
		}
		return d, nil
	}

	// handle Nm[Ns]
	d, err := time.ParseDuration(s)
	if err == nil {
		return d, nil
	}

	// handle N
	v, err := strconv.ParseUint(s, 10, 32)
	if err == nil && v > 0 {
		return time.Duration(v) * time.Second, nil
	}

	// handle h:m[:s]
	if strings.Contains(s, ":") {
		t := strings.Split(s, ":")
		if 2 > len(t) || len(t) > 3 {
			return time.Duration(0), errors.New("invalid time duration value")
		}
		var i []int
		for _, n := range t {
			j, err := strconv.ParseInt(n, 10, 16)
			if err != nil {
				return time.Duration(0), errors.New("invalid time duration value")
			}
			i = append(i, int(j))
		}
		d := time.Duration(i[0])*time.Hour + time.Duration(i[1])*time.Minute
		if len(i) == 3 {
			d = d + time.Duration(i[2])*time.Second
		}
		return d, nil
	}
	return time.Duration(0), errors.New("invalid time duration value")
}

// Parse possible boolean values to golang bool.
func parseBoolean(s string) (bool, error) {
	s = strings.TrimSpace(s)
	v, err := strconv.ParseBool(s)
	if err == nil {
		return v, nil
	}
	switch strings.ToLower(s) {
	case "yes":
		return true, nil
	case "y":
		return true, nil
	case "no":
		return false, nil
	case "n":
		return false, nil
	}
	return false, errors.New("invalid boolean value")
}

// Parse array of strings but stop if an asterisk is placed at the end of a line.
func appendUntilFinal(s *[]string, value string, final *bool) {
	if *final {
		return
	}
	if last := len(value) - 1; last >= 0 && value[last] == '*' {
		*final = true
		value = value[:len(value)-1]
	}
	*s = append(*s, value)
}

// JSON return details of the config in a JSON format.
func (c *Config) JSON() (string, error) {
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
