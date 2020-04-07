package saml

import (
	"encoding/xml"
	"strconv"
	"time"

	"github.com/beevik/etree"
	"github.com/russellhaering/goxmldsig/etreeutils"
)

// AuthnRequest represents the SAML object of the same name, a request from a service provider
// to authenticate a user.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type AuthnRequest struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol AuthnRequest"`

	ID           string    `xml:",attr"`
	Version      string    `xml:",attr"`
	IssueInstant time.Time `xml:",attr"`
	Destination  string    `xml:",attr"`
	Consent      string    `xml:",attr"`
	Issuer       *Issuer   `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Signature    *etree.Element

	Subject      *Subject
	NameIDPolicy *NameIDPolicy `xml:"urn:oasis:names:tc:SAML:2.0:protocol NameIDPolicy"`
	Conditions   *Conditions
	//RequestedAuthnContext *RequestedAuthnContext // TODO
	//Scoping               *Scoping // TODO

	ForceAuthn                     *bool  `xml:",attr"`
	IsPassive                      *bool  `xml:",attr"`
	AssertionConsumerServiceIndex  string `xml:",attr"`
	AssertionConsumerServiceURL    string `xml:",attr"`
	ProtocolBinding                string `xml:",attr"`
	AttributeConsumingServiceIndex string `xml:",attr"`
	ProviderName                   string `xml:",attr"`
}

type LogoutRequest struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol LogoutRequest"`

	ID           string    `xml:",attr"`
	Version      string    `xml:",attr"`
	IssueInstant time.Time `xml:",attr"`
	Destination  string    `xml:",attr"`
	Issuer       *Issuer   `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	NameID       *NameID
	Signature    *etree.Element

	SessionIndex string `xml:",attr"`
}

// Element returns an etree.Element representing the object in XML form.
func (r *LogoutRequest) Element() *etree.Element {
	el := etree.NewElement("samlp:LogoutRequest")
	el.CreateAttr("xmlns:saml", "urn:oasis:names:tc:SAML:2.0:assertion")
	el.CreateAttr("xmlns:samlp", "urn:oasis:names:tc:SAML:2.0:protocol")
	el.CreateAttr("ID", r.ID)
	el.CreateAttr("Version", r.Version)
	el.CreateAttr("IssueInstant", r.IssueInstant.Format(timeFormat))
	if r.Destination != "" {
		el.CreateAttr("Destination", r.Destination)
	}
	if r.Issuer != nil {
		el.AddChild(r.Issuer.Element())
	}
	if r.NameID != nil {
		el.AddChild(r.NameID.Element())
	}
	if r.Signature != nil {
		el.AddChild(r.Signature)
	}
	if r.SessionIndex != "" {
		el.CreateAttr("SessionIndex", r.SessionIndex)
	}
	return el
}

// MarshalXML implements xml.Marshaler
func (r *LogoutRequest) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias LogoutRequest
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		IssueInstant: RelaxedTime(r.IssueInstant),
		Alias:        (*Alias)(r),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (r *LogoutRequest) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias LogoutRequest
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(r),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	r.IssueInstant = time.Time(aux.IssueInstant)
	return nil
}

// Element returns an etree.Element representing the object
// Element returns an etree.Element representing the object in XML form.
func (r *AuthnRequest) Element() *etree.Element {
	el := etree.NewElement("samlp:AuthnRequest")
	el.CreateAttr("xmlns:saml", "urn:oasis:names:tc:SAML:2.0:assertion")
	el.CreateAttr("xmlns:samlp", "urn:oasis:names:tc:SAML:2.0:protocol")
	el.CreateAttr("ID", r.ID)
	el.CreateAttr("Version", r.Version)
	el.CreateAttr("IssueInstant", r.IssueInstant.Format(timeFormat))
	if r.Destination != "" {
		el.CreateAttr("Destination", r.Destination)
	}
	if r.Consent != "" {
		el.CreateAttr("Consent", r.Consent)
	}
	if r.Issuer != nil {
		el.AddChild(r.Issuer.Element())
	}
	if r.Signature != nil {
		el.AddChild(r.Signature)
	}
	if r.Subject != nil {
		el.AddChild(r.Subject.Element())
	}
	if r.NameIDPolicy != nil {
		el.AddChild(r.NameIDPolicy.Element())
	}
	if r.Conditions != nil {
		el.AddChild(r.Conditions.Element())
	}
	//if r.RequestedAuthnContext != nil {
	//	el.AddChild(r.RequestedAuthnContext.Element())
	//}
	//if r.Scoping != nil {
	//	el.AddChild(r.Scoping.Element())
	//}
	if r.ForceAuthn != nil {
		el.CreateAttr("ForceAuthn", strconv.FormatBool(*r.ForceAuthn))
	}
	if r.IsPassive != nil {
		el.CreateAttr("IsPassive", strconv.FormatBool(*r.IsPassive))
	}
	if r.AssertionConsumerServiceIndex != "" {
		el.CreateAttr("AssertionConsumerServiceIndex", r.AssertionConsumerServiceIndex)
	}
	if r.AssertionConsumerServiceURL != "" {
		el.CreateAttr("AssertionConsumerServiceURL", r.AssertionConsumerServiceURL)
	}
	if r.ProtocolBinding != "" {
		el.CreateAttr("ProtocolBinding", r.ProtocolBinding)
	}
	if r.AttributeConsumingServiceIndex != "" {
		el.CreateAttr("AttributeConsumingServiceIndex", r.AttributeConsumingServiceIndex)
	}
	if r.ProviderName != "" {
		el.CreateAttr("ProviderName", r.ProviderName)
	}
	return el
}

// MarshalXML implements xml.Marshaler
func (r *AuthnRequest) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias AuthnRequest
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		IssueInstant: RelaxedTime(r.IssueInstant),
		Alias:        (*Alias)(r),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (r *AuthnRequest) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias AuthnRequest
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(r),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	r.IssueInstant = time.Time(aux.IssueInstant)
	return nil
}

// Issuer represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type Issuer struct {
	XMLName         xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	NameQualifier   string   `xml:",attr"`
	SPNameQualifier string   `xml:",attr"`
	Format          string   `xml:",attr"`
	SPProvidedID    string   `xml:",attr"`
	Value           string   `xml:",chardata"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *Issuer) Element() *etree.Element {
	el := etree.NewElement("saml:Issuer")
	if a.NameQualifier != "" {
		el.CreateAttr("NameQualifier", a.NameQualifier)
	}
	if a.SPNameQualifier != "" {
		el.CreateAttr("SPNameQualifier", a.SPNameQualifier)
	}
	if a.Format != "" {
		el.CreateAttr("Format", a.Format)
	}
	if a.SPProvidedID != "" {
		el.CreateAttr("SPProvidedID", a.SPProvidedID)
	}
	el.SetText(a.Value)
	return el
}

