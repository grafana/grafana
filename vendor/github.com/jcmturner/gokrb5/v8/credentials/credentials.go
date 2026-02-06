// Package credentials provides credentials management for Kerberos 5 authentication.
package credentials

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"time"

	"github.com/hashicorp/go-uuid"
	"github.com/jcmturner/gokrb5/v8/iana/nametype"
	"github.com/jcmturner/gokrb5/v8/keytab"
	"github.com/jcmturner/gokrb5/v8/types"
)

const (
	// AttributeKeyADCredentials assigned number for AD credentials.
	AttributeKeyADCredentials = "gokrb5AttributeKeyADCredentials"
)

// Credentials struct for a user.
// Contains either a keytab, password or both.
// Keytabs are used over passwords if both are defined.
type Credentials struct {
	username        string
	displayName     string
	realm           string
	cname           types.PrincipalName
	keytab          *keytab.Keytab
	password        string
	attributes      map[string]interface{}
	validUntil      time.Time
	authenticated   bool
	human           bool
	authTime        time.Time
	groupMembership map[string]bool
	sessionID       string
}

// marshalCredentials is used to enable marshaling and unmarshaling of credentials
// without having exported fields on the Credentials struct
type marshalCredentials struct {
	Username        string
	DisplayName     string
	Realm           string
	CName           types.PrincipalName `json:"-"`
	Keytab          bool
	Password        bool
	Attributes      map[string]interface{} `json:"-"`
	ValidUntil      time.Time
	Authenticated   bool
	Human           bool
	AuthTime        time.Time
	GroupMembership map[string]bool `json:"-"`
	SessionID       string
}

// ADCredentials contains information obtained from the PAC.
type ADCredentials struct {
	EffectiveName       string
	FullName            string
	UserID              int
	PrimaryGroupID      int
	LogOnTime           time.Time
	LogOffTime          time.Time
	PasswordLastSet     time.Time
	GroupMembershipSIDs []string
	LogonDomainName     string
	LogonDomainID       string
	LogonServer         string
}

// New creates a new Credentials instance.
func New(username string, realm string) *Credentials {
	uid, err := uuid.GenerateUUID()
	if err != nil {
		uid = "00unique-sess-ions-uuid-unavailable0"
	}
	return &Credentials{
		username:        username,
		displayName:     username,
		realm:           realm,
		cname:           types.NewPrincipalName(nametype.KRB_NT_PRINCIPAL, username),
		keytab:          keytab.New(),
		attributes:      make(map[string]interface{}),
		groupMembership: make(map[string]bool),
		sessionID:       uid,
		human:           true,
	}
}

// NewFromPrincipalName creates a new Credentials instance with the user details provides as a PrincipalName type.
func NewFromPrincipalName(cname types.PrincipalName, realm string) *Credentials {
	c := New(cname.PrincipalNameString(), realm)
	c.cname = cname
	return c
}

// WithKeytab sets the Keytab in the Credentials struct.
func (c *Credentials) WithKeytab(kt *keytab.Keytab) *Credentials {
	c.keytab = kt
	c.password = ""
	return c
}

// Keytab returns the credential's Keytab.
func (c *Credentials) Keytab() *keytab.Keytab {
	return c.keytab
}

// HasKeytab queries if the Credentials has a keytab defined.
func (c *Credentials) HasKeytab() bool {
	if c.keytab != nil && len(c.keytab.Entries) > 0 {
		return true
	}
	return false
}

// WithPassword sets the password in the Credentials struct.
func (c *Credentials) WithPassword(password string) *Credentials {
	c.password = password
	c.keytab = keytab.New() // clear any keytab
	return c
}

// Password returns the credential's password.
func (c *Credentials) Password() string {
	return c.password
}

// HasPassword queries if the Credentials has a password defined.
func (c *Credentials) HasPassword() bool {
	if c.password != "" {
		return true
	}
	return false
}

