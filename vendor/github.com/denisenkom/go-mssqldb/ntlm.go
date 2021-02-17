// +build !windows

package mssql

import (
	"crypto/des"
	"crypto/hmac"
	"crypto/md5"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
	"time"
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

func ntlmHashNoPadding(val string) []byte {
	hash := make([]byte, 16)
	h := md4.New()
	h.Write(utf16le(val))
	h.Sum(hash[:0])

	return hash
}

func hmacMD5(passwordHash, data []byte) []byte {
	hmacEntity := hmac.New(md5.New, passwordHash)
	hmacEntity.Write(data)

	return hmacEntity.Sum(nil)
}

func getNTLMv2AndLMv2ResponsePayloads(userDomain, username, password string, challenge, nonce [8]byte, targetInfoFields []byte, timestamp time.Time) (ntlmV2Payload, lmV2Payload []byte) {
	// NTLMv2 response payload: http://davenport.sourceforge.net/ntlm.html#theNtlmv2Response

	ntlmHash := ntlmHashNoPadding(password)
	usernameAndTargetBytes := utf16le(strings.ToUpper(username) + userDomain)
	ntlmV2Hash := hmacMD5(ntlmHash, usernameAndTargetBytes)
	targetInfoLength := len(targetInfoFields)
	blob := make([]byte, 32+targetInfoLength)
	binary.BigEndian.PutUint32(blob[:4], 0x01010000)
	binary.BigEndian.PutUint32(blob[4:8], 0x00000000)
	binary.BigEndian.PutUint64(blob[8:16], uint64(timestamp.UnixNano()))
	copy(blob[16:24], nonce[:])
	binary.BigEndian.PutUint32(blob[24:28], 0x00000000)
	copy(blob[28:], targetInfoFields)
	binary.BigEndian.PutUint32(blob[28+targetInfoLength:], 0x00000000)
	challengeLength := len(challenge)
	blobLength := len(blob)
	challengeAndBlob := make([]byte, challengeLength+blobLength)
	copy(challengeAndBlob[:challengeLength], challenge[:])
	copy(challengeAndBlob[challengeLength:], blob)
	hashedChallenge := hmacMD5(ntlmV2Hash, challengeAndBlob)
	ntlmV2Payload = append(hashedChallenge, blob...)

	// LMv2 response payload: http://davenport.sourceforge.net/ntlm.html#theLmv2Response
	ntlmV2hash := hmacMD5(ntlmHash, usernameAndTargetBytes)
	challengeAndNonce := make([]byte, 16)
	copy(challengeAndNonce[:8], challenge[:])
	copy(challengeAndNonce[8:], nonce[:])
	hashedChallenge = hmacMD5(ntlmV2hash, challengeAndNonce)
	lmV2Payload = append(hashedChallenge, nonce[:]...)

	return
}

func negotiateExtendedSessionSecurity(flags uint32, message []byte, challenge [8]byte, username, password, userDom string) (lm, nt []byte, err error) {
	nonce := clientChallenge()

	// Official specification: https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-nlmp/b38c36ed-2804-4868-a9ff-8dd3182128e4
	// Unofficial walk through referenced by https://www.freetds.org/userguide/domains.htm: http://davenport.sourceforge.net/ntlm.html
	if (flags & _NEGOTIATE_TARGET_INFO) != 0 {
		targetInfoFields, err := getNTLMv2TargetInfoFields(message)
		if err != nil {
			return lm, nt, err
		}

		nt, lm = getNTLMv2AndLMv2ResponsePayloads(userDom, username, password, challenge, nonce, targetInfoFields, time.Now())

		return lm, nt, nil
	}

	var lm_bytes [24]byte
	copy(lm_bytes[:8], nonce[:])
	lm = lm_bytes[:]
	nt_bytes := ntlmSessionResponse(nonce, challenge, password)
	nt = nt_bytes[:]

	return lm, nt, nil
}

func getNTLMv2TargetInfoFields(type2Message []byte) (info []byte, err error) {
	type2MessageError := "mssql: while parsing NTLMv2 type 2 message, length %d too small for offset %d"
	type2MessageLength := len(type2Message)
	if type2MessageLength < 20 {
		return nil, fmt.Errorf(type2MessageError, type2MessageLength, 20)
	}

	targetNameAllocated := binary.LittleEndian.Uint16(type2Message[14:16])
	targetNameOffset := binary.LittleEndian.Uint32(type2Message[16:20])
	endOfOffset := int(targetNameOffset + uint32(targetNameAllocated))
	if type2MessageLength < endOfOffset {
		return nil, fmt.Errorf(type2MessageError, type2MessageLength, endOfOffset)
	}

	targetInformationAllocated := binary.LittleEndian.Uint16(type2Message[42:44])
	targetInformationDataOffset := binary.LittleEndian.Uint32(type2Message[44:48])
	endOfOffset = int(targetInformationDataOffset + uint32(targetInformationAllocated))
	if type2MessageLength < endOfOffset {
		return nil, fmt.Errorf(type2MessageError, type2MessageLength, endOfOffset)
	}

	targetInformationBytes := make([]byte, targetInformationAllocated)
	copy(targetInformationBytes, type2Message[targetInformationDataOffset:targetInformationDataOffset+uint32(targetInformationAllocated)])

	return targetInformationBytes, nil
}

func buildNTLMResponsePayload(lm, nt []byte, flags uint32, domain, workstation, username string) ([]byte, error) {
	lm_len := len(lm)
	nt_len := len(nt)
	domain16 := utf16le(domain)
	domain_len := len(domain16)
	user16 := utf16le(username)
	user_len := len(user16)
	workstation16 := utf16le(workstation)
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

func (auth *ntlmAuth) NextBytes(bytes []byte) ([]byte, error) {
	signature := string(bytes[0:8])
	if signature != "NTLMSSP\x00" {
		return nil, errorNTLM
	}

	messageTypeIndicator := binary.LittleEndian.Uint32(bytes[8:12])
	if messageTypeIndicator != _CHALLENGE_MESSAGE {
		return nil, errorNTLM
	}

	var challenge [8]byte
	copy(challenge[:], bytes[24:32])
	flags := binary.LittleEndian.Uint32(bytes[20:24])
	if (flags & _NEGOTIATE_EXTENDED_SESSIONSECURITY) != 0 {
		lm, nt, err := negotiateExtendedSessionSecurity(flags, bytes, challenge, auth.UserName, auth.Password, auth.Domain)
		if err != nil {
			return nil, err
		}

		return buildNTLMResponsePayload(lm, nt, flags, auth.Domain, auth.Workstation, auth.UserName)
	}

	lm_bytes := lmResponse(challenge, auth.Password)
	lm := lm_bytes[:]
	nt_bytes := ntResponse(challenge, auth.Password)
	nt := nt_bytes[:]

	return buildNTLMResponsePayload(lm, nt, flags, auth.Domain, auth.Workstation, auth.UserName)
}

func (auth *ntlmAuth) Free() {
}
