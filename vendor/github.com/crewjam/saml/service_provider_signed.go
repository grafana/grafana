package saml

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha1" // #nosec G505
	"crypto/sha256"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"net/url"

	dsig "github.com/russellhaering/goxmldsig"
)

type reqType string

const (
	samlRequest  reqType = "SAMLRequest"
	samlResponse reqType = "SAMLResponse"
)

var (
	// ErrInvalidQuerySignature is returned when the query signature is invalid
	ErrInvalidQuerySignature = errors.New("invalid query signature")
	// ErrNoQuerySignature is returned when the query does not contain a signature
	ErrNoQuerySignature = errors.New("query Signature or SigAlg not found")
)

// Sign Query with the SP private key.
// Returns provided query with the SigAlg and Signature parameters added.
func (sp *ServiceProvider) signQuery(reqT reqType, query, body, relayState string) (string, error) {
	signingContext, err := GetSigningContext(sp)

	// Encode Query as standard demands. query.Encode() is not standard compliant
	toHash := string(reqT) + "=" + url.QueryEscape(body)
	if relayState != "" {
		toHash += "&RelayState=" + url.QueryEscape(relayState)
	}

	toHash += "&SigAlg=" + url.QueryEscape(sp.SignatureMethod)

	if err != nil {
		return "", err
	}

	sig, err := signingContext.SignString(toHash)
	if err != nil {
		return "", err
	}

	query += "&SigAlg=" + url.QueryEscape(sp.SignatureMethod)
	query += "&Signature=" + url.QueryEscape(base64.StdEncoding.EncodeToString(sig))

	return query, nil
}

// validateSig validation of the signature of the Redirect Binding in query values
// Query is valid if return is nil
func (sp *ServiceProvider) validateQuerySig(query url.Values) error {
	sig := query.Get("Signature")
	alg := query.Get("SigAlg")
	if sig == "" || alg == "" {
		return ErrNoQuerySignature
	}

	certs, err := sp.getIDPSigningCerts()
	if err != nil {
		return err
	}

	respType := ""
	switch {
	case query.Get("SAMLResponse") != "":
		respType = "SAMLResponse"
	case query.Get("SAMLRequest") != "":
		respType = "SAMLRequest"
	default:
		return fmt.Errorf("no SAMLResponse or SAMLRequest found in query")
	}

	// Encode Query as standard demands.
	// query.Encode() is not standard compliant
	// as query encoding order matters
	res := respType + "=" + url.QueryEscape(query.Get(respType))

	relayState := query.Get("RelayState")
	if relayState != "" {
		res += "&RelayState=" + url.QueryEscape(relayState)
	}

	res += "&SigAlg=" + url.QueryEscape(alg)

	// Signature is base64 encoded
	sigBytes, err := base64.StdEncoding.DecodeString(sig)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	var (
		hashed  []byte
		hashAlg crypto.Hash
		sigAlg  x509.SignatureAlgorithm
	)

	// Hashed Query
	switch alg {
	case dsig.RSASHA256SignatureMethod:
		hashed256 := sha256.Sum256([]byte(res))
		hashed = hashed256[:]
		hashAlg = crypto.SHA256
		sigAlg = x509.SHA256WithRSA
	case dsig.RSASHA512SignatureMethod:
		hashed512 := sha512.Sum512([]byte(res))
		hashed = hashed512[:]
		hashAlg = crypto.SHA512
		sigAlg = x509.SHA512WithRSA
	case dsig.RSASHA1SignatureMethod:
		hashed1 := sha1.Sum([]byte(res)) // #nosec G401
		hashed = hashed1[:]
		hashAlg = crypto.SHA1
		sigAlg = x509.SHA1WithRSA
	default:
		return fmt.Errorf("unsupported signature algorithm: %s", alg)
	}

	// validate signature
	for _, cert := range certs {
		// verify cert is RSA
		if cert.SignatureAlgorithm != sigAlg {
			continue
		}

		if err := rsa.VerifyPKCS1v15(cert.PublicKey.(*rsa.PublicKey), hashAlg, hashed, sigBytes); err == nil {
			return nil
		}
	}

	return ErrInvalidQuerySignature
}
