package qbox

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"io"
	"net/http"

	. "github.com/qiniu/api.v7/conf"
	"github.com/qiniu/x/bytes.v7/seekable"
)

// ----------------------------------------------------------

type Mac struct {
	AccessKey string
	SecretKey []byte
}

func NewMac(accessKey, secretKey string) (mac *Mac) {

	if accessKey == "" {
		accessKey, secretKey = ACCESS_KEY, SECRET_KEY
	}
	return &Mac{accessKey, []byte(secretKey)}
}

func (mac *Mac) Sign(data []byte) (token string) {

	h := hmac.New(sha1.New, mac.SecretKey)
	h.Write(data)

	sign := base64.URLEncoding.EncodeToString(h.Sum(nil))
	return mac.AccessKey + ":" + sign[:27]
}

func (mac *Mac) SignWithData(b []byte) (token string) {

	blen := base64.URLEncoding.EncodedLen(len(b))

	key := mac.AccessKey
	nkey := len(key)
	ret := make([]byte, nkey+30+blen)

	base64.URLEncoding.Encode(ret[nkey+30:], b)

	h := hmac.New(sha1.New, mac.SecretKey)
	h.Write(ret[nkey+30:])
	digest := h.Sum(nil)

	copy(ret, key)
	ret[nkey] = ':'
	base64.URLEncoding.Encode(ret[nkey+1:], digest)
	ret[nkey+29] = ':'

	return string(ret)
}

func (mac *Mac) SignRequest(req *http.Request, incbody bool) (token string, err error) {

	h := hmac.New(sha1.New, mac.SecretKey)

	u := req.URL
	data := u.Path
	if u.RawQuery != "" {
		data += "?" + u.RawQuery
	}
	io.WriteString(h, data+"\n")

	if incbody {
		s2, err2 := seekable.New(req)
		if err2 != nil {
			return "", err2
		}
		h.Write(s2.Bytes())
	}

	sign := base64.URLEncoding.EncodeToString(h.Sum(nil))
	token = mac.AccessKey + ":" + sign
	return
}

func (mac *Mac) VerifyCallback(req *http.Request) (bool, error) {

	auth := req.Header.Get("Authorization")
	if auth == "" {
		return false, nil
	}

	token, err := mac.SignRequest(req, true)
	if err != nil {
		return false, err
	}

	return auth == "QBox "+token, nil
}

// ---------------------------------------------------------------------------------------

func Sign(mac *Mac, data []byte) string {

	if mac == nil {
		mac = NewMac(ACCESS_KEY, SECRET_KEY)
	}
	return mac.Sign(data)
}

func SignWithData(mac *Mac, data []byte) string {

	if mac == nil {
		mac = NewMac(ACCESS_KEY, SECRET_KEY)
	}
	return mac.SignWithData(data)
}

// ---------------------------------------------------------------------------------------

type Transport struct {
	mac       Mac
	Transport http.RoundTripper
}

func incBody(req *http.Request) bool {

	if req.Body == nil {
		return false
	}
	if ct, ok := req.Header["Content-Type"]; ok {
		switch ct[0] {
		case "application/x-www-form-urlencoded":
			return true
		}
	}
	return false
}

func (t *Transport) NestedObject() interface{} {

	return t.Transport
}

func (t *Transport) RoundTrip(req *http.Request) (resp *http.Response, err error) {

	token, err := t.mac.SignRequest(req, incBody(req))
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "QBox "+token)
	return t.Transport.RoundTrip(req)
}

func NewTransport(mac *Mac, transport http.RoundTripper) *Transport {

	if mac == nil {
		mac = NewMac(ACCESS_KEY, SECRET_KEY)
	}
	if transport == nil {
		transport = http.DefaultTransport
	}
	t := &Transport{mac: *mac, Transport: transport}
	return t
}

func NewClient(mac *Mac, transport http.RoundTripper) *http.Client {

	t := NewTransport(mac, transport)
	return &http.Client{Transport: t}
}

// ---------------------------------------------------------------------------------------
