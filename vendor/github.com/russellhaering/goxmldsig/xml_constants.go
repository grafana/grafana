package dsig

import (
	"crypto"
	"crypto/x509"
)

const (
	DefaultPrefix = "ds"
	Namespace     = "http://www.w3.org/2000/09/xmldsig#"
)

// Tags
const (
	SignatureTag              = "Signature"
	SignedInfoTag             = "SignedInfo"
	CanonicalizationMethodTag = "CanonicalizationMethod"
	SignatureMethodTag        = "SignatureMethod"
	ReferenceTag              = "Reference"
	TransformsTag             = "Transforms"
	TransformTag              = "Transform"
	DigestMethodTag           = "DigestMethod"
	DigestValueTag            = "DigestValue"
	SignatureValueTag         = "SignatureValue"
	KeyInfoTag                = "KeyInfo"
	X509DataTag               = "X509Data"
	X509CertificateTag        = "X509Certificate"
	InclusiveNamespacesTag    = "InclusiveNamespaces"
)

const (
	AlgorithmAttr  = "Algorithm"
	URIAttr        = "URI"
	DefaultIdAttr  = "ID"
	PrefixListAttr = "PrefixList"
)

type AlgorithmID string

func (id AlgorithmID) String() string {
	return string(id)
}

const (
	RSASHA1SignatureMethod     = "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
	RSASHA256SignatureMethod   = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
	RSASHA384SignatureMethod   = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha384"
	RSASHA512SignatureMethod   = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512"
	ECDSASHA1SignatureMethod   = "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha1"
	ECDSASHA256SignatureMethod = "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"
	ECDSASHA384SignatureMethod = "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384"
	ECDSASHA512SignatureMethod = "http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha512"
)

// Well-known signature algorithms
const (
	// Supported canonicalization algorithms
	CanonicalXML10ExclusiveAlgorithmId             AlgorithmID = "http://www.w3.org/2001/10/xml-exc-c14n#"
	CanonicalXML10ExclusiveWithCommentsAlgorithmId AlgorithmID = "http://www.w3.org/2001/10/xml-exc-c14n#WithComments"

	CanonicalXML11AlgorithmId             AlgorithmID = "http://www.w3.org/2006/12/xml-c14n11"
	CanonicalXML11WithCommentsAlgorithmId AlgorithmID = "http://www.w3.org/2006/12/xml-c14n11#WithComments"

	CanonicalXML10RecAlgorithmId          AlgorithmID = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
	CanonicalXML10WithCommentsAlgorithmId AlgorithmID = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments"

	EnvelopedSignatureAltorithmId AlgorithmID = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
)

var digestAlgorithmIdentifiers = map[crypto.Hash]string{
	crypto.SHA1:   "http://www.w3.org/2000/09/xmldsig#sha1",
	crypto.SHA256: "http://www.w3.org/2001/04/xmlenc#sha256",
	crypto.SHA384: "http://www.w3.org/2001/04/xmldsig-more#sha384",
	crypto.SHA512: "http://www.w3.org/2001/04/xmlenc#sha512",
}

type signatureMethodInfo struct {
	PublicKeyAlgorithm x509.PublicKeyAlgorithm
	Hash               crypto.Hash
}

var digestAlgorithmsByIdentifier = map[string]crypto.Hash{}
var signatureMethodsByIdentifier = map[string]signatureMethodInfo{}

func init() {
	for hash, id := range digestAlgorithmIdentifiers {
		digestAlgorithmsByIdentifier[id] = hash
	}
	for algo, hashToMethod := range signatureMethodIdentifiers {
		for hash, method := range hashToMethod {
			signatureMethodsByIdentifier[method] = signatureMethodInfo{
				PublicKeyAlgorithm: algo,
				Hash:               hash,
			}
		}
	}
}

var signatureMethodIdentifiers = map[x509.PublicKeyAlgorithm]map[crypto.Hash]string{
	x509.RSA: {
		crypto.SHA1:   RSASHA1SignatureMethod,
		crypto.SHA256: RSASHA256SignatureMethod,
		crypto.SHA384: RSASHA384SignatureMethod,
		crypto.SHA512: RSASHA512SignatureMethod,
	},
	x509.ECDSA: {
		crypto.SHA1:   ECDSASHA1SignatureMethod,
		crypto.SHA256: ECDSASHA256SignatureMethod,
		crypto.SHA384: ECDSASHA384SignatureMethod,
		crypto.SHA512: ECDSASHA512SignatureMethod,
	},
}

var x509SignatureAlgorithmByIdentifier = map[string]x509.SignatureAlgorithm{
	RSASHA1SignatureMethod:     x509.SHA1WithRSA,
	RSASHA256SignatureMethod:   x509.SHA256WithRSA,
	RSASHA384SignatureMethod:   x509.SHA384WithRSA,
	RSASHA512SignatureMethod:   x509.SHA512WithRSA,
	ECDSASHA1SignatureMethod:   x509.ECDSAWithSHA1,
	ECDSASHA256SignatureMethod: x509.ECDSAWithSHA256,
	ECDSASHA384SignatureMethod: x509.ECDSAWithSHA384,
	ECDSASHA512SignatureMethod: x509.ECDSAWithSHA512,
}