// NameIDPolicy represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type NameIDPolicy struct {
	XMLName         xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol NameIDPolicy"`
	Format          *string  `xml:",attr"`
	SPNameQualifier *string  `xml:",attr"`
	AllowCreate     *bool    `xml:",attr"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *NameIDPolicy) Element() *etree.Element {
	el := etree.NewElement("samlp:NameIDPolicy")
	if a.Format != nil {
		el.CreateAttr("Format", *a.Format)
	}
	if a.SPNameQualifier != nil {
		el.CreateAttr("SPNameQualifier", *a.SPNameQualifier)
	}
	if a.AllowCreate != nil {
		el.CreateAttr("AllowCreate", strconv.FormatBool(*a.AllowCreate))
	}
	return el
}

// Response represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type Response struct {
	XMLName      xml.Name  `xml:"urn:oasis:names:tc:SAML:2.0:protocol Response"`
	ID           string    `xml:",attr"`
	InResponseTo string    `xml:",attr"`
	Version      string    `xml:",attr"`
	IssueInstant time.Time `xml:",attr"`
	Destination  string    `xml:",attr"`
	Consent      string    `xml:",attr"`
	Issuer       *Issuer   `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Signature    *etree.Element
	Status       Status `xml:"urn:oasis:names:tc:SAML:2.0:protocol Status"`

	// TODO(ross): more than one EncryptedAssertion is allowed
	EncryptedAssertion *etree.Element `xml:"urn:oasis:names:tc:SAML:2.0:assertion EncryptedAssertion"`

	// TODO(ross): more than one Assertion is allowed
	Assertion *Assertion `xml:"urn:oasis:names:tc:SAML:2.0:assertion Assertion"`
}

