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
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/x509"
	"encoding/hex"
	"net"
	"strings"

	"github.com/dolthub/vitess/go/vt/log"
	"github.com/dolthub/vitess/go/vt/proto/vtrpc"
	"github.com/dolthub/vitess/go/vt/vterrors"
)

// AuthServer is the interface that servers must implement to validate
// users and passwords. It needs to be able to return a list of AuthMethod
// interfaces which implement the supported auth methods for the server.
type AuthServer interface {
	// AuthMethods returns a list of auth methods that are part of this
	// interface. Building an authentication server usually means
	// creating AuthMethod instances with the known helpers for the
	// currently supported AuthMethod implementations.
	//
	// When a client connects, the server checks the list of auth methods
	// available. If an auth method for the requested auth mechanism by the
	// client is available, it will be used immediately.
	//
	// If there is no overlap between the provided auth methods and
	// the one the client requests, the server will send back an
	// auth switch request using the first provided AuthMethod in this list.
	AuthMethods() []AuthMethod

	// DefaultAuthMethodDescription returns the auth method name that this auth x
	// DefaultAuthMethodDescription the initial server handshake. This must either
	// be `mysql_native_password` or `caching_sha2_password` as those are the only
	// supported auth methods during the initial handshake.
	//
	// It's not needed to also support those methods in the AuthMethods(),
	// in fact, if you want to only support for example clear text passwords,
	// you must still return `mysql_native_password` or `caching_sha2_password`
	// here and the auth switch protocol will be used to switch to clear text.
	DefaultAuthMethodDescription() AuthMethodDescription
}

// AuthMethod interface for concrete auth method implementations.
// When building an auth server, you usually don't implement these yourself
// but the helper methods to build AuthMethod instances should be used.
type AuthMethod interface {
	// Name returns the auth method description for this implementation.
	// This is the name that is sent as the auth plugin name during the
	// Mysql authentication protocol handshake.
	Name() AuthMethodDescription

	// HandleUser verifies if the current auth method can authenticate
	// the given user with the current auth method. This can be useful
	// for example if you only have a plain text of hashed password
	// for specific users and not all users and auth method support
	// depends on what you have.
	HandleUser(conn *Conn, user string) bool

	// AllowClearTextWithoutTLS identifies if an auth method is allowed
	// on a plain text connection. This check is only enforced
	// if the listener has AllowClearTextWithoutTLS() disabled.
	AllowClearTextWithoutTLS() bool

	// AuthPluginData generates the information for the auth plugin.
	// This is included in for example the auth switch request. This
	// is auth plugin specific and opaque to the Mysql handshake
	// protocol.
	AuthPluginData() ([]byte, error)

	// HandleAuthPluginData handles the returned auth plugin data from
	// the client. The original data the server sent is also included
	// which can include things like the salt for `mysql_native_password`.
	//
	// The remote address is provided for plugins that also want to
	// do additional checks like IP based restrictions.
	HandleAuthPluginData(conn *Conn, user string, serverAuthPluginData []byte, clientAuthPluginData []byte, remoteAddr net.Addr) (Getter, error)
}

// UserValidator is an interface that allows checking if a specific
// user will work for an auth method. This interface is called by
// all the default helpers that create AuthMethod instances for
// the various supported Mysql authentication methods.
type UserValidator interface {
	HandleUser(user string, remoteAddr net.Addr) bool
}

// CacheState is a state that is returned by the UserEntryWithCacheHash
// method from the CachingStorage interface. This state is needed to indicate
// whether the authentication is accepted, rejected by the cache itself
// or if the cache can't fullfill the request. In that case it indicates
// that with AuthNeedMoreData.
type CacheState int

const (
	// AuthRejected is used when the cache knows the request can be rejected.
	AuthRejected CacheState = iota
	// AuthAccepted is used when the cache knows the request can be accepted.
	AuthAccepted
	// AuthNeedMoreData is used when the cache doesn't know the answer and more data is needed.
	AuthNeedMoreData
)

// HashStorage describes an object that is suitable to retrieve user information
// based on the hashed authentication response for mysql_native_password.
// In general, an implementation of this would use an internally stored password
// that is hashed twice with SHA1.
// The VerifyHashedMysqlNativePassword helper method can be used to verify
// such a hash based on the salt and auth response provided here after retrieving
// the hashed password from the storage.
type HashStorage interface {
	UserEntryWithHash(userCerts []*x509.Certificate, salt []byte, user string, authResponse []byte, remoteAddr net.Addr) (Getter, error)
}

