package xjwt

import (
	"encoding/json"
	"time"

	"fmt"

	jose "gopkg.in/square/go-jose.v2"
)

type VerifyReasons int32

const (
	JWT_UNKNOWN           VerifyReasons = 0
	JWT_NOT_PRESENT       VerifyReasons = 1
	JWT_EXPIRED           VerifyReasons = 2
	JWT_INVALID_SIGNATURE VerifyReasons = 3
	JWT_NO_VALIDATORS     VerifyReasons = 4
	JWT_MALFORMED         VerifyReasons = 5
	JWT_EXPECT_MISMATCH   VerifyReasons = 6
)

type VerifyErr struct {
	msg    string
	reason VerifyReasons
}

type AuthzErrWithReason interface {
	XJWTVerifyReason() VerifyReasons
}

func (e *VerifyErr) Error() string {
	return e.msg
}

func (e *VerifyErr) XJWTVerifyReason() VerifyReasons {
	return e.reason
}

// TODO(pquerna): lower this after more research in realistic expiration times
const maxExpirationFromNow = (time.Hour * 24) * 91

type VerifyConfig struct {
	ExpectedIssuer   string
	ExpectedSubject  string
	ExpectedAudience string
	ExpectedNonce    string
	Now              func() time.Time
	KeySet           *jose.JSONWebKeySet
}

var validSignatureAlgorithm = []jose.SignatureAlgorithm{
	jose.RS256, // RSASSA-PKCS-v1.5 using SHA-256
	jose.RS384, // RSASSA-PKCS-v1.5 using SHA-384
	jose.RS512, // RSASSA-PKCS-v1.5 using SHA-512
	jose.ES256, // ECDSA using P-256 and SHA-256
	jose.ES384, // ECDSA using P-384 and SHA-384
	jose.ES512, // ECDSA using P-521 and SHA-512
	jose.PS256, // RSASSA-PSS using SHA256 and MGF1-SHA256
	jose.PS384, // RSASSA-PSS using SHA384 and MGF1-SHA384
	jose.PS512, // RSASSA-PSS using SHA512 and MGF1-SHA512
}

func isAllowedAlgo(in jose.SignatureAlgorithm) bool {
	for _, validAlgo := range validSignatureAlgorithm {
		if in == validAlgo {
			return true
		}
	}
	return false
}

