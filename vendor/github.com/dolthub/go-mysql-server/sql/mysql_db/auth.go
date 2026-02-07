// Copyright 2024 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package mysql_db

import (
	"bytes"
	"crypto/sha1"
	"crypto/x509"
	"encoding/hex"
	"net"

	"github.com/dolthub/vitess/go/mysql"
	"github.com/sirupsen/logrus"

	"github.com/dolthub/go-mysql-server/sql"
)

// DefaultAuthMethod specifies the MySQL auth protocol (e.g. mysql_native_password,
// caching_sha2_password) that is used by default. When the auth server advertises
// what auth protocol it prefers, as part of the auth handshake, it is controlled
// by this constant. When a new user is created, if no auth plugin is specified, this
// auth method will be used.
const DefaultAuthMethod = mysql.MysqlNativePassword

// authServer implements the mysql.AuthServer interface. It exposes configured AuthMethod implementations
// that the auth framework in Vitess uses to negotiate authentication with a client. By default, authServer
// configures support for the mysql_native_password auth plugin, as well as an extensible auth method, built
// on the mysql_clear_password plugin, that integrators can use to provide extended authentication options,
// through the use of registering PlaintextAuthPlugins with MySQLDb.
type authServer struct {
	authMethods []mysql.AuthMethod
}

var _ mysql.AuthServer = (*authServer)(nil)

// newAuthServer creates a new instance of an authServer, configured with auth method implementations supporting
// mysql_native_password support, as well as an extensible auth method, built on the mysql_clear_password auth
// method, that allows integrators to extend authentication to allow additional schemes.
func newAuthServer(db *MySQLDb) *authServer {
	// mysql_native_password auth support
	nativePasswordAuthMethod := mysql.NewMysqlNativeAuthMethod(
		&nativePasswordHashStorage{db: db},
		newUserValidator(db, mysql.MysqlNativePassword))

	// caching_sha2_password auth support
	cachingSha2PasswordAuthMethod := mysql.NewSha2CachingAuthMethod(
		&noopCachingStorage{db: db},
		&sha2PlainTextStorage{db: db},
		newUserValidator(db, mysql.CachingSha2Password))

	// The extended auth method allows for integrators to register their own PlaintextAuthPlugin implementations,
	// and uses the MySQL clear auth method to send the auth information from the client to the server.
	extendedAuthMethod := mysql.NewMysqlClearAuthMethod(
		&extendedAuthPlainTextStorage{db: db},
		&extendedAuthUserValidator{db: db})

	return &authServer{
		authMethods: []mysql.AuthMethod{
			nativePasswordAuthMethod,
			cachingSha2PasswordAuthMethod,
			extendedAuthMethod,
		},
	}
}

// AuthMethods implements the mysql.AuthServer interface.
func (as *authServer) AuthMethods() []mysql.AuthMethod {
	return as.authMethods
}

// DefaultAuthMethodDescription implements the mysql.AuthServer interface.
func (db *authServer) DefaultAuthMethodDescription() mysql.AuthMethodDescription {
	return DefaultAuthMethod
}

// noopCachingStorage is a simple implementation of mysql.CachingStorage that doesn't actually
// use a cache yet. Eventually this will be replaced with a real authentication info cache, but
// for the initial implementation there is no caching supported. This means that repeated
// authentication for the same user will take longer to complete, since the full auth process
// needs to be performed each time. Implementing auth caching will optimize repeated logins for users.
type noopCachingStorage struct {
	db *MySQLDb
}

var _ mysql.CachingStorage = (*noopCachingStorage)(nil)