// PlainTextStorage describes an object that is suitable to retrieve user information
// based on the plain text password of a user. This can be obtained through various
// Mysql authentication methods, such as `mysql_clear_passwrd`, `dialog` or
// `caching_sha2_password` in the full authentication handshake case of the latter.
//
// This mechanism also would allow for picking your own password storage in the backend,
// such as BCrypt, SCrypt, PBKDF2 or Argon2 once the plain text is obtained.
//
// When comparing plain text passwords directly, please ensure to use `subtle.ConstantTimeCompare`
// to prevent timing based attacks on the password.
type PlainTextStorage interface {
	UserEntryWithPassword(userCerts []*x509.Certificate, user string, password string, remoteAddr net.Addr) (Getter, error)
}

// CachingStorage describes an object that is suitable to retrieve user information
// based on a hashed value of the password. This applies to the `caching_sha2_password`
// authentication method.
//
// The cache would hash the password internally as `SHA256(SHA256(password))`.
//
// The VerifyHashedCachingSha2Password helper method can be used to verify
// such a hash based on the salt and auth response provided here after retrieving
// the hashed password from the cache.
type CachingStorage interface {
	UserEntryWithCacheHash(userCerts []*x509.Certificate, salt []byte, user string, authResponse []byte, remoteAddr net.Addr) (Getter, CacheState, error)
}

// NewMysqlNativeAuthMethod will create a new AuthMethod that implements the
// `mysql_native_password` handshake. The caller will need to provide a storage
// object and validator that will be called during the handshake phase.
func NewMysqlNativeAuthMethod(layer HashStorage, validator UserValidator) AuthMethod {
	authMethod := mysqlNativePasswordAuthMethod{
		storage:   layer,
		validator: validator,
	}
	return &authMethod
}

// NewMysqlClearAuthMethod will create a new AuthMethod that implements the
// `mysql_clear_password` handshake. The caller will need to provide a storage
// object for plain text passwords and validator that will be called during the
// handshake phase.
func NewMysqlClearAuthMethod(layer PlainTextStorage, validator UserValidator) AuthMethod {
	authMethod := mysqlClearAuthMethod{
		storage:   layer,
		validator: validator,
	}
	return &authMethod
}

// Constants for the dialog plugin.
const (
	// Default message if no custom message
	// is configured. This is used when the message
	// is the empty string.
	mysqlDialogDefaultMessage = "Enter password: "

	// Dialog plugin is similar to clear text, but can respond to multiple
	// prompts in a row. This is not yet implemented.
	// Follow questions should be prepended with a `cmd` byte:
	// 0x02 - ordinary question
	// 0x03 - last question
	// 0x04 - password question
	// 0x05 - last password
	mysqlDialogAskPassword = 0x04
)

// NewMysqlDialogAuthMethod will create a new AuthMethod that implements the
// `dialog` handshake. The caller will need to provide a storage object for plain
// text passwords and validator that will be called during the handshake phase.
// The message given will be sent as part of the dialog. If the empty string is
// provided, the default message of "Enter password: " will be used.
func NewMysqlDialogAuthMethod(layer PlainTextStorage, validator UserValidator, msg string) AuthMethod {
	if msg == "" {
		msg = mysqlDialogDefaultMessage
	}
	authMethod := mysqlDialogAuthMethod{
		storage:   layer,
		validator: validator,
		msg:       msg,
	}
	return &authMethod
}

// NewSha2CachingAuthMethod will create a new AuthMethod that implements the
// `caching_sha2_password` handshake. The caller will need to provide a cache
// object for the fast auth path and a plain text storage object that will
// be called if the return of the first layer indicates the full auth dance is
// needed.
//
// Right now we only support caching_sha2_password over TLS or a Unix socket.
//
// If TLS is not enabled, the client needs to encrypt it with the public
// key of the server. In that case, Vitess is already configured with
// a certificate anyway, so we recommend to use TLS if you want to use
// caching_sha2_password in that case instead of allowing the plain
// text fallback path here.
//
// This might change in the future if there's a good argument and implementation
// for allowing the plain text path here as well.
func NewSha2CachingAuthMethod(layer1 CachingStorage, layer2 PlainTextStorage, validator UserValidator) AuthMethod {
	authMethod := mysqlCachingSha2AuthMethod{
		cache:     layer1,
		storage:   layer2,
		validator: validator,
	}
	return &authMethod
}

