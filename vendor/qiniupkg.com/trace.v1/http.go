package trace

import (
	"io"
	"net/http"
	"sync"
	"time"
)

const TraceHeaderKey = "X-Trace"

func SpanIDFromHTTP(req *http.Request) *SpanID {
	token := req.Header.Get(TraceHeaderKey)
	if token == "" {
		return nil
	}
	span, err := ParseContextToken(token)
	if err != nil {
		return nil
	}
	return span
}

func SetHTTPSpanID(span *SpanID, req *http.Request, w http.ResponseWriter) {
	if span == nil {
		return
	}
	if req != nil {
		req.Header.Set(TraceHeaderKey, span.ContextToken())
	}
	if w != nil {
		w.Header().Set(TraceHeaderKey, span.ContextToken())
	}
	return
}

//-------------------------------------------------------------
// HTTP Client Event

// 请在发起 http 请求前调用
//
func NewClientEvent(t *Recorder, r *http.Request) *ClientEvent {
	if r.Body != nil {
		r.Body = ReadCloserWithTrace(t, r.Body, "req.body.send")
	}
	return &ClientEvent{
		t:       t,
		Request: requestInfo(r),
	}
}

type RequestInfo struct {
	Method        string `trace:"method,omitempty"`
	Host          string `trace:"host,omitempty"`
	RemoteAddr    string `trace:"remote,omitempty"`
	URL           string `trace:"url,omitempty"`
	ContentLength int64  `trace:"size"`
}

type ResponseInfo struct {
	Error         string `trace:"err,omitempty"`
	ContentLength int64  `trace:"size"`
	StatusCode    int    `trace:"code,omitempty"`
}

func requestInfo(r *http.Request) RequestInfo {
	return RequestInfo{
		Method:        r.Method,
		Host:          r.Host,
		URL:           r.URL.String(),
		RemoteAddr:    r.RemoteAddr,
		ContentLength: r.ContentLength,
	}
}

type ClientEvent struct {
	t        *Recorder
	Request  RequestInfo  `trace:"c.q"`
	Response ResponseInfo `trace:"c.p"`
}

func (e *ClientEvent) LogResponse(resp *http.Response, err error) *ClientEvent {

	if err != nil {
		e.Response.Error = err.Error()
	}
	if resp != nil {
		e.Response.StatusCode = resp.StatusCode
		e.Response.ContentLength = resp.ContentLength
		if resp.Body != nil {
			resp.Body = ReadCloserWithTrace(e.t, resp.Body, "resp.body.recv")
		}
	}
	return e
}

//-------------------------------------------------------------
// HTTP Server Event

// 请在读取请求前调用
//
func NewServerEvent(t *Recorder, r *http.Request) *ServerEvent {
	return &ServerEvent{
		Request: requestInfo(r),
	}
}

func responseInfo(r *http.Response) ResponseInfo {
	return ResponseInfo{
		ContentLength: r.ContentLength,
		StatusCode:    r.StatusCode,
	}
}

type ServerEvent struct {
	Request  RequestInfo  `trace:"s.q"`
	Response ResponseInfo `trace:"s.p"`
}

func NewHTTPHandler(tracer *Tracer) func(
	http.ResponseWriter, *http.Request,
	func(http.ResponseWriter, *http.Request)) {

	return func(w http.ResponseWriter, req *http.Request,
		f func(http.ResponseWriter, *http.Request)) {

		tr := tracer
		if tr == nil {
			tr = DefaultTracer
		}
		t := tr.FromHTTP(req).Server()
		defer t.Finish()

		e := NewServerEvent(t, req)
		w1 := &responseRecorder{
			ResponseWriter: w,
		}
		f(w1, req)
		e.Response = responseInfo(w1.partial())
		t.FlattenKV("http", e)
	}
}

var HTTPHandler = NewHTTPHandler(nil)

type responseRecorder struct {
	http.ResponseWriter

	statusCode    int
	ContentLength int64
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.ContentLength += int64(len(b))
	if r.statusCode == 0 {
		r.statusCode = http.StatusOK
	}
	return r.ResponseWriter.Write(b)
}

func (r *responseRecorder) StatusCode() int {
	if r.statusCode == 0 {
		return http.StatusOK
	}
	return r.statusCode
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) partial() *http.Response {
	return &http.Response{
		StatusCode:    r.StatusCode(),
		ContentLength: r.ContentLength,
	}
}

//-------------------------------------------------------------
// HTTP Server Mux

