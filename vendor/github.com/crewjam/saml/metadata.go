package saml

import (
	"encoding/xml"
	"time"

	"github.com/beevik/etree"
)

// HTTPPostBinding is the official URN for the HTTP-POST binding (transport)
var HTTPPostBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"

// HTTPRedirectBinding is the official URN for the HTTP-Redirect binding (transport)
var HTTPRedirectBinding = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"

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
func (m EntityDescriptor) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
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
	Lang  string `xml:"xml lang,attr"`
	Value string `xml:",chardata"`
}

// LocalizedURI represents the SAML type localizedURIType.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.2.5
type LocalizedURI struct {
	Lang  string `xml:"xml lang,attr"`
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
	ValidUntil                 *time.Time    `xml:"validUntil,attr,omitempty"`
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
//
// TODO(ross): revisit xmldsig and make this type more complete
type KeyInfo struct {
	XMLName     xml.Name `xml:"http://www.w3.org/2000/09/xmldsig# KeyInfo"`
	Certificate string   `xml:"X509Data>X509Certificate"`
}

// Endpoint represents the SAML EndpointType object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.2.2
type Endpoint struct {
	Binding          string `xml:"Binding,attr"`
	Location         string `xml:"Location,attr"`
	ResponseLocation string `xml:"ResponseLocation,attr,omitempty"`
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
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata IDPSSODescriptor"`
	SSODescriptor
	WantAuthnRequestsSigned *bool `xml:",attr"`

	SingleSignOnServices       []Endpoint  `xml:"SingleSignOnService"`
	NameIDMappingServices      []Endpoint  `xml:"NameIDMappingService"`
	AssertionIDRequestServices []Endpoint  `xml:"AssertionIDRequestService"`
	AttributeProfiles          []string    `xml:"AttributeProfile"`
	Attributes                 []Attribute `xml:"Attribute"`
}

// SPSSODescriptor represents the SAML SPSSODescriptorType object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.2
type SPSSODescriptor struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:metadata SPSSODescriptor"`
	SSODescriptor
	AuthnRequestsSigned        *bool                       `xml:",attr"`
	WantAssertionsSigned       *bool                       `xml:",attr"`
	AssertionConsumerServices  []IndexedEndpoint           `xml:"AssertionConsumerService"`
	AttributeConsumingServices []AttributeConsumingService `xml:"AttributeConsumingService"`
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
	AuthnQueryServices         []Endpoint     `xml:"AuthnQueryService"`
	AssertionIDRequestServices []Endpoint     `xml:"AssertionIDRequestService"`
	NameIDFormats              []NameIDFormat `xml:"NameIDFormat"`
}

// PDPDescriptor represents the SAML PDPDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.6
type PDPDescriptor struct {
	RoleDescriptor
	AuthzServices              []Endpoint     `xml:"AuthzService"`
	AssertionIDRequestServices []Endpoint     `xml:"AssertionIDRequestService"`
	NameIDFormats              []NameIDFormat `xml:"NameIDFormat"`
}

// AttributeAuthorityDescriptor represents the SAML AttributeAuthorityDescriptor object.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-metadata-2.0-os.pdf §2.4.7
type AttributeAuthorityDescriptor struct {
	RoleDescriptor
	AttributeServices          []Endpoint     `xml:"AttributeService"`
	AssertionIDRequestServices []Endpoint     `xml:"AssertionIDRequestService"`
	NameIDFormats              []NameIDFormat `xml:"NameIDFormat"`
	AttributeProfiles          []string       `xml:"AttributeProfile"`
	Attributes                 []Attribute    `xml:"Attribute"`
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
