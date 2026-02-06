package middleware

import (
	"net/http"
	"time"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
)

// NewTimeoutMiddleware returns a new timeout middleware that returns a 503 Service Unavailable
// using the http.TimeoutHandler. Note also that the middleware disables the http server write timeout
// to ensure the two timeouts don't conflict. We disable the server write timeout b/c it's behavior may
// be unintuitive. See below.
//
// Server.WriteTimeout:
//   - does not cancel context and instead allows the request to go until the next write. in practice this
//     means that an http server with a write timeout of 10s may go for significantly longer
//   - closes the tcp connection on the next write after the timeout has elapsed instead of sending a
//     meaningful http response
//   - allows streaming of http response back to caller
//
// http.TimeoutHandler
//   - cancels context allowing downstream code to abandon the request
//   - returns a 503 Service Unavailable with the provided message
//   - buffers response in memory which may be undesirable for large responses
func NewTimeoutMiddleware(dt time.Duration, msg string, log log.Logger) Func {
	return func(next http.Handler) http.Handler {
		return &timeoutHandler{
			log:     log,
			handler: http.TimeoutHandler(next, dt, msg),
		}
	}
}

type timeoutHandler struct {
	log     log.Logger
	handler http.Handler
}

func (t timeoutHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)
	// setting the write deadline to the zero time disables it
	err := rc.SetWriteDeadline(time.Time{})
	if err != nil {
		level.Warn(t.log).Log("msg", "failed to set write deadline in timeout handler. server WriteTimeout is still enforced", "err", err)
	}

	t.handler.ServeHTTP(w, r)
}
