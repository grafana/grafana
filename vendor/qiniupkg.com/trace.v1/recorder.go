package trace

import (
	"net/http"
	"reflect"
	"sync"
	"time"
)

const (
	MaxAnnotations = 512
	MaxAnnoBytes   = 512
)

// Recorder 需正确区分三种情形：
//
// 	1. 假的 Recorder (即 DummyRecorder)
//		通常在用户误用的情况下返回 DummyRecorder，这种 Recorder 不会持久化任何数据，
//		且不会向后传递任何 trace 信息，产生的 Children 也同为 DummyRecorder
//
// 	2. 被采样的 Recorder
//		这种 Recorder 会持久化所有数据，且会向后传递 trace 信息和采样标记
//
// 	3. 未采样的 Recorder
//		这种 Recorder 不会持久化任何数据，且会向后传递 trace 信息和未采样标记
//
// [并发安全]
type Recorder struct {
	span      *Span
	collector Collector

	referCnt int32
	onFinish func()

	finished bool

	lock  sync.Mutex
	dummy bool
}

var DummyRecorder = NewDummyRecorder()

func NewDummyRecorder() *Recorder {
	return &Recorder{
		span:      NewRootSpan(),
		collector: DummyCollector,
		dummy:     true,
	}
}

func NewRecorder(span *Span, c Collector) *Recorder {
	if c == nil {
		panic("Collector can not be nil")
	}
	return &Recorder{
		span:      span,
		collector: c,
		referCnt:  1,
	}
}

func (r *Recorder) OnFinish(f func()) {
	if r.dummy {
		return
	}
	r.lock.Lock()
	defer r.lock.Unlock()

	if r.finished {
		return
	}
	r.onFinish = f
}

func (r *Recorder) Child() *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()

	return NewRecorder(NewSpan(r.span), r.collector)
}

func (r *Recorder) Shadow() *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()

	id := *(r.span.SpanID)
	return NewRecorder(NewSpanWith(&id), r.collector)
}

func (r *Recorder) Service(service string) *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	r.span.Service = service
	return r
}

func (r *Recorder) Hostname(host string) *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	r.span.Node.Hostname = host
	return r
}

func (r *Recorder) Team(team string) *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	r.span.Team = team
	return r
}

func (r *Recorder) Mode(mode string) *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	r.span.Mode = mode
	return r
}

func (r *Recorder) Client() *Recorder {
	return r.Mode(MODE_CLIENT)
}

func (r *Recorder) Server() *Recorder {
	return r.Mode(MODE_SERVER)
}

func (r *Recorder) Async() *Recorder {
	return r.Mode(MODE_ASYNC)
}

// 设置该 Recorder 的 SpanName，若 SpanName 已被设置，则覆盖
//
func (r *Recorder) Name(name string) *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	r.span.SpanName = name
	return r
}

// 设置该 Recorder 的 SpanName（仅当原来 SpanName 未被设置过）
//
func (r *Recorder) NameOnce(name string) *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished || r.span.SpanName != "" {
		return r
	}
	r.span.SpanName = name
	return r
}

func (r *Recorder) Log(msg string) *Recorder {
	delta := time.Now().UnixNano()/1000 - r.span.Timestamp
	return r.annotateTS(&TinyEvent{
		S: &delta,
		V: msg,
	})
}

func (r *Recorder) LogAt(msg string, ts time.Time) *Recorder {
	delta := ts.UnixNano()/1000 - r.span.Timestamp
	return r.annotateTS(&TinyEvent{
		S: &delta,
		V: msg,
	})
}

func (r *Recorder) Kv(k, v string) *Recorder {
	return r.annotateKV(cleanString(k), &TinyEvent{
		V: v,
	})
}

func (r *Recorder) Tag(tag, v string) *Recorder {
	return r.annotateTag(cleanString(tag), &TinyEvent{
		V: v,
	})
}

func (r *Recorder) Prof(v string, s, e time.Time) *Recorder {
	delta1 := s.UnixNano()/1000 - r.span.Timestamp
	delta2 := e.Sub(s).Nanoseconds() / 1000
	return r.annotateTS(&TinyEvent{
		S: &delta1,
		E: &delta2,
		V: v,
	})
}

func (r *Recorder) ProfKv(k, v string, s, e time.Time) *Recorder {
	delta1 := s.UnixNano()/1000 - r.span.Timestamp
	delta2 := e.Sub(s).Nanoseconds() / 1000
	return r.annotateKV(k, &TinyEvent{
		S: &delta1,
		E: &delta2,
		V: v,
	})
}