// UserEntryWithCacheHash implements the mysql.CachingStorage interface. This method gets called by
// Vitess' cachingSha2Password auth method implementation during the initial/fast auth portion of
// caching_sha2_password authentication. The client sends a scrambled password over the wire and
// this method looks for a matching cached scrambled password for the specified user. If a matching
// scrambled password is found, then the server responds back to the client with an auth success
// message. If no match is found, the server responds with a more auth data needed message and the
// client then ensures a TLS connection is present and sends the password in plaintext for the
// server to validate using the more secure, but slower, full auth process. See the implementation
// in sha2PlainTextStorage for more details.
//
// This implementation also handles authentication when a client doesn't send an auth response and
// the associated user account does not have a password set.
func (n noopCachingStorage) UserEntryWithCacheHash(_ []*x509.Certificate, _ []byte, user string, authResponse []byte, remoteAddr net.Addr) (mysql.Getter, mysql.CacheState, error) {
	db := n.db

	// If there is no mysql database of user info, then don't approve or reject, since we can't look at
	// user data to validate; just ask for more data
	if !db.Enabled() {
		return nil, mysql.AuthNeedMoreData, nil
	}

	// If we have a user database and the client didn't send an auth response, then check to see if this user
	// account has no password configured. If there is no password, then we can go ahead and accept the request
	// without having to do the full auth process.
	emptyClientAuthResponse := len(authResponse) == 0 || (len(authResponse) == 1 && authResponse[0] == 0)
	if emptyClientAuthResponse {
		host, err := extractHostAddress(remoteAddr)
		if err != nil {
			return nil, mysql.AuthRejected, err
		}

		rd := db.Reader()
		defer rd.Close()

		userEntry := db.GetUser(rd, user, host, false)
		if userEntry == nil || userEntry.Locked {
			return nil, mysql.AuthRejected, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
		}

		if userEntry.AuthString == "" {
			return sql.MysqlConnectionUser{User: user, Host: host}, mysql.AuthAccepted, nil
		} else {
			return nil, mysql.AuthRejected, nil
		}
	}

	// TODO: Add auth caching as an optimization. The full auth process is fairly expensive since
	//       it involves an additional network roundtrip and many rounds of hashing. Instead, we
	//       can store a less secure (hashed only twice) version of the password in memory once a
	//       user has successfully logged in once with the full auth process, and then compare the
	//       password with that hash on future logins.
	//
	//       The only trick to this optimization is that we must ensure a user who logs and gets
	//       their password cached, cannot change their password and then still login with the old
	//       password. This means invalidating the cache entry when a user changes their password.

	return nil, mysql.AuthNeedMoreData, nil
}

// sha2PlainTextStorage implements the mysql.PlainTextStorage interface for the caching_sha2_password
// authentication protocol. This type is responsible for looking up a user entry in the mysql database
// (|db|) and hashing a plaintext password to compare against the user entry's authentication string
// to determine if a user login is valid.
type sha2PlainTextStorage struct {
	db *MySQLDb
}

var _ mysql.PlainTextStorage = (*sha2PlainTextStorage)(nil)

// UserEntryWithPassword implements the mysql.PlainTextStorage interface.
// The auth framework in Vitess also passes in user certificates, but we don't support that feature yet.
func (s sha2PlainTextStorage) UserEntryWithPassword(_ []*x509.Certificate, user string, password string, remoteAddr net.Addr) (mysql.Getter, error) {
	db := s.db

	host, err := extractHostAddress(remoteAddr)
	if err != nil {
		return nil, err
	}

	if !db.Enabled() {
		return sql.MysqlConnectionUser{User: user, Host: host}, nil
	}

	rd := db.Reader()
	defer rd.Close()

	userEntry := db.GetUser(rd, user, host, false)
	if userEntry == nil || userEntry.Locked {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
	}

	if len(userEntry.AuthString) > 0 {
		digestType, iterations, salt, _, err := mysql.DeserializeCachingSha2PasswordAuthString([]byte(userEntry.AuthString))
		if err != nil {
			return nil, err
		}
		if digestType != "SHA256" {
			return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError,
				"Access denied for user '%v': unsupported digest type: %s", user, digestType)
		}

		authString, err := mysql.SerializeCachingSha2PasswordAuthString(password, salt, iterations)
		if err != nil {
			return nil, err
		}

		if userEntry.AuthString != string(authString) {
			return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
		}
	} else if len(password) > 0 {
		// password is nil or empty, therefore no password is set
		// a password was given and the account has no password set, therefore access is denied
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
	}

	return sql.MysqlConnectionUser{User: userEntry.User, Host: userEntry.Host}, nil
}

