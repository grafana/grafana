package saml

import (
	"encoding/xml"
	"fmt"
	"net/url"
	"time"

	"github.com/beevik/etree"
)

// HTTPPostBinding is the official URN for the HTTP-POST binding (transport)
const HTTPPostBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"

// HTTPRedirectBinding is the official URN for the HTTP-Redirect binding (transport)
const HTTPRedirectBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"

// HTTPArtifactBinding is the official URN for the HTTP-Artifact binding (transport)
const HTTPArtifactBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Artifact"

// SOAPBinding is the official URN for the SOAP binding (transport)
const SOAPBinding = "urn:oasis:names:tc:SAML:2.0:bindings:SOAP"

// SOAPBindingV1 is the URN for the SOAP binding in SAML 1.0
const SOAPBindingV1 = "urn:oasis:names:tc:SAML:1.0:bindings:SOAP-binding"

// EntitiesDescriptor represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.3.1
type EntitiesDescriptor struct {
	XMLName             xml.Name       `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntitiesDescriptor"`
	ID                  *string        `xml:",attr,omitempty"`
	ValidUntil          *time.Time     `xml:"validUntil,attr,omitempty"`
	CacheDuration       *time.Duration `xml:"cacheDuration,attr,omitempty"`
	Name                *string        `xml:",attr,omitempty"`
	Signature           *etree.Element
	EntitiesDescriptors []EntitiesDescriptor `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntitiesDescriptor"`
	EntityDescriptors   []EntityDescriptor   `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
}

// Metadata as been renamed to EntityDescriptor
//
// This change was made to be consistent with the rest of the API which uses names
// from the SAML specification for types.
//
// This is a tombstone to help you discover this fact. You should update references
// to saml.Metadata to be saml.EntityDescriptor.
var Metadata = struct{}{}

// EntityDescriptor represents the SAML EntityDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.3.2
type EntityDescriptor struct {
	XMLName                       xml.Name      `xml:"urn:oasis:names:tc:SAML:2.0:metadata EntityDescriptor"`
	EntityID                      string        `xml:"entityID,attr"`
	ID                            string        `xml:",attr,omitempty"`
	ValidUntil                    time.Time     `xml:"validUntil,attr,omitempty"`
	CacheDuration                 time.Duration `xml:"cacheDuration,attr,omitempty"`
	Signature                     *etree.Element
	RoleDescriptors               []RoleDescriptor               `xml:"RoleDescriptor"`
	IDPSSODescriptors             []IDPSSODescriptor             `xml:"IDPSSODescriptor"`
	SPSSODescriptors              []SPSSODescriptor              `xml:"SPSSODescriptor"`
	AuthnAuthorityDescriptors     []AuthnAuthorityDescriptor     `xml:"AuthnAuthorityDescriptor"`
	AttributeAuthorityDescriptors []AttributeAuthorityDescriptor `xml:"AttributeAuthorityDescriptor"`
	PDPDescriptors                []PDPDescriptor                `xml:"PDPDescriptor"`
	AffiliationDescriptor         *AffiliationDescriptor
	Organization                  *Organization
	ContactPerson                 *ContactPerson
	AdditionalMetadataLocations   []string `xml:"AdditionalMetadataLocation"`
}

// MarshalXML implements xml.Marshaler
func (m EntityDescriptor) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	type Alias EntityDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		ValidUntil:    RelaxedTime(m.ValidUntil),
		CacheDuration: Duration(m.CacheDuration),
		Alias:         (*Alias)(&m),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (m *EntityDescriptor) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias EntityDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}
	m.ValidUntil = time.Time(aux.ValidUntil)
	m.CacheDuration = time.Duration(aux.CacheDuration)
	return nil
}

// Organization represents the SAML Organization object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.3.2.1
type Organization struct {
	OrganizationNames        []LocalizedName `xml:"OrganizationName"`
	OrganizationDisplayNames []LocalizedName `xml:"OrganizationDisplayName"`
	OrganizationURLs         []LocalizedURI  `xml:"OrganizationURL"`
}

// LocalizedName represents the SAML type localizedNameType.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.2.4
type LocalizedName struct {
	Lang  string `xml:"http://www.w3.org/XML/1998/namespace lang,attr"`
	Value string `xml:",chardata"`
}

// LocalizedURI represents the SAML type localizedURIType.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.2.5
type LocalizedURI struct {
	Lang  string `xml:"http://www.w3.org/XML/1998/namespace lang,attr"`
	Value string `xml:",chardata"`
}

// ContactPerson represents the SAML element ContactPerson.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.3.2.2
type ContactPerson struct {
	ContactType      string `xml:"contactType,attr"`
	Company          string
	GivenName        string
	SurName          string
	EmailAddresses   []string `xml:"EmailAddress"`
	TelephoneNumbers []string `xml:"TelephoneNumber"`
}

// RoleDescriptor represents the SAML element RoleDescriptor.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.1
type RoleDescriptor struct {
	ID                         string        `xml:",attr,omitempty"`
	ValidUntil                 time.Time     `xml:"validUntil,attr,omitempty"`
	CacheDuration              time.Duration `xml:"cacheDuration,attr,omitempty"`
	ProtocolSupportEnumeration string        `xml:"protocolSupportEnumeration,attr"`
	ErrorURL                   string        `xml:"errorURL,attr,omitempty"`
	Signature                  *etree.Element
	KeyDescriptors             []KeyDescriptor `xml:"KeyDescriptor,omitempty"`
	Organization               *Organization   `xml:"Organization,omitempty"`
	ContactPeople              []ContactPerson `xml:"ContactPerson,omitempty"`
}

// KeyDescriptor represents the XMLSEC object of the same name
type KeyDescriptor struct {
	Use               string             `xml:"use,attr"`
	KeyInfo           KeyInfo            `xml:"http://www.w3.org/2000/09/xmldsig# KeyInfo"`
	EncryptionMethods []EncryptionMethod `xml:"EncryptionMethod"`
}

// EncryptionMethod represents the XMLSEC object of the same name
type EncryptionMethod struct {
	Algorithm string `xml:"Algorithm,attr"`
}

// KeyInfo represents the XMLSEC object of the same name
type KeyInfo struct {
	XMLName  xml.Name `xml:"http://www.w3.org/2000/09/xmldsig# KeyInfo"`
	X509Data X509Data `xml:"X509Data"`
}

// X509Data represents the XMLSEC object of the same name
type X509Data struct {
	XMLName          xml.Name          `xml:"http://www.w3.org/2000/09/xmldsig# X509Data"`
	X509Certificates []X509Certificate `xml:"X509Certificate"`
}

// X509Certificate represents the XMLSEC object of the same name
type X509Certificate struct {
	XMLName xml.Name `xml:"http://www.w3.org/2000/09/xmldsig# X509Certificate"`
	Data    string   `xml:",chardata"`
}

// Endpoint represents the SAML EndpointType object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.2.2
type Endpoint struct {
	Binding          string `xml:"Binding,attr"`
	Location         string `xml:"Location,attr"`
	ResponseLocation string `xml:"ResponseLocation,attr,omitempty"`
}

func checkEndpointLocation(binding string, location string) (string, error) {
	// Within the SAML standard, the complex type EndpointType describes a
	// SAML protocol binding endpoint at which a SAML entity can be sent
	// protocol messages. In particular, the location of an endpoint type is
	// defined as follows in the Metadata for the OASIS Security Assertion
	// Markup Language (SAML) V2.0 - 2.2.2 Complex Type EndpointType:
	//
	//   Location [Required] A required URI attribute that specifies the
	//   location of the endpoint. The allowable syntax of this URI depends
	//   on the protocol binding.
	switch binding {
	case HTTPPostBinding,
		HTTPRedirectBinding,
		HTTPArtifactBinding,
		SOAPBinding,
		SOAPBindingV1:
		locationURL, err := url.Parse(location)
		if err != nil {
			return "", fmt.Errorf("invalid url %q: %w", location, err)
		}
		switch locationURL.Scheme {
		case "http", "https":
		// ok
		default:
			return "", fmt.Errorf("invalid url scheme %q for binding %q",
				locationURL.Scheme, binding)
		}
	default:
		// We don't know what form location should take, but the protocol
		// requires that we validate its syntax.
		//
		// In practice, lots of metadata contains random bindings, for example
		// "urn:mace:shibboleth:1.0:profiles:AuthnRequest" from our own test suite.
		//
		// We can't fail, but we also can't allow a location parameter whose syntax we
		// cannot verify. The least-bad course of action here is to set location to
		// and empty string, and hope the caller doesn't care need it.
		location = ""
	}

	return location, nil
}

// UnmarshalXML implements xml.Unmarshaler
func (m *Endpoint) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias Endpoint
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}

	var err error
	m.Location, err = checkEndpointLocation(m.Binding, m.Location)
	if err != nil {
		return err
	}
	if m.ResponseLocation != "" {
		m.ResponseLocation, err = checkEndpointLocation(m.Binding, m.ResponseLocation)
		if err != nil {
			return err
		}
	}

	return nil
}

// IndexedEndpoint represents the SAML IndexedEndpointType object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.2.3
type IndexedEndpoint struct {
	Binding          string  `xml:"Binding,attr"`
	Location         string  `xml:"Location,attr"`
	ResponseLocation *string `xml:"ResponseLocation,attr,omitempty"`
	Index            int     `xml:"index,attr"`
	IsDefault        *bool   `xml:"isDefault,attr"`
}

// UnmarshalXML implements xml.Unmarshaler
func (m *IndexedEndpoint) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias IndexedEndpoint
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}

	var err error
	m.Location, err = checkEndpointLocation(m.Binding, m.Location)
	if err != nil {
		return err
	}
	if m.ResponseLocation != nil {
		responseLocation, err := checkEndpointLocation(m.Binding, *m.ResponseLocation)
		if err != nil {
			return err
		}
		if responseLocation != "" {
			m.ResponseLocation = &responseLocation
		} else {
			m.ResponseLocation = nil
		}
	}

	return nil
}

// SSODescriptor represents the SAML complex type SSODescriptor
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.2
type SSODescriptor struct {
	RoleDescriptor
	ArtifactResolutionServices []IndexedEndpoint `xml:"ArtifactResolutionService"`
	SingleLogoutServices       []Endpoint        `xml:"SingleLogoutService"`
	ManageNameIDServices       []Endpoint        `xml:"ManageNameIDService"`
	NameIDFormats              []NameIDFormat    `xml:"NameIDFormat"`
}

// IDPSSODescriptor represents the SAML IDPSSODescriptorType object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.3
type IDPSSODescriptor struct {
	SSODescriptor
	XMLName                 xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata IDPSSODescriptor"`
	WantAuthnRequestsSigned *bool    `xml:",attr"`

	SingleSignOnServices       []Endpoint  `xml:"SingleSignOnService"`
	ArtifactResolutionServices []Endpoint  `xml:"ArtifactResolutionService"`
	NameIDMappingServices      []Endpoint  `xml:"NameIDMappingService"`
	AssertionIDRequestServices []Endpoint  `xml:"AssertionIDRequestService"`
	AttributeProfiles          []string    `xml:"AttributeProfile"`
	Attributes                 []Attribute `xml:"Attribute"`
}

