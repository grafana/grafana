// +build !windows

package mssql

import (
	"crypto/des"
	"crypto/md5"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"strings"
	"unicode/utf16"

	"golang.org/x/crypto/md4"
)

const (
	_NEGOTIATE_MESSAGE    = 1
	_CHALLENGE_MESSAGE    = 2
	_AUTHENTICATE_MESSAGE = 3
)

const (
	_NEGOTIATE_UNICODE                  = 0x00000001
	_NEGOTIATE_OEM                      = 0x00000002
	_NEGOTIATE_TARGET                   = 0x00000004
	_NEGOTIATE_SIGN                     = 0x00000010
	_NEGOTIATE_SEAL                     = 0x00000020
	_NEGOTIATE_DATAGRAM                 = 0x00000040
	_NEGOTIATE_LMKEY                    = 0x00000080
	_NEGOTIATE_NTLM                     = 0x00000200
	_NEGOTIATE_ANONYMOUS                = 0x00000800
	_NEGOTIATE_OEM_DOMAIN_SUPPLIED      = 0x00001000
	_NEGOTIATE_OEM_WORKSTATION_SUPPLIED = 0x00002000
	_NEGOTIATE_ALWAYS_SIGN              = 0x00008000
	_NEGOTIATE_TARGET_TYPE_DOMAIN       = 0x00010000
	_NEGOTIATE_TARGET_TYPE_SERVER       = 0x00020000
	_NEGOTIATE_EXTENDED_SESSIONSECURITY = 0x00080000
	_NEGOTIATE_IDENTIFY                 = 0x00100000
	_REQUEST_NON_NT_SESSION_KEY         = 0x00400000
	_NEGOTIATE_TARGET_INFO              = 0x00800000
	_NEGOTIATE_VERSION                  = 0x02000000
	_NEGOTIATE_128                      = 0x20000000
	_NEGOTIATE_KEY_EXCH                 = 0x40000000
	_NEGOTIATE_56                       = 0x80000000
)

const _NEGOTIATE_FLAGS = _NEGOTIATE_UNICODE |
	_NEGOTIATE_NTLM |
	_NEGOTIATE_OEM_DOMAIN_SUPPLIED |
	_NEGOTIATE_OEM_WORKSTATION_SUPPLIED |
	_NEGOTIATE_ALWAYS_SIGN |
	_NEGOTIATE_EXTENDED_SESSIONSECURITY

type ntlmAuth struct {
	Domain      string
	UserName    string
	Password    string
	Workstation string
}

func getAuth(user, password, service, workstation string) (auth, bool) {
	if !strings.ContainsRune(user, '\\') {
		return nil, false
	}
	domain_user := strings.SplitN(user, "\\", 2)
	return &ntlmAuth{
		Domain:      domain_user[0],
		UserName:    domain_user[1],
		Password:    password,
		Workstation: workstation,
	}, true
}

func utf16le(val string) []byte {
	var v []byte
	for _, r := range val {
		if utf16.IsSurrogate(r) {
			r1, r2 := utf16.EncodeRune(r)
			v = append(v, byte(r1), byte(r1>>8))
			v = append(v, byte(r2), byte(r2>>8))
		} else {
			v = append(v, byte(r), byte(r>>8))
		}
	}
	return v
}

func (auth *ntlmAuth) InitialBytes() ([]byte, error) {
	domain_len := len(auth.Domain)
	workstation_len := len(auth.Workstation)
	msg := make([]byte, 40+domain_len+workstation_len)
	copy(msg, []byte("NTLMSSP\x00"))
	binary.LittleEndian.PutUint32(msg[8:], _NEGOTIATE_MESSAGE)
	binary.LittleEndian.PutUint32(msg[12:], _NEGOTIATE_FLAGS)
	// Domain Name Fields
	binary.LittleEndian.PutUint16(msg[16:], uint16(domain_len))
	binary.LittleEndian.PutUint16(msg[18:], uint16(domain_len))
	binary.LittleEndian.PutUint32(msg[20:], 40)
	// Workstation Fields
	binary.LittleEndian.PutUint16(msg[24:], uint16(workstation_len))
	binary.LittleEndian.PutUint16(msg[26:], uint16(workstation_len))
	binary.LittleEndian.PutUint32(msg[28:], uint32(40+domain_len))
	// Version
	binary.LittleEndian.PutUint32(msg[32:], 0)
	binary.LittleEndian.PutUint32(msg[36:], 0)
	// Payload
	copy(msg[40:], auth.Domain)
	copy(msg[40+domain_len:], auth.Workstation)
	return msg, nil
}