// Verify verifies a JWT.
//
// It is paranoid.  It has default settings for "real world" JWT usage as an HTTP Header.
//
// It will reject potentially valid JWTs nd related specifications.
//
// But its safe.
func Verify(input []byte, vc VerifyConfig) (map[string]interface{}, error) {
	var now time.Time
	if vc.Now == nil {
		now = time.Now()
	} else {
		now = vc.Now()
	}

	object, err := jose.ParseSigned(string(input))
	if err != nil {
		return nil, err
	}

	if len(object.Signatures) != 1 {
		return nil, &VerifyErr{
			msg:    "xjwt: Only single signatures are supported",
			reason: JWT_MALFORMED,
		}
	}

	if len(vc.KeySet.Keys) == 0 {
		return nil, &VerifyErr{
			msg:    "xjwt: no KeySet provided",
			reason: JWT_UNKNOWN,
		}
	}

	signature := object.Signatures[0]

	algo := jose.SignatureAlgorithm(signature.Header.Algorithm)

	if !isAllowedAlgo(algo) {
		return nil, &VerifyErr{
			msg:    "xjwt: signature uses unsupported algorithm",
			reason: JWT_INVALID_SIGNATURE,
		}
	}

	var keys []jose.JSONWebKey
	if signature.Header.KeyID == "" {
		keys = vc.KeySet.Keys
	} else {
		keys = vc.KeySet.Key(signature.Header.KeyID)
	}

	if len(keys) == 0 {
		return nil, &VerifyErr{
			msg:    "xjwt: no matching keys available",
			reason: JWT_INVALID_SIGNATURE,
		}
	}

	var payload []byte
	for _, key := range keys {
		payload, err = object.Verify(key)
		if err != nil {
			continue
		}

		if !key.IsPublic() {
			payload = nil
			return nil, &VerifyErr{
				msg:    "xjwt: only public key verification is allowed",
				reason: JWT_INVALID_SIGNATURE,
			}
		}

		// payload != nil
		break
	}

	if payload == nil {
		// TODO(pquerna): this can happen if the JWT is very old, and all valid keys for
		// validating it have expired, so we return invalid signature, even if no keys could be found?
		return nil, &VerifyErr{
			msg:    "xjwt: no matching keys could validate payload",
			reason: JWT_NO_VALIDATORS,
		}
	}

	idt := &idToken{}
	err = json.Unmarshal(payload, idt)
	if err != nil {
		return nil, &VerifyErr{
			msg:    fmt.Sprintf("xjwt: payload did not contain JSON: %v", err.Error()),
			reason: JWT_MALFORMED,
		}
	}

	if vc.ExpectedIssuer != "" {
		if vc.ExpectedIssuer != idt.Issuer {
			return nil, &VerifyErr{
				msg:    fmt.Sprintf("xjwt: Issuer mismatch. '%s' != '%s'", vc.ExpectedIssuer, idt.Issuer),
				reason: JWT_EXPECT_MISMATCH,
			}
		}
	}

	if vc.ExpectedSubject != "" {
		if vc.ExpectedSubject != idt.Subject {
			return nil, &VerifyErr{
				msg:    fmt.Sprintf("xjwt: Subject mismatch. '%s' != '%s'", vc.ExpectedSubject, idt.Subject),
				reason: JWT_EXPECT_MISMATCH,
			}
		}
	}

	if vc.ExpectedNonce != "" {
		if vc.ExpectedNonce != idt.Nonce {
			return nil, &VerifyErr{
				msg:    fmt.Sprintf("xjwt: Nonce mismatch. '%s' != '%s'", vc.ExpectedNonce, idt.Nonce),
				reason: JWT_EXPECT_MISMATCH,
			}
		}
	}

	if vc.ExpectedAudience != "" {
		if len(idt.Audience) == 0 || !idt.Audience.contains(vc.ExpectedAudience) {
			return nil, &VerifyErr{
				msg:    fmt.Sprintf("xjwt: Audience mismatch. '%s' not in %v", vc.ExpectedAudience, idt.Audience),
				reason: JWT_EXPECT_MISMATCH,
			}
		}
	}

	expires := time.Time(idt.Expiry)
	if now.After(expires) {
		return nil, &VerifyErr{
			msg:    fmt.Sprintf("xjwt: JWT expired: now:'%s' is after jwt:'%s'", now.String(), expires.String()),
			reason: JWT_EXPIRED,
		}
	}

	if expires.After(now.Add(maxExpirationFromNow)) {
		return nil, &VerifyErr{
			msg:    fmt.Sprintf("xjwt: JWT has invalid expiration: jwt:'%s' is too far in the future (max:'%s')", expires.String(), now.Add(maxExpirationFromNow).String()),
			reason: JWT_EXPIRED,
		}
	}

	nbf := time.Time(idt.NotBefore)
	if now.Before(nbf) {
		return nil, &VerifyErr{
			msg:    fmt.Sprintf("xjwt: JWT nbf is before now: jwt:'%s' now:'%s'", nbf.String(), now.String()),
			reason: JWT_EXPIRED,
		}
	}

	data := make(map[string]interface{})
	err = json.Unmarshal(payload, &data)
	if err != nil {
		return nil, &VerifyErr{
			msg:    fmt.Sprintf("xjwt: data did not contain JSON: %v", err.Error()),
			reason: JWT_MALFORMED,
		}
	}

	return data, nil
}

// from https://github.com/coreos/go-oidc/blob/master/oidc.go

type idToken struct {
	Issuer    string   `json:"iss"`
	Subject   string   `json:"sub"`
	Audience  audience `json:"aud"`
	Expiry    jsonTime `json:"exp"`
	NotBefore jsonTime `json:"nbf"`
	Nonce     string   `json:"nonce"`
}

type audience []string

func (a audience) contains(needle string) bool {
	for _, v := range a {
		if v == needle {
			return true
		}
	}
	return false
}

func (a *audience) UnmarshalJSON(b []byte) error {
	var s string
	if json.Unmarshal(b, &s) == nil {
		*a = audience{s}
		return nil
	}
	var auds []string
	if err := json.Unmarshal(b, &auds); err != nil {
		return err
	}
	*a = audience(auds)
	return nil
}

func (a audience) MarshalJSON() ([]byte, error) {
	if len(a) == 1 {
		return json.Marshal(a[0])
	}
	return json.Marshal([]string(a))
}

type jsonTime time.Time

func (j *jsonTime) UnmarshalJSON(b []byte) error {
	var n json.Number
	if err := json.Unmarshal(b, &n); err != nil {
		return err
	}
	var unix int64

	if t, err := n.Int64(); err == nil {
		unix = t
	} else {
		f, err := n.Float64()
		if err != nil {
			return err
		}
		unix = int64(f)
	}
	*j = jsonTime(time.Unix(unix, 0))
	return nil
}

func (j jsonTime) MarshalJSON() ([]byte, error) {
	return json.Marshal(time.Time(j).Unix())
}
