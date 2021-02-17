package sockjs

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	entropy      *rand.Rand
	entropyMutex sync.Mutex
)

func init() {
	entropy = rand.New(rand.NewSource(time.Now().UnixNano()))
}

// Options type is used for defining various sockjs options
type Options struct {
	// Transports which don't support cross-domain communication natively ('eventsource' to name one) use an iframe trick.
	// A simple page is served from the SockJS server (using its foreign domain) and is placed in an invisible iframe.
	// Code run from this iframe doesn't need to worry about cross-domain issues, as it's being run from domain local to the SockJS server.
	// This iframe also does need to load SockJS javascript client library, and this option lets you specify its url (if you're unsure,
	// point it to the latest minified SockJS client release, this is the default). You must explicitly specify this url on the server
	// side for security reasons - we don't want the possibility of running any foreign javascript within the SockJS domain (aka cross site scripting attack).
	// Also, sockjs javascript library is probably already cached by the browser - it makes sense to reuse the sockjs url you're using in normally.
	SockJSURL string
	// Most streaming transports save responses on the client side and don't free memory used by delivered messages.
	// Such transports need to be garbage-collected once in a while. `response_limit` sets a minimum number of bytes that can be send
	// over a single http streaming request before it will be closed. After that client needs to open new request.
	// Setting this value to one effectively disables streaming and will make streaming transports to behave like polling transports.
	// The default value is 128K.
	ResponseLimit uint32
	// Some load balancers don't support websockets. This option can be used to disable websockets support by the server. By default websockets are enabled.
	Websocket bool
	// This option can be used to enable raw websockets support by the server. By default raw websockets are disabled.
	RawWebsocket bool
	// Provide a custom Upgrader for Websocket connections to enable features like compression.
	// See https://godoc.org/github.com/gorilla/websocket#Upgrader for more details.
	WebsocketUpgrader *websocket.Upgrader
	// WebsocketWriteTimeout is a custom write timeout for Websocket underlying network connection.
	// A zero value means writes will not time out.
	WebsocketWriteTimeout time.Duration
	// In order to keep proxies and load balancers from closing long running http requests we need to pretend that the connection is active
	// and send a heartbeat packet once in a while. This setting controls how often this is done.
	// By default a heartbeat packet is sent every 25 seconds.
	HeartbeatDelay time.Duration
	// The server closes a session when a client receiving connection have not been seen for a while.
	// This delay is configured by this setting.
	// By default the session is closed when a receiving connection wasn't seen for 5 seconds.
	DisconnectDelay time.Duration
	// Some hosting providers enable sticky sessions only to requests that have JSessionID cookie set.
	// This setting controls if the server should set this cookie to a dummy value.
	// By default setting JSessionID cookie is disabled. More sophisticated behaviour can be achieved by supplying a function.
	JSessionID func(http.ResponseWriter, *http.Request)
	// CORS origin to be set on outgoing responses. If set to the empty string, it will default to the
	// incoming `Origin` header, or "*" if the Origin header isn't set.
	Origin string
	// CheckOrigin allows to dynamically decide whether server should set CORS
	// headers or not in case of XHR requests. When true returned CORS will be
	// configured with allowed origin equal to incoming `Origin` header, or "*"
	// if the request Origin header isn't set. When false returned CORS headers
	// won't be set at all. If this function is nil then Origin option above will
	// be taken into account.
	CheckOrigin func(*http.Request) bool
}

// DefaultOptions is a convenient set of options to be used for sockjs
var DefaultOptions = Options{
	Websocket:         true,
	RawWebsocket:      false,
	JSessionID:        nil,
	SockJSURL:         "//cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js",
	HeartbeatDelay:    25 * time.Second,
	DisconnectDelay:   5 * time.Second,
	ResponseLimit:     128 * 1024,
	WebsocketUpgrader: &websocket.Upgrader{},
}

type info struct {
	Websocket    bool     `json:"websocket"`
	CookieNeeded bool     `json:"cookie_needed"`
	Origins      []string `json:"origins"`
	Entropy      int32    `json:"entropy"`
}

func (options *Options) info(rw http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case http.MethodGet:
		rw.Header().Set("Content-Type", "application/json; charset=UTF-8")
		if err := json.NewEncoder(rw).Encode(info{
			Websocket:    options.Websocket,
			CookieNeeded: options.JSessionID != nil,
			Origins:      []string{"*:*"},
			Entropy:      generateEntropy(),
		}); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
		}
	case http.MethodOptions:
		rw.Header().Set("Access-Control-Allow-Methods", "OPTIONS, GET")
		rw.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", 365*24*60*60))
		rw.WriteHeader(http.StatusNoContent) // 204
	default:
		http.NotFound(rw, req)
	}
}

// DefaultJSessionID is a default behaviour function to be used in options for JSessionID if JSESSIONID is needed
func DefaultJSessionID(rw http.ResponseWriter, req *http.Request) {
	cookie, err := req.Cookie("JSESSIONID")
	if err == http.ErrNoCookie {
		cookie = &http.Cookie{
			Name:  "JSESSIONID",
			Value: "dummy",
		}
	}
	cookie.Path = "/"
	header := rw.Header()
	header.Add("Set-Cookie", cookie.String())
}

func (options *Options) cookie(rw http.ResponseWriter, req *http.Request) {
	if options.JSessionID != nil { // cookie is needed
		options.JSessionID(rw, req)
	}
}

func generateEntropy() int32 {
	entropyMutex.Lock()
	entropy := entropy.Int31()
	entropyMutex.Unlock()
	return entropy
}