// SetValidUntil sets the expiry time of the credentials
func (c *Credentials) SetValidUntil(t time.Time) {
	c.validUntil = t
}

// SetADCredentials adds ADCredentials attributes to the credentials
func (c *Credentials) SetADCredentials(a ADCredentials) {
	c.SetAttribute(AttributeKeyADCredentials, a)
	if a.FullName != "" {
		c.SetDisplayName(a.FullName)
	}
	if a.EffectiveName != "" {
		c.SetUserName(a.EffectiveName)
	}
	for i := range a.GroupMembershipSIDs {
		c.AddAuthzAttribute(a.GroupMembershipSIDs[i])
	}
}

// GetADCredentials returns ADCredentials attributes sorted in the credential
func (c *Credentials) GetADCredentials() ADCredentials {
	if a, ok := c.attributes[AttributeKeyADCredentials].(ADCredentials); ok {
		return a
	}
	return ADCredentials{}
}

// Methods to implement goidentity.Identity interface

// UserName returns the credential's username.
func (c *Credentials) UserName() string {
	return c.username
}

// SetUserName sets the username value on the credential.
func (c *Credentials) SetUserName(s string) {
	c.username = s
}

// CName returns the credential's client principal name.
func (c *Credentials) CName() types.PrincipalName {
	return c.cname
}

// SetCName sets the client principal name on the credential.
func (c *Credentials) SetCName(pn types.PrincipalName) {
	c.cname = pn
}

// Domain returns the credential's domain.
func (c *Credentials) Domain() string {
	return c.realm
}

// SetDomain sets the domain value on the credential.
func (c *Credentials) SetDomain(s string) {
	c.realm = s
}

// Realm returns the credential's realm. Same as the domain.
func (c *Credentials) Realm() string {
	return c.Domain()
}

// SetRealm sets the realm value on the credential. Same as the domain
func (c *Credentials) SetRealm(s string) {
	c.SetDomain(s)
}

// DisplayName returns the credential's display name.
func (c *Credentials) DisplayName() string {
	return c.displayName
}

// SetDisplayName sets the display name value on the credential.
func (c *Credentials) SetDisplayName(s string) {
	c.displayName = s
}

// Human returns if the  credential represents a human or not.
func (c *Credentials) Human() bool {
	return c.human
}

// SetHuman sets the credential as human.
func (c *Credentials) SetHuman(b bool) {
	c.human = b
}

// AuthTime returns the time the credential was authenticated.
func (c *Credentials) AuthTime() time.Time {
	return c.authTime
}

// SetAuthTime sets the time the credential was authenticated.
func (c *Credentials) SetAuthTime(t time.Time) {
	c.authTime = t
}

// AuthzAttributes returns the credentials authorizing attributes.
func (c *Credentials) AuthzAttributes() []string {
	s := make([]string, len(c.groupMembership))
	i := 0
	for a := range c.groupMembership {
		s[i] = a
		i++
	}
	return s
}

// Authenticated indicates if the credential has been successfully authenticated or not.
func (c *Credentials) Authenticated() bool {
	return c.authenticated
}

// SetAuthenticated sets the credential as having been successfully authenticated.
func (c *Credentials) SetAuthenticated(b bool) {
	c.authenticated = b
}

// AddAuthzAttribute adds an authorization attribute to the credential.
func (c *Credentials) AddAuthzAttribute(a string) {
	c.groupMembership[a] = true
}

// RemoveAuthzAttribute removes an authorization attribute from the credential.
func (c *Credentials) RemoveAuthzAttribute(a string) {
	if _, ok := c.groupMembership[a]; !ok {
		return
	}
	delete(c.groupMembership, a)
}

// EnableAuthzAttribute toggles an authorization attribute to an enabled state on the credential.
func (c *Credentials) EnableAuthzAttribute(a string) {
	if enabled, ok := c.groupMembership[a]; ok && !enabled {
		c.groupMembership[a] = true
	}
}