// extendedAuthPlainTextStorage implements the mysql.PlainTextStorage interface and plugs into
// the MySQL clear password auth method in order to allow extension auth mechanisms to be used.
// Integrators can register their own PlaintextAuthPlugin through the MySQLDb::SetPlugins method,
// then if a user account's plugin is set to the registerd plugin, this PlainTextStorage, the
// registered PlaintextAuthPlugin will be used to authenticate the user. This class serves as
// a bridge between the MySQL clear password auth method implementation in Vitess, the user
// account data stored in the MySQLDb, and custom PlaintextAuthPlugin implementations.
type extendedAuthPlainTextStorage struct {
	db *MySQLDb
}

var _ mysql.PlainTextStorage = (*extendedAuthPlainTextStorage)(nil)

// UserEntryWithPassword implements the mysql.PlainTextStorage interface. This method is called by the
// MySQL clear password auth method to authenticate a user with a custom PlaintextAuthPlugin that was
// previously registered with the MySQLDb instance.
func (f extendedAuthPlainTextStorage) UserEntryWithPassword(userCerts []*x509.Certificate, user string, password string, remoteAddr net.Addr) (mysql.Getter, error) {
	db := f.db

	host, err := extractHostAddress(remoteAddr)
	if err != nil {
		return nil, err
	}

	connUser := sql.MysqlConnectionUser{User: user, Host: host}
	if !db.Enabled() {
		return connUser, nil
	}

	rd := db.Reader()
	defer rd.Close()

	userEntry := db.GetUser(rd, user, host, false)
	if userEntry == nil {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError,
			"Access denied for user '%v': no known user", user)
	}

	authPluginName := userEntry.Plugin
	if authPluginName == "" {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError,
			"Access denied for user '%v': no auth plugin specified", user)
	}

	authplugin, ok := db.plugins[authPluginName]
	if !ok {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError,
			"Access denied for user '%v'; auth plugin %s not registered with server", user, authPluginName)
	}

	authed, err := authplugin.Authenticate(db, user, userEntry, password)
	if err != nil {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError,
			"Access denied for user '%v': %v", user, err)
	}
	if !authed {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError,
			"Access denied for user '%v'", user)
	}
	return connUser, nil
}

// extendedAuthUserValidator implements the mysql.UserValidator interface and plugs into the MySQL clear password
// auth method.
type extendedAuthUserValidator struct {
	db *MySQLDb
}

var _ mysql.UserValidator = (*extendedAuthUserValidator)(nil)

// HandleUser implements the mysql.UserValidator interface.
func (uv extendedAuthUserValidator) HandleUser(user string, remoteAddr net.Addr) bool {
	// If the mysql database is not enabled, then we don't have user information, so
	// go ahead and return true without trying to look up the user in the db.
	if !uv.db.Enabled() {
		return true
	}

	host, err := extractHostAddress(remoteAddr)
	if err != nil {
		logrus.Warnf("error extracting host address: %v", err)
		return false
	}

	db := uv.db
	rd := db.Reader()
	defer rd.Close()

	if !db.Enabled() {
		return true
	}
	userEntry := db.GetUser(rd, user, host, false)
	if userEntry == nil {
		return false
	}

	for pluginName, _ := range db.plugins {
		if userEntry.Plugin == pluginName {
			return true
		}
	}

	return false
}

// nativePasswordHashStorage implements the mysql.HashStorage interface and plugs into the mysql_native_password
// auth protocol. It is responsible for looking up a user in the MySQL database and validating a password hash
// against the user's stored password hash.
type nativePasswordHashStorage struct {
	db *MySQLDb
}

var _ mysql.HashStorage = (*nativePasswordHashStorage)(nil)

