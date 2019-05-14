package fake

import (
	"net"
	"strings"

	"github.com/corpix/uarand"
)

// UserName generates user name in one of the following forms
// first name + last name, letter + last names or concatenation of from 1 to 3 lowercased words
func UserName() string {
	gender := randGender()
	switch r.Intn(3) {
	case 0:
		return lookup("en", gender+"_first_names", false) + lookup(lang, gender+"_last_names", false)
	case 1:
		return Character() + lookup(lang, gender+"_last_names", false)
	default:
		return strings.Replace(WordsN(r.Intn(3)+1), " ", "_", -1)
	}
}

// TopLevelDomain generates random top level domain
func TopLevelDomain() string {
	return lookup(lang, "top_level_domains", true)
}

// DomainName generates random domain name
func DomainName() string {
	return Company() + "." + TopLevelDomain()
}

// EmailAddress generates email address
func EmailAddress() string {
	return UserName() + "@" + DomainName()
}

// EmailSubject generates random email subject
func EmailSubject() string {
	return Sentence()
}

// EmailBody generates random email body
func EmailBody() string {
	return Paragraphs()
}

// DomainZone generates random domain zone
func DomainZone() string {
	return lookup(lang, "domain_zones", true)
}

// IPv4 generates IPv4 address
func IPv4() string {
	size := 4
	ip := make([]byte, size)
	for i := 0; i < size; i++ {
		ip[i] = byte(r.Intn(256))
	}
	return net.IP(ip).To4().String()
}

// IPv6 generates IPv6 address
func IPv6() string {
	size := 16
	ip := make([]byte, size)
	for i := 0; i < size; i++ {
		ip[i] = byte(r.Intn(256))
	}
	return net.IP(ip).To16().String()
}

// UserAgent generates a random user agent.
func UserAgent() string {
	return uarand.GetRandom()
}