// MarshalXML implements xml.Marshaler
func (m IDPSSODescriptor) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	type Alias IDPSSODescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		ValidUntil:    RelaxedTime(m.ValidUntil),
		CacheDuration: Duration(m.CacheDuration),
		Alias:         (*Alias)(&m),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (m *IDPSSODescriptor) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias IDPSSODescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}
	m.ValidUntil = time.Time(aux.ValidUntil)
	m.CacheDuration = time.Duration(aux.CacheDuration)
	return nil
}

// SPSSODescriptor represents the SAML SPSSODescriptorType object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.2
type SPSSODescriptor struct {
	SSODescriptor
	XMLName                    xml.Name                    `xml:"urn:oasis:names:tc:SAML:2.0:metadata SPSSODescriptor"`
	AuthnRequestsSigned        *bool                       `xml:",attr"`
	WantAssertionsSigned       *bool                       `xml:",attr"`
	AssertionConsumerServices  []IndexedEndpoint           `xml:"AssertionConsumerService"`
	AttributeConsumingServices []AttributeConsumingService `xml:"AttributeConsumingService"`
}

// MarshalXML implements xml.Marshaler
func (m SPSSODescriptor) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	type Alias SPSSODescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		ValidUntil:    RelaxedTime(m.ValidUntil),
		CacheDuration: Duration(m.CacheDuration),
		Alias:         (*Alias)(&m),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (m *SPSSODescriptor) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias SPSSODescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}
	m.ValidUntil = time.Time(aux.ValidUntil)
	m.CacheDuration = time.Duration(aux.CacheDuration)
	return nil
}