func (r *Recorder) ProfTag(tag, v string, s, e time.Time) *Recorder {
	delta1 := s.UnixNano()/1000 - r.span.Timestamp
	delta2 := e.Sub(s).Nanoseconds() / 1000
	return r.annotateTag(tag, &TinyEvent{
		S: &delta1,
		E: &delta2,
		V: v,
	})
}

// 将一个 go 对象 marshal 成 KVAnnotations(无时间戳)/TSAnnotations 形式
//
func (r *Recorder) FlattenKV(prefix string, v interface{}) *Recorder {
	if !r.span.Sampled() || r.dummy {
		return r
	}
	flattenValue(prefix, reflect.ValueOf(v), func(k, v string) {
		r.annotateKV(k, &TinyEvent{
			V: v,
		})
	}, func(t time.Time, v string) {
		h := t.UnixNano() / 1000
		r.annotateTS(&TinyEvent{
			S: &h,
			V: v,
		})
	})
	return r
}

func cleanString(s string) string {
	for i, b := range s {
		if b == '_' {
			continue
		}
		return s[i:]
	}
	return ""
}

var ErrTooManyAnnos = &KVAnnotation{
	Key: "_error",
	TinyEvent: &TinyEvent{
		V: "too many annotations",
	},
}

func (r *Recorder) annotateTS(e *TinyEvent) *Recorder {
	if !r.span.Sampled() || r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	if r.span.Len() == MaxAnnotations-1 {
		r.span.KV = append(r.span.KV, ErrTooManyAnnos)
		return r
	} else if r.span.Len() >= MaxAnnotations {
		return r
	}
	if len(e.V) > MaxAnnoBytes {
		e.V = e.V[:MaxAnnoBytes-3] + "..."
	}
	r.span.TS = append(r.span.TS, e)
	return r
}

func (r *Recorder) annotateKV(k string, e *TinyEvent) *Recorder {
	if !r.span.Sampled() || r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}
	if r.span.Len() == MaxAnnotations-1 {
		r.span.KV = append(r.span.KV, ErrTooManyAnnos)
		return r
	} else if r.span.Len() >= MaxAnnotations {
		return r
	}
	if len(e.V) > MaxAnnoBytes {
		e.V = e.V[:MaxAnnoBytes-3] + "..."
	}
	r.span.KV = append(r.span.KV, &KVAnnotation{
		Key:       k,
		TinyEvent: e,
	})
	return r
}

func (r *Recorder) annotateTag(tag string, e *TinyEvent) *Recorder {
	if !r.span.Sampled() || r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()
	if r.finished {
		return r
	}

	_, ok := r.span.Tag[tag]
	if !ok {
		if r.span.Len() == MaxAnnotations-1 {
			r.span.KV = append(r.span.KV, ErrTooManyAnnos)
			return r
		} else if r.span.Len() >= MaxAnnotations {
			return r
		}
	}
	if len(e.V) > MaxAnnoBytes {
		e.V = e.V[:MaxAnnoBytes-3] + "..."
	}
	r.span.Tag[tag] = e
	return r
}

func (r *Recorder) Reference() *Recorder {
	if r.dummy {
		return r
	}
	r.lock.Lock()
	defer r.lock.Unlock()

	r.referCnt++
	return r
}

func (r *Recorder) Finish() {
	if r.dummy {
		return
	}
	r.lock.Lock()
	defer r.lock.Unlock()

	r.referCnt--
	if r.referCnt != 0 {
		return
	}
	r.span.Finish()
	if r.span.Sampled() {
		r.safeCollect(r.span)
	}
	if r.onFinish != nil {
		r.onFinish()
	}
	r.finished = true
}

func (r *Recorder) safeCollect(span *Span) {
	defer func() { recover() }()
	r.collector.Collect(span)
}

func (r *Recorder) ContextToken() string {
	if r.dummy {
		return ""
	}
	return r.span.ContextToken()
}

func (r *Recorder) Inject(objs ...interface{}) {
	if r.dummy {
		return
	}
	token := r.span.ContextToken()

	for _, obj := range objs {
		switch v := obj.(type) {
		case *http.Request:
			v.Header.Set(TraceHeaderKey, token)
		case http.ResponseWriter:
			v.Header().Set(TraceHeaderKey, token)
		}
	}
}