// Element returns an etree.Element representing the object in XML form.
func (r *Response) Element() *etree.Element {
	el := etree.NewElement("samlp:Response")
	el.CreateAttr("xmlns:saml", "urn:oasis:names:tc:SAML:2.0:assertion")
	el.CreateAttr("xmlns:samlp", "urn:oasis:names:tc:SAML:2.0:protocol")

	// Note: This namespace is not used by any element or attribute name, but
	// is required so that the AttributeValue type element can have a value like
	// "xs:string". If we don't declare it here, then it will be stripped by the
	// cannonicalizer. This could be avoided by providing a prefix list to the
	// cannonicalizer, but prefix lists do not appear to be implemented correctly
	// in some libraries, so the safest action is to always produce XML that is
	// (a) in canonical form and (b) does not require prefix lists.
	el.CreateAttr("xmlns:xs", "http://www.w3.org/2001/XMLSchema")

	el.CreateAttr("ID", r.ID)
	if r.InResponseTo != "" {
		el.CreateAttr("InResponseTo", r.InResponseTo)
	}
	el.CreateAttr("Version", r.Version)
	el.CreateAttr("IssueInstant", r.IssueInstant.Format(timeFormat))
	if r.Destination != "" {
		el.CreateAttr("Destination", r.Destination)
	}
	if r.Consent != "" {
		el.CreateAttr("Consent", r.Consent)
	}
	if r.Issuer != nil {
		el.AddChild(r.Issuer.Element())
	}
	if r.Signature != nil {
		el.AddChild(r.Signature)
	}
	el.AddChild(r.Status.Element())
	if r.EncryptedAssertion != nil {
		el.AddChild(r.EncryptedAssertion)
	}
	if r.Assertion != nil {
		el.AddChild(r.Assertion.Element())
	}
	return el
}

// MarshalXML implements xml.Marshaler
func (r *Response) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias Response
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		IssueInstant: RelaxedTime(r.IssueInstant),
		Alias:        (*Alias)(r),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (r *Response) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias Response
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(r),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	r.IssueInstant = time.Time(aux.IssueInstant)
	return nil
}

// Status represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type Status struct {
	XMLName       xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol Status"`
	StatusCode    StatusCode
	StatusMessage *StatusMessage
	StatusDetail  *StatusDetail
}

// Element returns an etree.Element representing the object in XML form.
func (s *Status) Element() *etree.Element {
	el := etree.NewElement("samlp:Status")
	el.AddChild(s.StatusCode.Element())
	if s.StatusMessage != nil {
		el.AddChild(s.StatusMessage.Element())
	}
	if s.StatusDetail != nil {
		el.AddChild(s.StatusDetail.Element())
	}
	return el
}

// StatusCode represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type StatusCode struct {
	XMLName    xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:protocol StatusCode"`
	Value      string   `xml:",attr"`
	StatusCode *StatusCode
}

// Element returns an etree.Element representing the object in XML form.
func (s *StatusCode) Element() *etree.Element {
	el := etree.NewElement("samlp:StatusCode")
	el.CreateAttr("Value", s.Value)
	if s.StatusCode != nil {
		el.AddChild(s.StatusCode.Element())
	}
	return el
}

// StatusSuccess means the request succeeded. Additional information MAY be returned in the <StatusMessage> and/or <StatusDetail> elements.
//
// TODO(ross): this value is mostly constant, but is mutated in tests. Fix the hacky test so this can be const.
var StatusSuccess = "urn:oasis:names:tc:SAML:2.0:status:Success"