var errorNTLM = errors.New("NTLM protocol error")

func createDesKey(bytes, material []byte) {
	material[0] = bytes[0]
	material[1] = (byte)(bytes[0]<<7 | (bytes[1]&0xff)>>1)
	material[2] = (byte)(bytes[1]<<6 | (bytes[2]&0xff)>>2)
	material[3] = (byte)(bytes[2]<<5 | (bytes[3]&0xff)>>3)
	material[4] = (byte)(bytes[3]<<4 | (bytes[4]&0xff)>>4)
	material[5] = (byte)(bytes[4]<<3 | (bytes[5]&0xff)>>5)
	material[6] = (byte)(bytes[5]<<2 | (bytes[6]&0xff)>>6)
	material[7] = (byte)(bytes[6] << 1)
}

func oddParity(bytes []byte) {
	for i := 0; i < len(bytes); i++ {
		b := bytes[i]
		needsParity := (((b >> 7) ^ (b >> 6) ^ (b >> 5) ^ (b >> 4) ^ (b >> 3) ^ (b >> 2) ^ (b >> 1)) & 0x01) == 0
		if needsParity {
			bytes[i] = bytes[i] | byte(0x01)
		} else {
			bytes[i] = bytes[i] & byte(0xfe)
		}
	}
}

func encryptDes(key []byte, cleartext []byte, ciphertext []byte) {
	var desKey [8]byte
	createDesKey(key, desKey[:])
	cipher, err := des.NewCipher(desKey[:])
	if err != nil {
		panic(err)
	}
	cipher.Encrypt(ciphertext, cleartext)
}

func response(challenge [8]byte, hash [21]byte) (ret [24]byte) {
	encryptDes(hash[:7], challenge[:], ret[:8])
	encryptDes(hash[7:14], challenge[:], ret[8:16])
	encryptDes(hash[14:], challenge[:], ret[16:])
	return
}

func lmHash(password string) (hash [21]byte) {
	var lmpass [14]byte
	copy(lmpass[:14], []byte(strings.ToUpper(password)))
	magic := []byte("KGS!@#$%")
	encryptDes(lmpass[:7], magic, hash[:8])
	encryptDes(lmpass[7:], magic, hash[8:])
	return
}

func lmResponse(challenge [8]byte, password string) [24]byte {
	hash := lmHash(password)
	return response(challenge, hash)
}

func ntlmHash(password string) (hash [21]byte) {
	h := md4.New()
	h.Write(utf16le(password))
	h.Sum(hash[:0])
	return
}

func ntResponse(challenge [8]byte, password string) [24]byte {
	hash := ntlmHash(password)
	return response(challenge, hash)
}

func clientChallenge() (nonce [8]byte) {
	_, err := rand.Read(nonce[:])
	if err != nil {
		panic(err)
	}
	return
}

func ntlmSessionResponse(clientNonce [8]byte, serverChallenge [8]byte, password string) [24]byte {
	var sessionHash [16]byte
	h := md5.New()
	h.Write(serverChallenge[:])
	h.Write(clientNonce[:])
	h.Sum(sessionHash[:0])
	var hash [8]byte
	copy(hash[:], sessionHash[:8])
	passwordHash := ntlmHash(password)
	return response(hash, passwordHash)
}

