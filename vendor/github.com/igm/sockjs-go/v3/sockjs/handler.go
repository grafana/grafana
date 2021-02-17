package sockjs

import (
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
)

type Handler struct {
	prefix      string
	options     Options
	handlerFunc func(Session)
	mappings    []*mapping

	sessionsMux sync.Mutex
	sessions    map[string]*session
}

const sessionPrefix = "^/([^/.]+)/([^/.]+)"

var sessionRegExp = regexp.MustCompile(sessionPrefix)

// NewHandler creates new HTTP handler that conforms to the basic net/http.Handler interface.
// It takes path prefix, options and sockjs handler function as parameters
func NewHandler(prefix string, opts Options, handlerFunc func(Session)) *Handler {
	if handlerFunc == nil {
		handlerFunc = func(s Session) {}
	}
	h := &Handler{
		prefix:      prefix,
		options:     opts,
		handlerFunc: handlerFunc,
		sessions:    make(map[string]*session),
	}
	xhrCors := xhrCorsFactory(opts)
	h.mappings = []*mapping{
		newMapping("GET", "^[/]?$", welcomeHandler),
		newMapping("OPTIONS", "^/info$", opts.cookie, xhrCors, cacheFor, opts.info),
		newMapping("GET", "^/info$", opts.cookie, xhrCors, noCache, opts.info),
		// XHR
		newMapping("POST", sessionPrefix+"/xhr_send$", opts.cookie, xhrCors, noCache, h.xhrSend),
		newMapping("OPTIONS", sessionPrefix+"/xhr_send$", opts.cookie, xhrCors, cacheFor, xhrOptions),
		newMapping("POST", sessionPrefix+"/xhr$", opts.cookie, xhrCors, noCache, h.xhrPoll),
		newMapping("OPTIONS", sessionPrefix+"/xhr$", opts.cookie, xhrCors, cacheFor, xhrOptions),
		newMapping("POST", sessionPrefix+"/xhr_streaming$", opts.cookie, xhrCors, noCache, h.xhrStreaming),
		newMapping("OPTIONS", sessionPrefix+"/xhr_streaming$", opts.cookie, xhrCors, cacheFor, xhrOptions),
		// EventStream
		newMapping("GET", sessionPrefix+"/eventsource$", opts.cookie, xhrCors, noCache, h.eventSource),
		// Htmlfile
		newMapping("GET", sessionPrefix+"/htmlfile$", opts.cookie, xhrCors, noCache, h.htmlFile),
		// JsonP
		newMapping("GET", sessionPrefix+"/jsonp$", opts.cookie, xhrCors, noCache, h.jsonp),
		newMapping("OPTIONS", sessionPrefix+"/jsonp$", opts.cookie, xhrCors, cacheFor, xhrOptions),
		newMapping("POST", sessionPrefix+"/jsonp_send$", opts.cookie, xhrCors, noCache, h.jsonpSend),
		// IFrame
		newMapping("GET", "^/iframe[0-9-.a-z_]*.html$", cacheFor, h.iframe),
	}
	if opts.Websocket {
		h.mappings = append(h.mappings, newMapping("GET", sessionPrefix+"/websocket$", h.sockjsWebsocket))
	}
	if opts.RawWebsocket {
		h.mappings = append(h.mappings, newMapping("GET", "^/websocket$", h.rawWebsocket))
	}
	return h
}

func (h *Handler) Prefix() string { return h.prefix }

func (h *Handler) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	// iterate over mappings
	http.StripPrefix(h.prefix, http.HandlerFunc(func(rw http.ResponseWriter, req *http.Request) {
		var allowedMethods []string
		for _, mapping := range h.mappings {
			if match, method := mapping.matches(req); match == fullMatch {
				for _, hf := range mapping.chain {
					hf(rw, req)
				}
				return
			} else if match == pathMatch {
				allowedMethods = append(allowedMethods, method)
			}
		}
		if len(allowedMethods) > 0 {
			rw.Header().Set("allow", strings.Join(allowedMethods, ", "))
			rw.Header().Set("Content-Type", "")
			rw.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		http.NotFound(rw, req)
	})).ServeHTTP(rw, req)
}

func (h *Handler) parseSessionID(url *url.URL) (string, error) {
	matches := sessionRegExp.FindStringSubmatch(url.Path)
	if len(matches) == 3 {
		return matches[2], nil
	}
	return "", errSessionParse
}

func (h *Handler) sessionByRequest(req *http.Request) (*session, error) {
	h.sessionsMux.Lock()
	defer h.sessionsMux.Unlock()
	sessionID, err := h.parseSessionID(req.URL)
	if err != nil {
		return nil, err
	}
	sess, exists := h.sessions[sessionID]
	if !exists {
		sess = newSession(req, sessionID, h.options.DisconnectDelay, h.options.HeartbeatDelay)
		h.sessions[sessionID] = sess
		go func() {
			<-sess.closeCh
			h.sessionsMux.Lock()
			delete(h.sessions, sessionID)
			h.sessionsMux.Unlock()
		}()
	}
	sess.setCurrentRequest(req)
	return sess, nil
}