const (
	// The permissible top-level <StatusCode> values are as follows:

	// StatusRequester means the request could not be performed due to an error on the part of the requester.
	StatusRequester = "urn:oasis:names:tc:SAML:2.0:status:Requester"

	// StatusResponder means the request could not be performed due to an error on the part of the SAML responder or SAML authority.
	StatusResponder = "urn:oasis:names:tc:SAML:2.0:status:Responder"

	// StatusVersionMismatch means the SAML responder could not process the request because the version of the request message was incorrect.
	StatusVersionMismatch = "urn:oasis:names:tc:SAML:2.0:status:VersionMismatch"

	// The following second-level status codes are referenced at various places in this specification. Additional
	// second-level status codes MAY be defined in future versions of the SAML specification. System entities
	// are free to define more specific status codes by defining appropriate URI references.

	// StatusAuthnFailed means the responding provider was unable to successfully authenticate the principal.
	StatusAuthnFailed = "urn:oasis:names:tc:SAML:2.0:status:AuthnFailed"

	// StatusInvalidAttrNameOrValue means Unexpected or invalid content was encountered within a <saml:Attribute> or <saml:AttributeValue> element.
	StatusInvalidAttrNameOrValue = "urn:oasis:names:tc:SAML:2.0:status:InvalidAttrNameOrValue"

	// StatusInvalidNameIDPolicy means the responding provider cannot or will not support the requested name identifier policy.
	StatusInvalidNameIDPolicy = "urn:oasis:names:tc:SAML:2.0:status:InvalidNameIDPolicy"

	// StatusNoAuthnContext means the specified authentication context requirements cannot be met by the responder.
	StatusNoAuthnContext = "urn:oasis:names:tc:SAML:2.0:status:NoAuthnContext"

	// StatusNoAvailableIDP is used by an intermediary to indicate that none of the supported identity provider <Loc> elements in an <IDPList> can be resolved or that none of the supported identity providers are available.
	StatusNoAvailableIDP = "urn:oasis:names:tc:SAML:2.0:status:NoAvailableIDP"

	// StatusNoPassive means Indicates the responding provider cannot authenticate the principal passively, as has been requested.
	StatusNoPassive = "urn:oasis:names:tc:SAML:2.0:status:NoPassive" //nolint:gosec

	// StatusNoSupportedIDP is used by an intermediary to indicate that none of the identity providers in an <IDPList> are supported by the intermediary.
	StatusNoSupportedIDP = "urn:oasis:names:tc:SAML:2.0:status:NoSupportedIDP"

	// StatusPartialLogout is used by a session authority to indicate to a session participant that it was not able to propagate logout to all other session participants.
	StatusPartialLogout = "urn:oasis:names:tc:SAML:2.0:status:PartialLogout"

	// StatusProxyCountExceeded means Indicates that a responding provider cannot authenticate the principal directly and is not permitted to proxy the request further.
	StatusProxyCountExceeded = "urn:oasis:names:tc:SAML:2.0:status:ProxyCountExceeded"

	// StatusRequestDenied means the SAML responder or SAML authority is able to process the request but has chosen not to respond. This status code MAY be used when there is concern about the security context of the request message or the sequence of request messages received from a particular requester.
	StatusRequestDenied = "urn:oasis:names:tc:SAML:2.0:status:RequestDenied"

	// StatusRequestUnsupported means the SAML responder or SAML authority does not support the request.
	StatusRequestUnsupported = "urn:oasis:names:tc:SAML:2.0:status:RequestUnsupported"

	// StatusRequestVersionDeprecated means the SAML responder cannot process any requests with the protocol version specified in the request.
	StatusRequestVersionDeprecated = "urn:oasis:names:tc:SAML:2.0:status:RequestVersionDeprecated"

	// StatusRequestVersionTooHigh means the SAML responder cannot process the request because the protocol version specified in the request message is a major upgrade from the highest protocol version supported by the responder.
	StatusRequestVersionTooHigh = "urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooHigh"

	// StatusRequestVersionTooLow means the SAML responder cannot process the request because the protocol version specified in the request message is too low.
	StatusRequestVersionTooLow = "urn:oasis:names:tc:SAML:2.0:status:RequestVersionTooLow"

	// StatusResourceNotRecognized means the resource value provided in the request message is invalid or unrecognized.
	StatusResourceNotRecognized = "urn:oasis:names:tc:SAML:2.0:status:ResourceNotRecognized"

	// StatusTooManyResponses means the response message would contain more elements than the SAML responder is able to return.
	StatusTooManyResponses = "urn:oasis:names:tc:SAML:2.0:status:TooManyResponses"

	// StatusUnknownAttrProfile means an entity that has no knowledge of a particular attribute profile has been presented with an attribute means drawn from that profile.
	StatusUnknownAttrProfile = "urn:oasis:names:tc:SAML:2.0:status:UnknownAttrProfile"

	// StatusUnknownPrincipal means the responding provider does not recognize the principal specified or implied by the request.
	StatusUnknownPrincipal = "urn:oasis:names:tc:SAML:2.0:status:UnknownPrincipal"

	// StatusUnsupportedBinding means the SAML responder cannot properly fulfill the request using the protocol binding specified in the request.
	StatusUnsupportedBinding = "urn:oasis:names:tc:SAML:2.0:status:UnsupportedBinding"
)

// StatusMessage represents the SAML element StatusMessage.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §3.2.2.3
type StatusMessage struct {
	Value string
}

// Element returns an etree.Element representing the object in XML form.
func (sm StatusMessage) Element() *etree.Element {
	el := etree.NewElement("samlp:StatusMessage")
	el.SetText(sm.Value)
	return el
}