// authServers is a registry of AuthServer implementations.
var authServers = make(map[string]AuthServer)

// RegisterAuthServer registers an implementations of AuthServer.
func RegisterAuthServer(name string, authServer AuthServer) {
	if _, ok := authServers[name]; ok {
		log.Fatalf("AuthServer named %v already exists", name)
	}
	authServers[name] = authServer
}

// GetAuthServer returns an AuthServer by name, or log.Fatalf.
func GetAuthServer(name string) AuthServer {
	authServer, ok := authServers[name]
	if !ok {
		log.Fatalf("no AuthServer name %v registered", name)
	}
	return authServer
}

// NewSalt returns a 20 character salt.
func NewSalt() ([]byte, error) {
	salt := make([]byte, 20)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}

	// Salt must be a legal UTF8 string.
	for i := 0; i < len(salt); i++ {
		salt[i] &= 0x7f
		if salt[i] == '\x00' || salt[i] == '$' {
			salt[i]++
		}
	}

	return salt, nil
}

func negotiateAuthMethod(conn *Conn, as AuthServer, user string, requestedAuth AuthMethodDescription) (AuthMethod, error) {
	for _, m := range as.AuthMethods() {
		if m.Name() == requestedAuth && m.HandleUser(conn, user) {
			return m, nil
		}
	}
	return nil, vterrors.Errorf(vtrpc.Code_INTERNAL, "unknown auth method requested: %s", string(requestedAuth))
}

func readPacketPasswordString(c *Conn) (string, error) {
	// Read a packet, the password is the payload, as a
	// zero terminated string.
	data, err := c.ReadPacket(context.Background())
	if err != nil {
		return "", err
	}
	if len(data) == 0 || data[len(data)-1] != 0 {
		return "", vterrors.Errorf(vtrpc.Code_INTERNAL, "received invalid response packet, datalen=%v", len(data))
	}
	return string(data[:len(data)-1]), nil
}

// ScramblePassword computes the hash of the password using 4.1+ method.
func ScramblePassword(salt, password []byte) []byte {
	if len(password) == 0 {
		return nil
	}

	// stage1Hash = SHA1(password)
	crypt := sha1.New()
	crypt.Write(password)
	stage1 := crypt.Sum(nil)

	// scrambleHash = SHA1(salt + SHA1(stage1Hash))
	// inner Hash
	crypt.Reset()
	crypt.Write(stage1)
	hash := crypt.Sum(nil)
	// outer Hash
	crypt.Reset()
	crypt.Write(salt)
	crypt.Write(hash)
	scramble := crypt.Sum(nil)

	// token = scrambleHash XOR stage1Hash
	for i := range scramble {
		scramble[i] ^= stage1[i]
	}
	return scramble
}

func isPassScrambleMysqlNativePassword(reply, salt []byte, mysqlNativePassword string) bool {
	/*
		SERVER:  recv(reply)
				 hash_stage1=xor(reply, sha1(salt,hash))
				 candidate_hash2=sha1(hash_stage1)
				 check(candidate_hash2==hash)
	*/
	if len(reply) == 0 {
		return false
	}

	if mysqlNativePassword == "" {
		return false
	}

	if strings.Contains(mysqlNativePassword, "*") {
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
		scramble[i] ^= reply[i]
	}
	hashStage1 := scramble

	crypt.Reset()
	crypt.Write(hashStage1)
	candidateHash2 := crypt.Sum(nil)

	return bytes.Equal(candidateHash2, hash)
}

// AuthServerReadPacketString is a helper method to read a packet
// as a null terminated string. It is used by the mysql_clear_password
// and dialog plugins.
func AuthServerReadPacketString(c *Conn) (string, error) {
	// Read a packet, the password is the payload, as a
	// zero terminated string.
	data, err := c.ReadPacket(context.Background())
	if err != nil {
		return "", err
	}
	if len(data) == 0 || data[len(data)-1] != 0 {
		return "", vterrors.Errorf(vtrpc.Code_INTERNAL, "received invalid response packet, datalen=%v", len(data))
	}
	return string(data[:len(data)-1]), nil
}