func (auth *ntlmAuth) NextBytes(bytes []byte) ([]byte, error) {
	if string(bytes[0:8]) != "NTLMSSP\x00" {
		return nil, errorNTLM
	}
	if binary.LittleEndian.Uint32(bytes[8:12]) != _CHALLENGE_MESSAGE {
		return nil, errorNTLM
	}
	flags := binary.LittleEndian.Uint32(bytes[20:24])
	var challenge [8]byte
	copy(challenge[:], bytes[24:32])

	var lm, nt []byte
	if (flags & _NEGOTIATE_EXTENDED_SESSIONSECURITY) != 0 {
		nonce := clientChallenge()
		var lm_bytes [24]byte
		copy(lm_bytes[:8], nonce[:])
		lm = lm_bytes[:]
		nt_bytes := ntlmSessionResponse(nonce, challenge, auth.Password)
		nt = nt_bytes[:]
	} else {
		lm_bytes := lmResponse(challenge, auth.Password)
		lm = lm_bytes[:]
		nt_bytes := ntResponse(challenge, auth.Password)
		nt = nt_bytes[:]
	}
	lm_len := len(lm)
	nt_len := len(nt)

	domain16 := utf16le(auth.Domain)
	domain_len := len(domain16)
	user16 := utf16le(auth.UserName)
	user_len := len(user16)
	workstation16 := utf16le(auth.Workstation)
	workstation_len := len(workstation16)

	msg := make([]byte, 88+lm_len+nt_len+domain_len+user_len+workstation_len)
	copy(msg, []byte("NTLMSSP\x00"))
	binary.LittleEndian.PutUint32(msg[8:], _AUTHENTICATE_MESSAGE)
	// Lm Challenge Response Fields
	binary.LittleEndian.PutUint16(msg[12:], uint16(lm_len))
	binary.LittleEndian.PutUint16(msg[14:], uint16(lm_len))
	binary.LittleEndian.PutUint32(msg[16:], 88)
	// Nt Challenge Response Fields
	binary.LittleEndian.PutUint16(msg[20:], uint16(nt_len))
	binary.LittleEndian.PutUint16(msg[22:], uint16(nt_len))
	binary.LittleEndian.PutUint32(msg[24:], uint32(88+lm_len))
	// Domain Name Fields
	binary.LittleEndian.PutUint16(msg[28:], uint16(domain_len))
	binary.LittleEndian.PutUint16(msg[30:], uint16(domain_len))
	binary.LittleEndian.PutUint32(msg[32:], uint32(88+lm_len+nt_len))
	// User Name Fields
	binary.LittleEndian.PutUint16(msg[36:], uint16(user_len))
	binary.LittleEndian.PutUint16(msg[38:], uint16(user_len))
	binary.LittleEndian.PutUint32(msg[40:], uint32(88+lm_len+nt_len+domain_len))
	// Workstation Fields
	binary.LittleEndian.PutUint16(msg[44:], uint16(workstation_len))
	binary.LittleEndian.PutUint16(msg[46:], uint16(workstation_len))
	binary.LittleEndian.PutUint32(msg[48:], uint32(88+lm_len+nt_len+domain_len+user_len))
	// Encrypted Random Session Key Fields
	binary.LittleEndian.PutUint16(msg[52:], 0)
	binary.LittleEndian.PutUint16(msg[54:], 0)
	binary.LittleEndian.PutUint32(msg[56:], uint32(88+lm_len+nt_len+domain_len+user_len+workstation_len))
	// Negotiate Flags
	binary.LittleEndian.PutUint32(msg[60:], flags)
	// Version
	binary.LittleEndian.PutUint32(msg[64:], 0)
	binary.LittleEndian.PutUint32(msg[68:], 0)
	// MIC
	binary.LittleEndian.PutUint32(msg[72:], 0)
	binary.LittleEndian.PutUint32(msg[76:], 0)
	binary.LittleEndian.PutUint32(msg[88:], 0)
	binary.LittleEndian.PutUint32(msg[84:], 0)
	// Payload
	copy(msg[88:], lm)
	copy(msg[88+lm_len:], nt)
	copy(msg[88+lm_len+nt_len:], domain16)
	copy(msg[88+lm_len+nt_len+domain_len:], user16)
	copy(msg[88+lm_len+nt_len+domain_len+user_len:], workstation16)
	return msg, nil
}

func (auth *ntlmAuth) Free() {
}
