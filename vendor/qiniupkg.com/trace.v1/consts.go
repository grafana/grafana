package trace

const (
	// CLIENT_SEND = "cs"
	// CLIENT_RECV = "cr"
	// SERVER_SEND = "ss"
	// SERVER_RECV = "sr"

	// span mode
	MODE_ASYNC  = "a" // async goroutine/queue task
	MODE_CLIENT = "c" // client side
	MODE_SERVER = "s" // server side

	// http client info
	CLIENT_HTTP_HOST          = "http.c.q.host"
	CLIENT_HTTP_METHOD        = "http.c.q.method"
	CLIENT_HTTP_PATH          = "http.c.q.path"
	CLIENT_HTTP_REQUEST_SIZE  = "http.c.q.size"
	CLIENT_HTTP_RESPONSE_SIZE = "http.c.p.size"
	CLIENT_HTTP_STATUS_CODE   = "http.c.p.code"

	// http server info
	SERVER_HTTP_HOST          = "http.s.q.host"
	SERVER_HTTP_METHOD        = "http.s.q.method"
	SERVER_HTTP_PATH          = "http.s.q.path"
	SERVER_HTTP_REQUEST_SIZE  = "http.s.q.size"
	SERVER_HTTP_RESPONSE_SIZE = "http.s.p.size"
	SERVER_HTTP_STATUS_CODE   = "http.s.p.code"

	// LOCAL_COMPONENT = "lc"
	// CLIENT_ADDR     = "ca"
	// SERVER_ADDR     = "sa"
)