// AuthServerNegotiateClearOrDialog will finish a negotiation based on
// the method type for the connection. Only supports
// MysqlClearPassword and MysqlDialog.
func AuthServerNegotiateClearOrDialog(c *Conn, method string) (string, error) {
	switch AuthMethodDescription(method) {
	case MysqlClearPassword:
		// The password is the next packet in plain text.
		return AuthServerReadPacketString(c)

	case MysqlDialog:
		return AuthServerReadPacketString(c)

	default:
		return "", vterrors.Errorf(vtrpc.Code_INTERNAL, "unrecognized method: %v", method)
	}
}

// DecodeMysqlNativePasswordHex decodes the standard format used by MySQL
// for 4.1 style password hashes. It drops the optionally leading * before
// decoding the rest as a hex encoded string.
func DecodeMysqlNativePasswordHex(hexEncodedPassword string) ([]byte, error) {
	if hexEncodedPassword[0] == '*' {
		hexEncodedPassword = hexEncodedPassword[1:]
	}
	return hex.DecodeString(hexEncodedPassword)
}

// VerifyHashedMysqlNativePassword verifies a client reply against a stored hash.
//
// This can be used for example inside a `mysql_native_password` plugin implementation
// if the backend storage where the stored password is a SHA1(SHA1(password)).
//
// All values here are non encoded byte slices, so if you store for example the double
// SHA1 of the password as hex encoded characters, you need to decode that first.
// See DecodeMysqlNativePasswordHex for a decoding helper for the standard encoding
// format of this hash used by MySQL.
func VerifyHashedMysqlNativePassword(reply, salt, hashedNativePassword []byte) bool {
	if len(reply) == 0 || len(hashedNativePassword) == 0 {
		return false
	}

	// scramble = SHA1(salt+hash)
	crypt := sha1.New()
	crypt.Write(salt)
	crypt.Write(hashedNativePassword)
	scramble := crypt.Sum(nil)
	for i := range scramble {
		scramble[i] ^= reply[i]
	}
	hashStage1 := scramble
	crypt.Reset()
	crypt.Write(hashStage1)
	candidateHash2 := crypt.Sum(nil)
	return subtle.ConstantTimeCompare(candidateHash2, hashedNativePassword) == 1
}

// VerifyHashedCachingSha2Password verifies a client reply against a stored hash.
//
// This can be used for example inside a `caching_sha2_password` plugin implementation
// if the cache storage uses password keys with SHA256(SHA256(password)).
//
// All values here are non encoded byte slices, so if you store for example the double
// SHA256 of the password as hex encoded characters, you need to decode that first.
func VerifyHashedCachingSha2Password(reply, salt, hashedCachingSha2Password []byte) bool {
	if len(reply) == 0 || len(hashedCachingSha2Password) == 0 {
		return false
	}

	crypt := sha256.New()
	crypt.Write(hashedCachingSha2Password)
	crypt.Write(salt)
	scramble := crypt.Sum(nil)

	// token = scramble XOR stage1Hash
	for i := range scramble {
		scramble[i] ^= reply[i]
	}
	hashStage1 := scramble

	crypt.Reset()
	crypt.Write(hashStage1)
	candidateHash2 := crypt.Sum(nil)
	return subtle.ConstantTimeCompare(candidateHash2, hashedCachingSha2Password) == 1
}

type mysqlNativePasswordAuthMethod struct {
	storage   HashStorage
	validator UserValidator
}

func (n *mysqlNativePasswordAuthMethod) Name() AuthMethodDescription {
	return MysqlNativePassword
}

func (n *mysqlNativePasswordAuthMethod) HandleUser(conn *Conn, user string) bool {
	return n.validator.HandleUser(user, conn.RemoteAddr())
}

func (n *mysqlNativePasswordAuthMethod) AuthPluginData() ([]byte, error) {
	salt, err := NewSalt()
	if err != nil {
		return nil, err
	}
	return append(salt, 0), nil
}

func (n *mysqlNativePasswordAuthMethod) AllowClearTextWithoutTLS() bool {
	return true
}