// DisableAuthzAttribute toggles an authorization attribute to a disabled state on the credential.
func (c *Credentials) DisableAuthzAttribute(a string) {
	if enabled, ok := c.groupMembership[a]; ok && enabled {
		c.groupMembership[a] = false
	}
}

// Authorized indicates if the credential has the specified authorizing attribute.
func (c *Credentials) Authorized(a string) bool {
	if enabled, ok := c.groupMembership[a]; ok && enabled {
		return true
	}
	return false
}

// SessionID returns the credential's session ID.
func (c *Credentials) SessionID() string {
	return c.sessionID
}

// Expired indicates if the credential has expired.
func (c *Credentials) Expired() bool {
	if !c.validUntil.IsZero() && time.Now().UTC().After(c.validUntil) {
		return true
	}
	return false
}

// ValidUntil returns the credential's valid until date
func (c *Credentials) ValidUntil() time.Time {
	return c.validUntil
}

// Attributes returns the Credentials' attributes map.
func (c *Credentials) Attributes() map[string]interface{} {
	return c.attributes
}

// SetAttribute sets the value of an attribute.
func (c *Credentials) SetAttribute(k string, v interface{}) {
	c.attributes[k] = v
}

// SetAttributes replaces the attributes map with the one provided.
func (c *Credentials) SetAttributes(a map[string]interface{}) {
	c.attributes = a
}

// RemoveAttribute deletes an attribute from the attribute map that has the key provided.
func (c *Credentials) RemoveAttribute(k string) {
	delete(c.attributes, k)
}

// Marshal the Credentials into a byte slice
func (c *Credentials) Marshal() ([]byte, error) {
	gob.Register(map[string]interface{}{})
	gob.Register(ADCredentials{})
	buf := new(bytes.Buffer)
	enc := gob.NewEncoder(buf)
	mc := marshalCredentials{
		Username:        c.username,
		DisplayName:     c.displayName,
		Realm:           c.realm,
		CName:           c.cname,
		Keytab:          c.HasKeytab(),
		Password:        c.HasPassword(),
		Attributes:      c.attributes,
		ValidUntil:      c.validUntil,
		Authenticated:   c.authenticated,
		Human:           c.human,
		AuthTime:        c.authTime,
		GroupMembership: c.groupMembership,
		SessionID:       c.sessionID,
	}
	err := enc.Encode(&mc)
	if err != nil {
		return []byte{}, err
	}
	return buf.Bytes(), nil
}

// Unmarshal a byte slice into Credentials
func (c *Credentials) Unmarshal(b []byte) error {
	gob.Register(map[string]interface{}{})
	gob.Register(ADCredentials{})
	mc := new(marshalCredentials)
	buf := bytes.NewBuffer(b)
	dec := gob.NewDecoder(buf)
	err := dec.Decode(mc)
	if err != nil {
		return err
	}
	c.username = mc.Username
	c.displayName = mc.DisplayName
	c.realm = mc.Realm
	c.cname = mc.CName
	c.attributes = mc.Attributes
	c.validUntil = mc.ValidUntil
	c.authenticated = mc.Authenticated
	c.human = mc.Human
	c.authTime = mc.AuthTime
	c.groupMembership = mc.GroupMembership
	c.sessionID = mc.SessionID
	return nil
}

// JSON return details of the Credentials in a JSON format.
func (c *Credentials) JSON() (string, error) {
	mc := marshalCredentials{
		Username:      c.username,
		DisplayName:   c.displayName,
		Realm:         c.realm,
		CName:         c.cname,
		Keytab:        c.HasKeytab(),
		Password:      c.HasPassword(),
		ValidUntil:    c.validUntil,
		Authenticated: c.authenticated,
		Human:         c.human,
		AuthTime:      c.authTime,
		SessionID:     c.sessionID,
	}
	b, err := json.MarshalIndent(mc, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
