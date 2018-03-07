package ldap_test

import (
	"reflect"
	"testing"

	"gopkg.in/ldap.v2"
)

func TestSuccessfulDNParsing(t *testing.T) {
	testcases := map[string]ldap.DN{
		"": ldap.DN{[]*ldap.RelativeDN{}},
		"cn=Jim\\2C \\22Hasse Hö\\22 Hansson!,dc=dummy,dc=com": ldap.DN{[]*ldap.RelativeDN{
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"cn", "Jim, \"Hasse Hö\" Hansson!"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"dc", "dummy"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"dc", "com"}}}}},
		"UID=jsmith,DC=example,DC=net": ldap.DN{[]*ldap.RelativeDN{
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"UID", "jsmith"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"DC", "example"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"DC", "net"}}}}},
		"OU=Sales+CN=J. Smith,DC=example,DC=net": ldap.DN{[]*ldap.RelativeDN{
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{
				&ldap.AttributeTypeAndValue{"OU", "Sales"},
				&ldap.AttributeTypeAndValue{"CN", "J. Smith"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"DC", "example"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"DC", "net"}}}}},
		"1.3.6.1.4.1.1466.0=#04024869": ldap.DN{[]*ldap.RelativeDN{
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"1.3.6.1.4.1.1466.0", "Hi"}}}}},
		"1.3.6.1.4.1.1466.0=#04024869,DC=net": ldap.DN{[]*ldap.RelativeDN{
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"1.3.6.1.4.1.1466.0", "Hi"}}},
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"DC", "net"}}}}},
		"CN=Lu\\C4\\8Di\\C4\\87": ldap.DN{[]*ldap.RelativeDN{
			&ldap.RelativeDN{[]*ldap.AttributeTypeAndValue{&ldap.AttributeTypeAndValue{"CN", "Lučić"}}}}},
	}

	for test, answer := range testcases {
		dn, err := ldap.ParseDN(test)
		if err != nil {
			t.Errorf(err.Error())
			continue
		}
		if !reflect.DeepEqual(dn, &answer) {
			t.Errorf("Parsed DN %s is not equal to the expected structure", test)
			for _, rdn := range dn.RDNs {
				for _, attribs := range rdn.Attributes {
					t.Logf("#%v\n", attribs)
				}
			}
		}
	}
}

func TestErrorDNParsing(t *testing.T) {
	testcases := map[string]string{
		"*":               "DN ended with incomplete type, value pair",
		"cn=Jim\\0Test":   "Failed to decode escaped character: encoding/hex: invalid byte: U+0054 'T'",
		"cn=Jim\\0":       "Got corrupted escaped character",
		"DC=example,=net": "DN ended with incomplete type, value pair",
		"1=#0402486":      "Failed to decode BER encoding: encoding/hex: odd length hex string",
	}

	for test, answer := range testcases {
		_, err := ldap.ParseDN(test)
		if err == nil {
			t.Errorf("Expected %s to fail parsing but succeeded\n", test)
		} else if err.Error() != answer {
			t.Errorf("Unexpected error on %s:\n%s\nvs.\n%s\n", test, answer, err.Error())
		}
	}
}
