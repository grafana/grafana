package reqid

import (
	"encoding/binary"
	"encoding/base64"
	"net/http"
	"time"

	. "golang.org/x/net/context"
)

// --------------------------------------------------------------------

var pid = uint32(time.Now().UnixNano() % 4294967291)

func genReqId() string {
	var b [12]byte
	binary.LittleEndian.PutUint32(b[:], pid)
	binary.LittleEndian.PutUint64(b[4:], uint64(time.Now().UnixNano()))
	return base64.URLEncoding.EncodeToString(b[:])
}

// --------------------------------------------------------------------

type key int // key is unexported and used for Context

const (
	reqidKey key = 0
)

func NewContext(ctx Context, reqid string) Context {
	return WithValue(ctx, reqidKey, reqid)
}

func NewContextWith(ctx Context, w http.ResponseWriter, req *http.Request) Context {
	reqid := req.Header.Get("X-Reqid")
	if reqid == "" {
		reqid = genReqId()
		req.Header.Set("X-Reqid", reqid)
	}
	h := w.Header()
	h.Set("X-Reqid", reqid)
	return WithValue(ctx, reqidKey, reqid)
}

func FromContext(ctx Context) (reqid string, ok bool) {
	reqid, ok = ctx.Value(reqidKey).(string)
	return
}

// --------------------------------------------------------------------