// AttributeConsumingService represents the SAML AttributeConsumingService object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.4.1
type AttributeConsumingService struct {
	Index               int                  `xml:"index,attr"`
	IsDefault           *bool                `xml:"isDefault,attr"`
	ServiceNames        []LocalizedName      `xml:"ServiceName"`
	ServiceDescriptions []LocalizedName      `xml:"ServiceDescription"`
	RequestedAttributes []RequestedAttribute `xml:"RequestedAttribute"`
}

// RequestedAttribute represents the SAML RequestedAttribute object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.4.2
type RequestedAttribute struct {
	Attribute
	IsRequired *bool `xml:"isRequired,attr"`
}

// AuthnAuthorityDescriptor represents the SAML AuthnAuthorityDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.5
type AuthnAuthorityDescriptor struct {
	RoleDescriptor
	XMLName                    xml.Name       `xml:"urn:oasis:names:tc:SAML:2.0:metadata AuthnAuthorityDescriptor"`
	AuthnQueryServices         []Endpoint     `xml:"AuthnQueryService"`
	AssertionIDRequestServices []Endpoint     `xml:"AssertionIDRequestService"`
	NameIDFormats              []NameIDFormat `xml:"NameIDFormat"`
}

// MarshalXML implements xml.Marshaler
func (m AuthnAuthorityDescriptor) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	type Alias AuthnAuthorityDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		ValidUntil:    RelaxedTime(m.ValidUntil),
		CacheDuration: Duration(m.CacheDuration),
		Alias:         (*Alias)(&m),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (m *AuthnAuthorityDescriptor) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias AuthnAuthorityDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}
	m.ValidUntil = time.Time(aux.ValidUntil)
	m.CacheDuration = time.Duration(aux.CacheDuration)
	return nil
}

