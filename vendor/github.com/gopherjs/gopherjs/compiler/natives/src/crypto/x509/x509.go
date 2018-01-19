// +build js

package x509

import "errors"

func loadSystemRoots() (*CertPool, error) {
	return nil, errors.New("crypto/x509: system root pool is not available in GopherJS")
}
