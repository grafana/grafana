/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package mysql

import (
	"crypto/x509"
	"net"

	querypb "github.com/dolthub/vitess/go/vt/proto/query"
)

// AuthServerNone takes all comers.
// It's meant to be used for testing and prototyping.
// With this config, you can connect to a local vtgate using
// the following command line: 'mysql -P port -h ::'.
// It only uses MysqlNativePassword method.
type AuthServerNone struct {
	methods []AuthMethod
}

// AuthMethods returns the list of registered auth methods
// implemented by this auth server.
func (a *AuthServerNone) AuthMethods() []AuthMethod {
	return a.methods
}

// DefaultAuthMethodDescription returns MysqlNativePassword as the default
// authentication method for the auth server implementation.
func (a *AuthServerNone) DefaultAuthMethodDescription() AuthMethodDescription {
	return MysqlNativePassword
}

// HandleUser validates if this user can use this auth method
func (a *AuthServerNone) HandleUser(user string, remoteAddr net.Addr) bool {
	return true
}

// UserEntryWithHash validates the user if it exists and returns the information.
// Always accepts any user.
func (a *AuthServerNone) UserEntryWithHash(userCerts []*x509.Certificate, salt []byte, user string, authResponse []byte, remoteAddr net.Addr) (Getter, error) {
	return &NoneGetter{}, nil
}

func init() {
	a := NewAuthServerNone()
	RegisterAuthServer("none", a)
}

// NewAuthServerNone returns an empty auth server. Always accepts all clients.
func NewAuthServerNone() *AuthServerNone {
	a := &AuthServerNone{}
	a.methods = []AuthMethod{NewMysqlNativeAuthMethod(a, a)}
	return a
}

// NoneGetter holds the empty string
type NoneGetter struct{}

// Get returns the empty string
func (ng *NoneGetter) Get() *querypb.VTGateCallerID {
	return &querypb.VTGateCallerID{Username: "userData1"}
}