// PDPDescriptor represents the SAML PDPDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.6
type PDPDescriptor struct {
	RoleDescriptor
	XMLName                    xml.Name       `xml:"urn:oasis:names:tc:SAML:2.0:metadata PDPDescriptor"`
	AuthzServices              []Endpoint     `xml:"AuthzService"`
	AssertionIDRequestServices []Endpoint     `xml:"AssertionIDRequestService"`
	NameIDFormats              []NameIDFormat `xml:"NameIDFormat"`
}

// MarshalXML implements xml.Marshaler
func (m PDPDescriptor) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	type Alias PDPDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		ValidUntil:    RelaxedTime(m.ValidUntil),
		CacheDuration: Duration(m.CacheDuration),
		Alias:         (*Alias)(&m),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (m *PDPDescriptor) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias PDPDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}
	m.ValidUntil = time.Time(aux.ValidUntil)
	m.CacheDuration = time.Duration(aux.CacheDuration)
	return nil
}

// AttributeAuthorityDescriptor represents the SAML AttributeAuthorityDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.7
type AttributeAuthorityDescriptor struct {
	RoleDescriptor
	XMLName                    xml.Name       `xml:"urn:oasis:names:tc:SAML:2.0:metadata AttributeAuthorityDescriptor"`
	AttributeServices          []Endpoint     `xml:"AttributeService"`
	AssertionIDRequestServices []Endpoint     `xml:"AssertionIDRequestService"`
	NameIDFormats              []NameIDFormat `xml:"NameIDFormat"`
	AttributeProfiles          []string       `xml:"AttributeProfile"`
	Attributes                 []Attribute    `xml:"Attribute"`
}

// MarshalXML implements xml.Marshaler
func (m AttributeAuthorityDescriptor) MarshalXML(e *xml.Encoder, _ xml.StartElement) error {
	type Alias AttributeAuthorityDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		ValidUntil:    RelaxedTime(m.ValidUntil),
		CacheDuration: Duration(m.CacheDuration),
		Alias:         (*Alias)(&m),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (m *AttributeAuthorityDescriptor) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias AttributeAuthorityDescriptor
	aux := &struct {
		ValidUntil    RelaxedTime `xml:"validUntil,attr,omitempty"`
		CacheDuration Duration    `xml:"cacheDuration,attr,omitempty"`
		*Alias
	}{
		Alias: (*Alias)(m),
	}
	if err := d.DecodeElement(aux, &start); err != nil {
		return err
	}
	m.ValidUntil = time.Time(aux.ValidUntil)
	m.CacheDuration = time.Duration(aux.CacheDuration)
	return nil
}

// AffiliationDescriptor represents the SAML AffiliationDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.5
type AffiliationDescriptor struct {
	AffiliationOwnerID string        `xml:"affiliationOwnerID,attr"`
	ID                 string        `xml:",attr"`
	ValidUntil         time.Time     `xml:"validUntil,attr,omitempty"`
	CacheDuration      time.Duration `xml:"cacheDuration,attr"`
	Signature          *etree.Element
	AffiliateMembers   []string        `xml:"AffiliateMember"`
	KeyDescriptors     []KeyDescriptor `xml:"KeyDescriptor"`
}
