package logincreds

import (
	"context"
	"crypto/ecdsa"
	cryptorand "crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/internal/sdk"
	"github.com/aws/aws-sdk-go-v2/service/signin"
	"github.com/aws/smithy-go/middleware"
	smithyrand "github.com/aws/smithy-go/rand"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// AWS signin DPOP always uses the P256 curve
const curvelen = 256 / 8 // bytes

// https://datatracker.ietf.org/doc/html/rfc9449
func mkdpop(token *loginToken, htu string) (string, error) {
	key, err := parseKey(token.DPOPKey)
	if err != nil {
		return "", fmt.Errorf("parse key: %w", err)
	}

	header, err := jsonb64(&dpopHeader{
		Typ: "dpop+jwt",
		Alg: "ES256",
		Jwk: &dpopHeaderJwk{
			Kty: "EC",
			X:   base64.RawURLEncoding.EncodeToString(key.X.Bytes()),
			Y:   base64.RawURLEncoding.EncodeToString(key.Y.Bytes()),
			Crv: "P-256",
		},
	})
	if err != nil {
		return "", fmt.Errorf("marshal header: %w", err)
	}

	uuid, err := smithyrand.NewUUID(cryptorand.Reader).GetUUID()
	if err != nil {
		return "", fmt.Errorf("uuid: %w", err)
	}

	payload, err := jsonb64(&dpopPayload{
		Jti: uuid,
		Htm: "POST",
		Htu: htu,
		Iat: sdk.NowTime().Unix(),
	})
	if err != nil {
		return "", fmt.Errorf("marshal payload: %w", err)
	}

	msg := fmt.Sprintf("%s.%s", header, payload)

	h := sha256.New()
	h.Write([]byte(msg))

	r, s, err := ecdsa.Sign(cryptorand.Reader, key, h.Sum(nil))
	if err != nil {
		return "", fmt.Errorf("sign: %w", err)
	}

	// DPOP signatures are formatted in RAW r || s form (with each value padded
	// to fit in curve size which in our case is always the 256 bits) - rather
	// than encoded in something like asn.1
	sig := make([]byte, curvelen*2)
	r.FillBytes(sig[0:curvelen])
	s.FillBytes(sig[curvelen:])

	dpop := fmt.Sprintf("%s.%s", msg, base64.RawURLEncoding.EncodeToString(sig))
	return dpop, nil
}

func parseKey(pemBlock string) (*ecdsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemBlock))
	priv, err := x509.ParseECPrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse ec private key: %w", err)
	}

	return priv, nil
}

func jsonb64(v any) (string, error) {
	j, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(j), nil
}

type dpopHeader struct {
	Typ string         `json:"typ"`
	Alg string         `json:"alg"`
	Jwk *dpopHeaderJwk `json:"jwk"`
}

type dpopHeaderJwk struct {
	Kty string `json:"kty"`
	X   string `json:"x"`
	Y   string `json:"y"`
	Crv string `json:"crv"`
}

type dpopPayload struct {
	Jti string `json:"jti"`
	Htm string `json:"htm"`
	Htu string `json:"htu"`
	Iat int64  `json:"iat"`
}

type signDPOP struct {
	Token *loginToken
}

func addSignDPOP(token *loginToken) func(o *signin.Options) {
	return signin.WithAPIOptions(func(stack *middleware.Stack) error {
		return stack.Finalize.Add(&signDPOP{token}, middleware.After)
	})
}

func (*signDPOP) ID() string {
	return "signDPOP"
}

func (m *signDPOP) HandleFinalize(
	ctx context.Context, in middleware.FinalizeInput, next middleware.FinalizeHandler) (
	out middleware.FinalizeOutput, md middleware.Metadata, err error,
) {
	req, ok := in.Request.(*smithyhttp.Request)
	if !ok {
		return out, md, fmt.Errorf("unexpected transport type %T", req)
	}

	dpop, err := mkdpop(m.Token, req.URL.String())
	if err != nil {
		return out, md, fmt.Errorf("sign dpop: %w", err)
	}

	req.Header.Set("DPoP", dpop)
	return next.HandleFinalize(ctx, in)
}
