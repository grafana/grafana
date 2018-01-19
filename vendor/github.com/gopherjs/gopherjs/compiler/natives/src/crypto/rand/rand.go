// +build js

package rand

import (
	"errors"

	"github.com/gopherjs/gopherjs/js"
)

func init() {
	Reader = &rngReader{}
}

type rngReader struct{}

func (r *rngReader) Read(b []byte) (n int, err error) {
	array := js.InternalObject(b).Get("$array")
	offset := js.InternalObject(b).Get("$offset").Int()

	// browser
	crypto := js.Global.Get("crypto")
	if crypto == js.Undefined {
		crypto = js.Global.Get("msCrypto")
	}
	if crypto != js.Undefined {
		if crypto.Get("getRandomValues") != js.Undefined {
			n = len(b)
			if n > 65536 {
				// Avoid QuotaExceededError thrown by getRandomValues
				// when length is more than 65536, as specified in
				// http://www.w3.org/TR/WebCryptoAPI/#Crypto-method-getRandomValues
				n = 65536
			}
			crypto.Call("getRandomValues", array.Call("subarray", offset, offset+n))
			return n, nil
		}
	}

	// Node.js
	if require := js.Global.Get("require"); require != js.Undefined {
		if randomBytes := require.Invoke("crypto").Get("randomBytes"); randomBytes != js.Undefined {
			array.Call("set", randomBytes.Invoke(len(b)), offset)
			return len(b), nil
		}
	}

	return 0, errors.New("crypto/rand not available in this environment")
}