// StatusDetail represents the SAML element StatusDetail.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §3.2.2.4
type StatusDetail struct {
	Children []*etree.Element
}

// Element returns an etree.Element representing the object in XML form.
func (sm StatusDetail) Element() *etree.Element {
	el := etree.NewElement("samlp:StatusDetail")
	for _, child := range sm.Children {
		el.AddChild(child)
	}
	return el
}

// Assertion represents the SAML element Assertion.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.3.3
type Assertion struct {
	XMLName      xml.Name  `xml:"urn:oasis:names:tc:SAML:2.0:assertion Assertion"`
	ID           string    `xml:",attr"`
	IssueInstant time.Time `xml:",attr"`
	Version      string    `xml:",attr"`
	Issuer       Issuer    `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Signature    *etree.Element
	Subject      *Subject
	Conditions   *Conditions
	// Advice *Advice
	// Statements []Statement
	AuthnStatements []AuthnStatement `xml:"AuthnStatement"`
	// AuthzDecisionStatements []AuthzDecisionStatement
	AttributeStatements []AttributeStatement `xml:"AttributeStatement"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *Assertion) Element() *etree.Element {
	el := etree.NewElement("saml:Assertion")
	el.CreateAttr("xmlns:saml", "urn:oasis:names:tc:SAML:2.0:assertion")
	el.CreateAttr("Version", "2.0")
	el.CreateAttr("ID", a.ID)
	el.CreateAttr("IssueInstant", a.IssueInstant.Format(timeFormat))
	el.AddChild(a.Issuer.Element())
	if a.Signature != nil {
		el.AddChild(a.Signature)
	}
	if a.Subject != nil {
		el.AddChild(a.Subject.Element())
	}
	if a.Conditions != nil {
		el.AddChild(a.Conditions.Element())
	}
	for _, authnStatement := range a.AuthnStatements {
		el.AddChild(authnStatement.Element())
	}
	for _, attributeStatement := range a.AttributeStatements {
		el.AddChild(attributeStatement.Element())
	}
	err := etreeutils.TransformExcC14n(el, canonicalizerPrefixList)
	if err != nil {
		panic(err)
	}
	return el
}

// UnmarshalXML implements xml.Unmarshaler
func (a *Assertion) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias Assertion
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(a),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	a.IssueInstant = time.Time(aux.IssueInstant)
	return nil
}

// Subject represents the SAML element Subject.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.4.1
type Subject struct {
	XMLName xml.Name `xml:"urn:oasis:names:tc:SAML:2.0:assertion Subject"`
	// BaseID               *BaseID  ... TODO
	NameID *NameID
	// EncryptedID          *EncryptedID  ... TODO
	SubjectConfirmations []SubjectConfirmation `xml:"SubjectConfirmation"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *Subject) Element() *etree.Element {
	el := etree.NewElement("saml:Subject")
	if a.NameID != nil {
		el.AddChild(a.NameID.Element())
	}
	for _, v := range a.SubjectConfirmations {
		el.AddChild(v.Element())
	}
	return el
}

// NameID represents the SAML element NameID.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.2.3
type NameID struct {
	NameQualifier   string `xml:",attr"`
	SPNameQualifier string `xml:",attr"`
	Format          string `xml:",attr"`
	SPProvidedID    string `xml:",attr"`
	Value           string `xml:",chardata"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *NameID) Element() *etree.Element {
	el := etree.NewElement("saml:NameID")
	if a.NameQualifier != "" {
		el.CreateAttr("NameQualifier", a.NameQualifier)
	}
	if a.SPNameQualifier != "" {
		el.CreateAttr("SPNameQualifier", a.SPNameQualifier)
	}
	if a.Format != "" {
		el.CreateAttr("Format", a.Format)
	}
	if a.SPProvidedID != "" {
		el.CreateAttr("SPProvidedID", a.SPProvidedID)
	}
	if a.Value != "" {
		el.SetText(a.Value)
	}
	return el
}

// SubjectConfirmation represents the SAML element SubjectConfirmation.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.4.1.1
type SubjectConfirmation struct {
	Method string `xml:",attr"`
	// BaseID               *BaseID  ... TODO
	NameID *NameID
	// EncryptedID          *EncryptedID  ... TODO
	SubjectConfirmationData *SubjectConfirmationData
}

