// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

package sqlite3

import (
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
)

// This file provides several different implementations for the
// default embedded sqlite_crypt function.
// This function is uses a caesar-cypher by default
// and is used within the UserAuthentication module to encode
// the password.
//
// The provided functions can be used as an overload to the sqlite_crypt
// function through the use of the RegisterFunc on the connection.
//
// Because the functions can serv a purpose to an end-user
// without using the UserAuthentication module
// the functions are default compiled in.
//
// From SQLITE3 - user-auth.txt
// The sqlite_user.pw field is encoded by a built-in SQL function
// "sqlite_crypt(X,Y)".  The two arguments are both BLOBs.  The first argument
// is the plaintext password supplied to the sqlite3_user_authenticate()
// interface.  The second argument is the sqlite_user.pw value and is supplied
// so that the function can extract the "salt" used by the password encoder.
// The result of sqlite_crypt(X,Y) is another blob which is the value that
// ends up being stored in sqlite_user.pw.  To verify credentials X supplied
// by the sqlite3_user_authenticate() routine, SQLite runs:
//
//     sqlite_user.pw == sqlite_crypt(X, sqlite_user.pw)
//
// To compute an appropriate sqlite_user.pw value from a new or modified
// password X, sqlite_crypt(X,NULL) is run.  A new random salt is selected
// when the second argument is NULL.
//
// The built-in version of of sqlite_crypt() uses a simple Caesar-cypher
// which prevents passwords from being revealed by searching the raw database
// for ASCII text, but is otherwise trivally broken.  For better password
// security, the database should be encrypted using the SQLite Encryption
// Extension or similar technology.  Or, the application can use the
// sqlite3_create_function() interface to provide an alternative
// implementation of sqlite_crypt() that computes a stronger password hash,
// perhaps using a cryptographic hash function like SHA1.

// CryptEncoderSHA1 encodes a password with SHA1
func CryptEncoderSHA1(pass []byte, hash interface{}) []byte {
	h := sha1.Sum(pass)
	return h[:]
}

// CryptEncoderSSHA1 encodes a password with SHA1 with the
// configured salt.
func CryptEncoderSSHA1(salt string) func(pass []byte, hash interface{}) []byte {
	return func(pass []byte, hash interface{}) []byte {
		s := []byte(salt)
		p := append(pass, s...)
		h := sha1.Sum(p)
		return h[:]
	}
}

// CryptEncoderSHA256 encodes a password with SHA256
func CryptEncoderSHA256(pass []byte, hash interface{}) []byte {
	h := sha256.Sum256(pass)
	return h[:]
}

// CryptEncoderSSHA256 encodes a password with SHA256
// with the configured salt
func CryptEncoderSSHA256(salt string) func(pass []byte, hash interface{}) []byte {
	return func(pass []byte, hash interface{}) []byte {
		s := []byte(salt)
		p := append(pass, s...)
		h := sha256.Sum256(p)
		return h[:]
	}
}

// CryptEncoderSHA384 encodes a password with SHA384
func CryptEncoderSHA384(pass []byte, hash interface{}) []byte {
	h := sha512.Sum384(pass)
	return h[:]
}

// CryptEncoderSSHA384 encodes a password with SHA384
// with the configured salt
func CryptEncoderSSHA384(salt string) func(pass []byte, hash interface{}) []byte {
	return func(pass []byte, hash interface{}) []byte {
		s := []byte(salt)
		p := append(pass, s...)
		h := sha512.Sum384(p)
		return h[:]
	}
}

// CryptEncoderSHA512 encodes a password with SHA512
func CryptEncoderSHA512(pass []byte, hash interface{}) []byte {
	h := sha512.Sum512(pass)
	return h[:]
}

// CryptEncoderSSHA512 encodes a password with SHA512
// with the configured salt
func CryptEncoderSSHA512(salt string) func(pass []byte, hash interface{}) []byte {
	return func(pass []byte, hash interface{}) []byte {
		s := []byte(salt)
		p := append(pass, s...)
		h := sha512.Sum512(p)
		return h[:]
	}
}

// EOF