type Mux interface {
	HandleFunc(pattern string, handler func(w http.ResponseWriter, req *http.Request))
	ServeHTTP(w http.ResponseWriter, req *http.Request)
}

type ServeMux struct {
	Mux
	t *Tracer
}

func SetServeMuxTracer(t *Tracer) func(*ServeMux) {
	return func(p *ServeMux) {
		p.t = t
	}
}

func NewServeMux(opts ...func(*ServeMux)) *ServeMux {
	p := &ServeMux{
		Mux: http.NewServeMux(),
		t:   DefaultTracer,
	}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

func NewServeMuxWith(mux Mux, opts ...func(*ServeMux)) *ServeMux {
	if mux == nil {
		mux = http.DefaultServeMux
	}
	p := &ServeMux{
		Mux: mux,
		t:   DefaultTracer,
	}
	for _, opt := range opts {
		opt(p)
	}
	return p
}

func (p *ServeMux) HandleFunc(pattern string, handler func(http.ResponseWriter, *http.Request)) {
	p.Mux.HandleFunc(pattern, p.handle(pattern, handler))
}

func (p *ServeMux) Handle(pattern string, handler http.Handler) {
	p.Mux.HandleFunc(pattern, p.handle(pattern, handler.ServeHTTP))
}

type setDefaulter interface {
	SetDefault(h http.Handler)
}

func (p *ServeMux) SetDefault(handler http.Handler) {
	if d, ok := p.Mux.(setDefaulter); ok {
		d.SetDefault(handler)
		return
	}
	panic("ServeMux.Mux dose not implement `SetDefault(h http.Handler)`")
}

type handler interface {
	Handler(req *http.Request) (http.Handler, string)
}

func (p *ServeMux) Handler(req *http.Request) (http.Handler, string) {
	if h, ok := p.Mux.(handler); ok {
		return h.Handler(req)
	}
	panic("ServeMux.Mux dose not implement `Handler(req *http.Request)(http.Handler, string)`")
}

func (p *ServeMux) handle(pattern string,
	f func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {

	return func(w http.ResponseWriter, req *http.Request) {
		t := p.t.FromHTTP(req).Server().Name(pattern)
		defer t.Finish()

		e := NewServerEvent(t, req)
		w1 := &responseRecorder{
			ResponseWriter: w,
		}
		f(w1, req)
		e.Response = responseInfo(w1.partial())
		t.FlattenKV("http", e)
	}
}

// 为了兼容老版本 qbox.us/servestk
func (p *ServeMux) HandleFuncEx(_, pattern string, handler func(http.ResponseWriter, *http.Request)) {
	p.Mux.HandleFunc(pattern, p.handle(pattern, handler))
}

//-------------------------------------------------------------
// Request body Reader

type traceReadCloser struct {
	t     *Recorder
	rc    io.ReadCloser
	once  sync.Once
	start time.Time
	msg   string

	closed bool
	lock   sync.Mutex
}

func ReadCloserWithTrace(t *Recorder, rc io.ReadCloser, msg string) *traceReadCloser {
	t.Reference()
	if msg == "" {
		msg = "ReadCloser"
	}
	return &traceReadCloser{
		t:   t,
		rc:  rc,
		msg: msg,
	}
}

func (tc *traceReadCloser) Read(b []byte) (n int, err error) {

	tc.once.Do(func() {
		tc.lock.Lock()
		tc.start = time.Now()
		tc.lock.Unlock()
	})
	n, err = tc.rc.Read(b)
	if err == io.EOF {
		tc.lock.Lock()
		tc.finish()
		tc.lock.Unlock()
	}
	return
}

func (tc *traceReadCloser) WriteTo(w io.Writer) (n int64, err error) {

	tc.once.Do(func() {
		tc.lock.Lock()
		tc.start = time.Now()
		tc.lock.Unlock()
	})
	if wt, ok := tc.rc.(io.WriterTo); ok {
		n, err = wt.WriteTo(w)
	} else {
		n, err = io.Copy(w, tc.rc)
	}
	tc.lock.Lock()
	tc.finish()
	tc.lock.Unlock()
	return
}

func (tc *traceReadCloser) Close() error {
	tc.lock.Lock()
	defer tc.lock.Unlock()

	tc.finish()
	return tc.rc.Close()
}

func (tc *traceReadCloser) finish() {
	if !tc.closed {
		if !tc.start.IsZero() {
			tc.t.Prof(tc.msg, tc.start, time.Now())
		}
		tc.t.Finish()
		tc.closed = true
	}
}