// Element returns an etree.Element representing the object in XML form.
func (a *SubjectConfirmation) Element() *etree.Element {
	el := etree.NewElement("saml:SubjectConfirmation")
	el.CreateAttr("Method", a.Method)
	if a.NameID != nil {
		el.AddChild(a.NameID.Element())
	}
	if a.SubjectConfirmationData != nil {
		el.AddChild(a.SubjectConfirmationData.Element())
	}
	return el
}

// SubjectConfirmationData represents the SAML element SubjectConfirmationData.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.4.1.2
type SubjectConfirmationData struct {
	NotBefore    time.Time `xml:",attr"`
	NotOnOrAfter time.Time `xml:",attr"`
	Recipient    string    `xml:",attr"`
	InResponseTo string    `xml:",attr"`
	Address      string    `xml:",attr"`
}

// Element returns an etree.Element representing the object in XML form.
func (s *SubjectConfirmationData) Element() *etree.Element {
	el := etree.NewElement("saml:SubjectConfirmationData")
	if !s.NotBefore.IsZero() {
		el.CreateAttr("NotBefore", s.NotBefore.Format(timeFormat))
	}
	if !s.NotOnOrAfter.IsZero() {
		el.CreateAttr("NotOnOrAfter", s.NotOnOrAfter.Format(timeFormat))
	}
	if s.Recipient != "" {
		el.CreateAttr("Recipient", s.Recipient)
	}
	if s.InResponseTo != "" {
		el.CreateAttr("InResponseTo", s.InResponseTo)
	}
	if s.Address != "" {
		el.CreateAttr("Address", s.Address)
	}
	return el
}

// MarshalXML implements xml.Marshaler
func (s *SubjectConfirmationData) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias SubjectConfirmationData
	aux := &struct {
		NotOnOrAfter RelaxedTime `xml:",attr"`
		*Alias
	}{
		NotOnOrAfter: RelaxedTime(s.NotOnOrAfter),
		Alias:        (*Alias)(s),
	}
	return e.EncodeElement(aux, start)
}

// UnmarshalXML implements xml.Unmarshaler
func (s *SubjectConfirmationData) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias SubjectConfirmationData
	aux := &struct {
		NotOnOrAfter RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(s),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	s.NotOnOrAfter = time.Time(aux.NotOnOrAfter)
	return nil
}

// Conditions represents the SAML element Conditions.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.5.1
type Conditions struct {
	NotBefore            time.Time             `xml:",attr"`
	NotOnOrAfter         time.Time             `xml:",attr"`
	AudienceRestrictions []AudienceRestriction `xml:"AudienceRestriction"`
	OneTimeUse           *OneTimeUse
	ProxyRestriction     *ProxyRestriction
}

// Element returns an etree.Element representing the object in XML form.
func (c *Conditions) Element() *etree.Element {
	el := etree.NewElement("saml:Conditions")
	if !c.NotBefore.IsZero() {
		el.CreateAttr("NotBefore", c.NotBefore.Format(timeFormat))
	}
	if !c.NotOnOrAfter.IsZero() {
		el.CreateAttr("NotOnOrAfter", c.NotOnOrAfter.Format(timeFormat))
	}
	for _, v := range c.AudienceRestrictions {
		el.AddChild(v.Element())
	}
	if c.OneTimeUse != nil {
		el.AddChild(c.OneTimeUse.Element())
	}
	if c.ProxyRestriction != nil {
		el.AddChild(c.ProxyRestriction.Element())
	}
	return el
}

// MarshalXML implements xml.Marshaler
func (c *Conditions) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias Conditions
	aux := &struct {
		NotBefore    RelaxedTime `xml:",attr"`
		NotOnOrAfter RelaxedTime `xml:",attr"`
		*Alias
	}{
		NotBefore:    RelaxedTime(c.NotBefore),
		NotOnOrAfter: RelaxedTime(c.NotOnOrAfter),
		Alias:        (*Alias)(c),
	}
	return e.EncodeElement(aux, start)
}

// UnmarshalXML implements xml.Unmarshaler
func (c *Conditions) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias Conditions
	aux := &struct {
		NotBefore    RelaxedTime `xml:",attr"`
		NotOnOrAfter RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(c),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	c.NotBefore = time.Time(aux.NotBefore)
	c.NotOnOrAfter = time.Time(aux.NotOnOrAfter)
	return nil
}

// AudienceRestriction represents the SAML element AudienceRestriction.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.5.1.4
type AudienceRestriction struct {
	Audience Audience
}

