package goidentity

import (
	"bytes"
	"encoding/gob"
	"github.com/hashicorp/go-uuid"
	"time"
)

type User struct {
	authenticated   bool
	domain          string
	userName        string
	displayName     string
	email           string
	human           bool
	groupMembership map[string]bool
	authTime        time.Time
	sessionID       string
	expiry          time.Time
	attributes      map[string]interface{}
}

func NewUser(username string) User {
	uuid, err := uuid.GenerateUUID()
	if err != nil {
		uuid = "00unique-sess-ions-uuid-unavailable0"
	}
	return User{
		userName:        username,
		groupMembership: make(map[string]bool),
		sessionID:       uuid,
	}
}

func (u *User) UserName() string {
	return u.userName
}

func (u *User) SetUserName(s string) {
	u.userName = s
}

func (u *User) Domain() string {
	return u.domain
}

func (u *User) SetDomain(s string) {
	u.domain = s
}

func (u *User) DisplayName() string {
	if u.displayName == "" {
		return u.userName
	}
	return u.displayName
}

func (u *User) SetDisplayName(s string) {
	u.displayName = s
}

func (u *User) Human() bool {
	return u.human
}

func (u *User) SetHuman(b bool) {
	u.human = b
}

func (u *User) AuthTime() time.Time {
	return u.authTime
}

func (u *User) SetAuthTime(t time.Time) {
	u.authTime = t
}

func (u *User) AuthzAttributes() []string {
	s := make([]string, len(u.groupMembership))
	i := 0
	for a := range u.groupMembership {
		s[i] = a
		i++
	}
	return s
}

func (u *User) Authenticated() bool {
	return u.authenticated
}

func (u *User) SetAuthenticated(b bool) {
	u.authenticated = b
}

func (u *User) AddAuthzAttribute(a string) {
	u.groupMembership[a] = true
}

func (u *User) RemoveAuthzAttribute(a string) {
	if _, ok := u.groupMembership[a]; !ok {
		return
	}
	delete(u.groupMembership, a)
}

func (u *User) EnableAuthzAttribute(a string) {
	if enabled, ok := u.groupMembership[a]; ok && !enabled {
		u.groupMembership[a] = true
	}
}

func (u *User) DisableAuthzAttribute(a string) {
	if enabled, ok := u.groupMembership[a]; ok && enabled {
		u.groupMembership[a] = false
	}
}

func (u *User) Authorized(a string) bool {
	if enabled, ok := u.groupMembership[a]; ok && enabled {
		return true
	}
	return false
}

func (u *User) SessionID() string {
	return u.sessionID
}

func (u *User) SetExpiry(t time.Time) {
	u.expiry = t
}

func (u *User) Expired() bool {
	if !u.expiry.IsZero() && time.Now().UTC().After(u.expiry) {
		return true
	}
	return false
}

func (u *User) Attributes() map[string]interface{} {
	return u.attributes
}

func (u *User) SetAttribute(k string, v interface{}) {
	u.attributes[k] = v
}

func (u *User) SetAttributes(a map[string]interface{}) {
	u.attributes = a
}

func (u *User) RemoveAttribute(k string) {
	delete(u.attributes, k)
}

func (u *User) Marshal() ([]byte, error) {
	buf := new(bytes.Buffer)
	enc := gob.NewEncoder(buf)
	err := enc.Encode(u)
	if err != nil {
		return []byte{}, err
	}
	return buf.Bytes(), nil
}

func (u *User) Unmarshal(b []byte) error {
	buf := bytes.NewBuffer(b)
	dec := gob.NewDecoder(buf)
	return dec.Decode(u)
}