// UserEntryWithHash implements the mysql.HashStorage interface. This implementation is called by the MySQL
// native password auth method to validate a password hash with the user's stored password hash.
func (nphs *nativePasswordHashStorage) UserEntryWithHash(_ []*x509.Certificate, salt []byte, user string, authResponse []byte, remoteAddr net.Addr) (mysql.Getter, error) {
	db := nphs.db

	host, err := extractHostAddress(remoteAddr)
	if err != nil {
		return nil, err
	}

	rd := db.Reader()
	defer rd.Close()

	if !db.Enabled() {
		return sql.MysqlConnectionUser{User: user, Host: host}, nil
	}

	userEntry := db.GetUser(rd, user, host, false)
	if userEntry == nil || userEntry.Locked {
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
	}
	if len(userEntry.AuthString) > 0 {
		if !validateMysqlNativePassword(authResponse, salt, userEntry.AuthString) {
			return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
		}
	} else if len(authResponse) > 0 {
		// password is nil or empty, therefore no password is set
		// a password was given and the account has no password set, therefore access is denied
		return nil, mysql.NewSQLError(mysql.ERAccessDeniedError, mysql.SSAccessDeniedError, "Access denied for user '%v'", user)
	}

	return sql.MysqlConnectionUser{User: userEntry.User, Host: userEntry.Host}, nil
}

// userValidator implements the mysql.UserValidator interface. It looks up a user and host from the
// associated mysql database (|db|) and validates that a user entry exists and that it is configured
// for the specified authentication plugin (|authMethod|).
type userValidator struct {
	// db is the mysql database that contains user information
	db *MySQLDb

	// authMethod is the name of the auth plugin for which this validator will
	// validate users.
	authMethod mysql.AuthMethodDescription
}

var _ mysql.UserValidator = (*userValidator)(nil)

// newUserValidator creates a new userValidator instance, configured to use |db| to look up user
// entries and validate that they have the specified auth plugin (|authMethod|) configured.
func newUserValidator(db *MySQLDb, authMethod mysql.AuthMethodDescription) *userValidator {
	return &userValidator{
		db:         db,
		authMethod: authMethod,
	}
}

// HandleUser implements the mysql.UserValidator interface and verifies if the mysql_native_password auth method
// can be used for the specified |user| at the specified |remoteAddr|.
func (uv *userValidator) HandleUser(user string, remoteAddr net.Addr) bool {
	// If the mysql database is not enabled, then we don't have user information, so
	// go ahead and return true without trying to look up the user in the db.
	if !uv.db.Enabled() {
		return true
	}

	host, err := extractHostAddress(remoteAddr)
	if err != nil {
		logrus.Warnf("error extracting host address: %v", err)
		return false
	}

	db := uv.db
	rd := db.Reader()
	defer rd.Close()

	if !db.Enabled() {
		return true
	}
	userEntry := db.GetUser(rd, user, host, false)

	return userEntry != nil && userEntry.Plugin == string(uv.authMethod)
}

// extractHostAddress extracts the host address from |addr|, checking to see if it is a unix socket, and if
// so, returning "localhost" as the host.
func extractHostAddress(addr net.Addr) (host string, err error) {
	if addr.Network() == "unix" {
		host = "localhost"
	} else {
		host, _, err = net.SplitHostPort(addr.String())
		if err != nil {
			if err.(*net.AddrError).Err == "missing port in address" {
				host = addr.String()
			} else {
				return "", err
			}
		}
	}
	return host, nil
}

// validateMysqlNativePassword was taken from vitess and validates the password hash for the mysql_native_password
// auth protocol. Note that this implementation has diverged slightly from the original code in Vitess.
func validateMysqlNativePassword(authResponse, salt []byte, mysqlNativePassword string) bool {
	// SERVER: recv(authResponse)
	// 		   hash_stage1=xor(authResponse, sha1(salt,hash))
	// 		   candidate_hash2=sha1(hash_stage1)
	// 		   check(candidate_hash2==hash)
	if len(authResponse) == 0 || len(mysqlNativePassword) == 0 {
		return false
	}
	if mysqlNativePassword[0] == '*' {
		mysqlNativePassword = mysqlNativePassword[1:]
	}

	hash, err := hex.DecodeString(mysqlNativePassword)
	if err != nil {
		return false
	}

	// scramble = SHA1(salt+hash)
	crypt := sha1.New()
	crypt.Write(salt)
	crypt.Write(hash)
	scramble := crypt.Sum(nil)

	// token = scramble XOR stage1Hash
	for i := range scramble {
		scramble[i] ^= authResponse[i]
	}
	stage1Hash := scramble
	crypt.Reset()
	crypt.Write(stage1Hash)
	candidateHash2 := crypt.Sum(nil)

	return bytes.Equal(candidateHash2, hash)
}