// Element returns an etree.Element representing the object in XML form.
func (a *AudienceRestriction) Element() *etree.Element {
	el := etree.NewElement("saml:AudienceRestriction")
	el.AddChild(a.Audience.Element())
	return el
}

// Audience represents the SAML element Audience.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.5.1.4
type Audience struct {
	Value string `xml:",chardata"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *Audience) Element() *etree.Element {
	el := etree.NewElement("saml:Audience")
	el.SetText(a.Value)
	return el
}

// OneTimeUse represents the SAML element OneTimeUse.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.5.1.5
type OneTimeUse struct{}

// Element returns an etree.Element representing the object in XML form.
func (a *OneTimeUse) Element() *etree.Element {
	return etree.NewElement("saml:OneTimeUse")
}

// ProxyRestriction represents the SAML element ProxyRestriction.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.5.1.6
type ProxyRestriction struct {
	Count     *int
	Audiences []Audience
}

// Element returns an etree.Element representing the object in XML form.
func (a *ProxyRestriction) Element() *etree.Element {
	el := etree.NewElement("saml:ProxyRestriction")
	if a.Count != nil {
		el.CreateAttr("Count", strconv.Itoa(*a.Count))
	}
	for _, v := range a.Audiences {
		el.AddChild(v.Element())
	}
	return el
}

// AuthnStatement represents the SAML element AuthnStatement.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.2
type AuthnStatement struct {
	AuthnInstant        time.Time  `xml:",attr"`
	SessionIndex        string     `xml:",attr"`
	SessionNotOnOrAfter *time.Time `xml:",attr"`
	SubjectLocality     *SubjectLocality
	AuthnContext        AuthnContext
}

// Element returns an etree.Element representing the object in XML form.
func (a *AuthnStatement) Element() *etree.Element {
	el := etree.NewElement("saml:AuthnStatement")
	el.CreateAttr("AuthnInstant", a.AuthnInstant.Format(timeFormat))
	if a.SessionIndex != "" {
		el.CreateAttr("SessionIndex", a.SessionIndex)
	}
	if a.SubjectLocality != nil {
		el.AddChild(a.SubjectLocality.Element())
	}
	el.AddChild(a.AuthnContext.Element())
	return el
}

// MarshalXML implements xml.Marshaler
func (a *AuthnStatement) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias AuthnStatement
	aux := &struct {
		AuthnInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		AuthnInstant: RelaxedTime(a.AuthnInstant),
		Alias:        (*Alias)(a),
	}
	return e.EncodeElement(aux, start)
}

// UnmarshalXML implements xml.Unmarshaler
func (a *AuthnStatement) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias AuthnStatement
	aux := &struct {
		AuthnInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(a),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	a.AuthnInstant = time.Time(aux.AuthnInstant)
	return nil
}

// SubjectLocality represents the SAML element SubjectLocality.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.2.1
type SubjectLocality struct {
	Address string `xml:",attr"`
	DNSName string `xml:",attr"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *SubjectLocality) Element() *etree.Element {
	el := etree.NewElement("saml:SubjectLocality")
	if a.Address != "" {
		el.CreateAttr("Address", a.Address)
	}
	if a.DNSName != "" {
		el.CreateAttr("DNSName", a.DNSName)
	}
	return el
}

// AuthnContext represents the SAML element AuthnContext.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.2.2
type AuthnContext struct {
	AuthnContextClassRef *AuthnContextClassRef
	//AuthnContextDecl          *AuthnContextDecl        ... TODO
	//AuthnContextDeclRef       *AuthnContextDeclRef     ... TODO
	//AuthenticatingAuthorities []AuthenticatingAuthority... TODO
}

// Element returns an etree.Element representing the object in XML form.
func (a *AuthnContext) Element() *etree.Element {
	el := etree.NewElement("saml:AuthnContext")
	if a.AuthnContextClassRef != nil {
		el.AddChild(a.AuthnContextClassRef.Element())
	}
	return el
}

// AuthnContextClassRef represents the SAML element AuthnContextClassRef.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.2.2
type AuthnContextClassRef struct {
	Value string `xml:",chardata"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *AuthnContextClassRef) Element() *etree.Element {
	el := etree.NewElement("saml:AuthnContextClassRef")
	el.SetText(a.Value)
	return el
}

// AttributeStatement represents the SAML element AttributeStatement.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.3
type AttributeStatement struct {
	Attributes []Attribute `xml:"Attribute"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *AttributeStatement) Element() *etree.Element {
	el := etree.NewElement("saml:AttributeStatement")
	for _, v := range a.Attributes {
		el.AddChild(v.Element())
	}
	return el
}