func (n *mysqlNativePasswordAuthMethod) HandleAuthPluginData(conn *Conn, user string, serverAuthPluginData []byte, clientAuthPluginData []byte, remoteAddr net.Addr) (Getter, error) {
	if serverAuthPluginData[len(serverAuthPluginData)-1] != 0x00 {
		return nil, NewSQLError(ERAccessDeniedError, SSAccessDeniedError, "Access denied for user '%v'", user)
	}
	salt := serverAuthPluginData[:len(serverAuthPluginData)-1]
	return n.storage.UserEntryWithHash(conn.GetTLSClientCerts(), salt, user, clientAuthPluginData, remoteAddr)
}

type mysqlClearAuthMethod struct {
	storage   PlainTextStorage
	validator UserValidator
}

func (n *mysqlClearAuthMethod) Name() AuthMethodDescription {
	return MysqlClearPassword
}
func (n *mysqlClearAuthMethod) HandleUser(conn *Conn, user string) bool {
	return n.validator.HandleUser(user, conn.RemoteAddr())
}
func (n *mysqlClearAuthMethod) AuthPluginData() ([]byte, error) {
	return nil, nil
}
func (n *mysqlClearAuthMethod) AllowClearTextWithoutTLS() bool {
	return false
}
func (n *mysqlClearAuthMethod) HandleAuthPluginData(conn *Conn, user string, serverAuthPluginData []byte, clientAuthPluginData []byte, remoteAddr net.Addr) (Getter, error) {
	password := ""
	if len(clientAuthPluginData) > 0 {
		password = string(clientAuthPluginData[:len(clientAuthPluginData)-1])
	}
	return n.storage.UserEntryWithPassword(conn.GetTLSClientCerts(), user, password, remoteAddr)
}

type mysqlDialogAuthMethod struct {
	storage   PlainTextStorage
	validator UserValidator
	msg       string
}

func (n *mysqlDialogAuthMethod) Name() AuthMethodDescription {
	return MysqlDialog
}
func (n *mysqlDialogAuthMethod) HandleUser(conn *Conn, user string) bool {
	return n.validator.HandleUser(user, conn.RemoteAddr())
}
func (n *mysqlDialogAuthMethod) AllowClearTextWithoutTLS() bool {
	return false
}
func (n *mysqlDialogAuthMethod) AuthPluginData() ([]byte, error) {
	result := make([]byte, len(n.msg)+2)
	result[0] = mysqlDialogAskPassword
	writeNullString(result, 1, n.msg)
	return result, nil
}
func (n *mysqlDialogAuthMethod) HandleAuthPluginData(conn *Conn, user string, serverAuthPluginData []byte, clientAuthPluginData []byte, remoteAddr net.Addr) (Getter, error) {
	return n.storage.UserEntryWithPassword(conn.GetTLSClientCerts(), user, string(clientAuthPluginData[:len(clientAuthPluginData)-1]), remoteAddr)
}

type mysqlCachingSha2AuthMethod struct {
	cache     CachingStorage
	storage   PlainTextStorage
	validator UserValidator
}

func (n *mysqlCachingSha2AuthMethod) Name() AuthMethodDescription {
	return CachingSha2Password
}

func (n *mysqlCachingSha2AuthMethod) HandleUser(conn *Conn, user string) bool {
	if !conn.TLSEnabled() && !conn.IsUnixSocket() {
		return false
	}
	return n.validator.HandleUser(user, conn.RemoteAddr())
}

func (n *mysqlCachingSha2AuthMethod) AllowClearTextWithoutTLS() bool {
	return true
}

func (n *mysqlCachingSha2AuthMethod) AuthPluginData() ([]byte, error) {
	salt, err := NewSalt()
	if err != nil {
		return nil, err
	}
	return append(salt, 0), nil
}

