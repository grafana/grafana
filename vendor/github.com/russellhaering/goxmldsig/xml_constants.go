package dsig

import "crypto"

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
	RSASHA1SignatureMethod   = "http://www.w3.org/2000/09/xmldsig#rsa-sha1"
	RSASHA256SignatureMethod = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
	RSASHA512SignatureMethod = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512"
)

//Well-known signature algorithms
const (
	// Supported canonicalization algorithms
	CanonicalXML10ExclusiveAlgorithmId AlgorithmID = "http://www.w3.org/2001/10/xml-exc-c14n#"
	CanonicalXML11AlgorithmId          AlgorithmID = "http://www.w3.org/2006/12/xml-c14n11"

	CanonicalXML10RecAlgorithmId     AlgorithmID = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
	CanonicalXML10CommentAlgorithmId AlgorithmID = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315#WithComments"

	EnvelopedSignatureAltorithmId AlgorithmID = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
)

var digestAlgorithmIdentifiers = map[crypto.Hash]string{
	crypto.SHA1:   "http://www.w3.org/2000/09/xmldsig#sha1",
	crypto.SHA256: "http://www.w3.org/2001/04/xmlenc#sha256",
	crypto.SHA512: "http://www.w3.org/2001/04/xmlenc#sha512",
}

var digestAlgorithmsByIdentifier = map[string]crypto.Hash{}
var signatureMethodsByIdentifier = map[string]crypto.Hash{}

func init() {
	for hash, id := range digestAlgorithmIdentifiers {
		digestAlgorithmsByIdentifier[id] = hash
	}
	for hash, id := range signatureMethodIdentifiers {
		signatureMethodsByIdentifier[id] = hash
	}
}

var signatureMethodIdentifiers = map[crypto.Hash]string{
	crypto.SHA1:   RSASHA1SignatureMethod,
	crypto.SHA256: RSASHA256SignatureMethod,
	crypto.SHA512: RSASHA512SignatureMethod,
}
