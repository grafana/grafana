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
	"flag"
	"fmt"
	"net"

	"github.com/dolthub/vitess/go/vt/log"
)

var clientcertAuthMethod = flag.String("mysql_clientcert_auth_method", string(MysqlClearPassword), "client-side authentication method to use. Supported values: mysql_clear_password, dialog.")

// AuthServerClientCert implements AuthServer which enforces client side certificates
type AuthServerClientCert struct {
	methods []AuthMethod
	Method  AuthMethodDescription
}

// InitAuthServerClientCert is public so it can be called from plugin_auth_clientcert.go (go/cmd/vtgate)
func InitAuthServerClientCert() {
	if flag.CommandLine.Lookup("mysql_server_ssl_ca").Value.String() == "" {
		log.Info("Not configuring AuthServerClientCert because mysql_server_ssl_ca is empty")
		return
	}
	if *clientcertAuthMethod != string(MysqlClearPassword) && *clientcertAuthMethod != string(MysqlDialog) {
		log.Fatalf("Invalid mysql_clientcert_auth_method value: only support mysql_clear_password or dialog")
	}
	ascc := newAuthServerClientCert()
	RegisterAuthServer("clientcert", ascc)
}

func newAuthServerClientCert() *AuthServerClientCert {
	ascc := &AuthServerClientCert{
		Method: AuthMethodDescription(*clientcertAuthMethod),
	}

	var authMethod AuthMethod
	switch AuthMethodDescription(*clientcertAuthMethod) {
	case MysqlClearPassword:
		authMethod = NewMysqlClearAuthMethod(ascc, ascc)
	case MysqlDialog:
		authMethod = NewMysqlDialogAuthMethod(ascc, ascc, "")
	default:
		log.Fatalf("Invalid mysql_ldap_auth_method value: only support mysql_clear_password or dialog")
	}
	ascc.methods = []AuthMethod{authMethod}
	return ascc
}

// AuthMethods returns the implement auth methods for the client
// certificate authentication setup.
func (asl *AuthServerClientCert) AuthMethods() []AuthMethod {
	return asl.methods
}

// DefaultAuthMethodDescription returns always MysqlNativePassword
// for the client certificate authentication setup.
func (asl *AuthServerClientCert) DefaultAuthMethodDescription() AuthMethodDescription {
	return MysqlNativePassword
}

// HandleUser is part of the UserValidator interface. We
// handle any user here since we don't check up front.
func (asl *AuthServerClientCert) HandleUser(user string, remoteAddr net.Addr) bool {
	return true
}

// UserEntryWithPassword is part of the PlaintextStorage interface
func (asl *AuthServerClientCert) UserEntryWithPassword(userCerts []*x509.Certificate, user string, password string, remoteAddr net.Addr) (Getter, error) {
	if len(userCerts) == 0 {
		return nil, fmt.Errorf("no client certs for connection")
	}

	commonName := userCerts[0].Subject.CommonName

	if user != commonName {
		return nil, fmt.Errorf("MySQL connection username '%v' does not match client cert common name '%v'", user, commonName)
	}

	return &StaticUserData{
		username: commonName,
		groups:   userCerts[0].DNSNames,
	}, nil
}