// Attribute represents the SAML element Attribute.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.3.1
type Attribute struct {
	FriendlyName string           `xml:",attr"`
	Name         string           `xml:",attr"`
	NameFormat   string           `xml:",attr"`
	Values       []AttributeValue `xml:"AttributeValue"`
}

// Element returns an etree.Element representing the object in XML form.
func (a *Attribute) Element() *etree.Element {
	el := etree.NewElement("saml:Attribute")
	if a.FriendlyName != "" {
		el.CreateAttr("FriendlyName", a.FriendlyName)
	}
	if a.Name != "" {
		el.CreateAttr("Name", a.Name)
	}
	if a.NameFormat != "" {
		el.CreateAttr("NameFormat", a.NameFormat)
	}
	for _, v := range a.Values {
		el.AddChild(v.Element())
	}
	return el
}

// AttributeValue represents the SAML element AttributeValue.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf §2.7.3.1.1
type AttributeValue struct {
	Type   string `xml:"http://www.w3.org/2001/XMLSchema-instance type,attr"`
	Value  string `xml:",chardata"`
	NameID *NameID
}

// Element returns an etree.Element representing the object in XML form.
func (a *AttributeValue) Element() *etree.Element {
	el := etree.NewElement("saml:AttributeValue")
	el.CreateAttr("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
	el.CreateAttr("xmlns:xs", "http://www.w3.org/2001/XMLSchema")
	el.CreateAttr("xsi:type", a.Type)
	if a.NameID != nil {
		el.AddChild(a.NameID.Element())
	}
	el.SetText(a.Value)
	return el
}

// LogoutResponse represents the SAML object of the same name.
//
// See http://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf
type LogoutResponse struct {
	XMLName      xml.Name  `xml:"urn:oasis:names:tc:SAML:2.0:protocol LogoutResponse"`
	ID           string    `xml:",attr"`
	InResponseTo string    `xml:",attr"`
	Version      string    `xml:",attr"`
	IssueInstant time.Time `xml:",attr"`
	Destination  string    `xml:",attr"`
	Consent      string    `xml:",attr"`
	Issuer       *Issuer   `xml:"urn:oasis:names:tc:SAML:2.0:assertion Issuer"`
	Signature    *etree.Element
	Status       Status `xml:"urn:oasis:names:tc:SAML:2.0:protocol Status"`
}

// Element returns an etree.Element representing the object in XML form.
func (r *LogoutResponse) Element() *etree.Element {
	el := etree.NewElement("samlp:Response")
	el.CreateAttr("xmlns:saml", "urn:oasis:names:tc:SAML:2.0:assertion")
	el.CreateAttr("xmlns:samlp", "urn:oasis:names:tc:SAML:2.0:protocol")

	el.CreateAttr("ID", r.ID)
	if r.InResponseTo != "" {
		el.CreateAttr("InResponseTo", r.InResponseTo)
	}
	el.CreateAttr("Version", r.Version)
	el.CreateAttr("IssueInstant", r.IssueInstant.Format(timeFormat))
	if r.Destination != "" {
		el.CreateAttr("Destination", r.Destination)
	}
	if r.Consent != "" {
		el.CreateAttr("Consent", r.Consent)
	}
	if r.Issuer != nil {
		el.AddChild(r.Issuer.Element())
	}
	if r.Signature != nil {
		el.AddChild(r.Signature)
	}
	el.AddChild(r.Status.Element())
	return el
}

// MarshalXML implements xml.Marshaler
func (r *LogoutResponse) MarshalXML(e *xml.Encoder, start xml.StartElement) error {
	type Alias LogoutResponse
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		IssueInstant: RelaxedTime(r.IssueInstant),
		Alias:        (*Alias)(r),
	}
	return e.Encode(aux)
}

// UnmarshalXML implements xml.Unmarshaler
func (r *LogoutResponse) UnmarshalXML(d *xml.Decoder, start xml.StartElement) error {
	type Alias LogoutResponse
	aux := &struct {
		IssueInstant RelaxedTime `xml:",attr"`
		*Alias
	}{
		Alias: (*Alias)(r),
	}
	if err := d.DecodeElement(&aux, &start); err != nil {
		return err
	}
	r.IssueInstant = time.Time(aux.IssueInstant)
	return nil
}