func (n *mysqlCachingSha2AuthMethod) HandleAuthPluginData(c *Conn, user string, serverAuthPluginData []byte, clientAuthPluginData []byte, remoteAddr net.Addr) (Getter, error) {
	if serverAuthPluginData[len(serverAuthPluginData)-1] != 0x00 {
		return nil, NewSQLError(ERAccessDeniedError, SSAccessDeniedError, "Access denied for user '%v'", user)
	}
	salt := serverAuthPluginData[:len(serverAuthPluginData)-1]
	result, cacheState, err := n.cache.UserEntryWithCacheHash(c.GetTLSClientCerts(), salt, user, clientAuthPluginData, remoteAddr)
	if err != nil {
		return nil, err
	}
	if cacheState == AuthRejected {
		return nil, NewSQLError(ERAccessDeniedError, SSAccessDeniedError, "Access denied for user '%v'", user)
	}
	// If we get a result back from the cache that's valid, we have successfully authenticated
	if cacheState == AuthAccepted {
		// If the client hasn't sent any authentication data (i.e. a scrambled password), then don't send
		// the CachingSha2FastAuth packet, since clients don't expect it and error with "Malformed packet"
		emptyClientAuthResponse := len(clientAuthPluginData) == 0 || (len(clientAuthPluginData) == 1 && clientAuthPluginData[0] == 0)
		if !emptyClientAuthResponse {
			// Otherwise, we need to write a more data packet to indicate the
			// handshake completed properly. This will be followed
			// by a regular OK packet which the caller of this method will send.
			data := c.startEphemeralPacket(2)
			pos := 0
			pos = writeByte(data, pos, AuthMoreDataPacket)
			_ = writeByte(data, pos, CachingSha2FastAuth)
			err = c.writeEphemeralPacket()
			if err != nil {
				return nil, err
			}
		}
		return result, nil
	}
	if !c.TLSEnabled() && !c.IsUnixSocket() {
		return nil, NewSQLError(ERAccessDeniedError, SSAccessDeniedError,
			"Access denied for user '%v' (not using TLS or Unix socket)", user)
	}

	data := c.startEphemeralPacket(2)
	pos := 0
	pos = writeByte(data, pos, AuthMoreDataPacket)
	writeByte(data, pos, CachingSha2FullAuth)
	if err = c.writeEphemeralPacket(); err != nil {
		return nil, err
	}

	password, err := readPacketPasswordString(c)
	if err != nil {
		return nil, err
	}
	return n.storage.UserEntryWithPassword(c.GetTLSClientCerts(), user, password, remoteAddr)
}

// ScrambleMysqlNativePassword computes the hash of the password using 4.1+ method.
//
// This can be used for example inside a `mysql_native_password` plugin implementation
// if the backend storage implements storage of plain text passwords.
func ScrambleMysqlNativePassword(salt, password []byte) []byte {
	if len(password) == 0 {
		return nil
	}

	// stage1Hash = SHA1(password)
	crypt := sha1.New()
	crypt.Write(password)
	stage1 := crypt.Sum(nil)

	// scrambleHash = SHA1(salt + SHA1(stage1Hash))
	// inner Hash
	crypt.Reset()
	crypt.Write(stage1)
	hash := crypt.Sum(nil)
	// outer Hash
	crypt.Reset()
	crypt.Write(salt)
	crypt.Write(hash)
	scramble := crypt.Sum(nil)

	// token = scrambleHash XOR stage1Hash
	for i := range scramble {
		scramble[i] ^= stage1[i]
	}
	return scramble
}

// ScrambleCachingSha2Password computes the hash of the password using SHA256 as required by
// caching_sha2_password plugin for "fast" authentication
func ScrambleCachingSha2Password(salt []byte, password []byte) []byte {
	if len(password) == 0 {
		return nil
	}

	// stage1Hash = SHA256(password)
	crypt := sha256.New()
	crypt.Write(password)
	stage1 := crypt.Sum(nil)

	// scrambleHash = SHA256(SHA256(stage1Hash) + salt)
	crypt.Reset()
	crypt.Write(stage1)
	innerHash := crypt.Sum(nil)

	crypt.Reset()
	crypt.Write(innerHash)
	crypt.Write(salt)
	scramble := crypt.Sum(nil)

	// token = stage1Hash XOR scrambleHash
	for i := range stage1 {
		stage1[i] ^= scramble[i]
	}

	return stage1
}

// EncryptPasswordWithPublicKey obfuscates the password and encrypts it with server's public key as required by
// caching_sha2_password plugin for "full" authentication
func EncryptPasswordWithPublicKey(salt []byte, password []byte, pub *rsa.PublicKey) ([]byte, error) {
	if len(password) == 0 {
		return nil, nil
	}

	buffer := make([]byte, len(password)+1)
	copy(buffer, password)
	for i := range buffer {
		buffer[i] ^= salt[i%len(salt)]
	}

	sha1Hash := sha1.New()
	enc, err := rsa.EncryptOAEP(sha1Hash, rand.Reader, pub, buffer, nil)
	if err != nil {
		return nil, err
	}

	return enc, nil
}
