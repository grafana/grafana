package trace

import (
	"net/http"
	"os"
	"path"
	"sync"

	"github.com/qiniu/log.v1"
)

type Tracer struct {
	sampler   Sampler
	collector Collector

	team     string
	service  string
	hostname string

	recs map[spanID]*Recorder

	enable bool
	lock   sync.Mutex
}

// tracer options

func SetCollector(c Collector) func(*Tracer) {
	return func(t *Tracer) { t.collector = c }
}

func SetSampler(s Sampler) func(*Tracer) {
	return func(t *Tracer) { t.sampler = s }
}

func SetService(srv string) func(*Tracer) {
	return func(t *Tracer) { t.service = srv }
}

func SetTeam(team string) func(*Tracer) {
	return func(t *Tracer) { t.team = team }
}

func NewTracer(opts ...func(*Tracer)) *Tracer {

	hn, _ := os.Hostname()
	t := &Tracer{
		collector: DummyCollector,
		sampler:   DummySampler,
		hostname:  hn,
		service:   path.Base(os.Args[0]),
		recs:      make(map[spanID]*Recorder),
	}
	for _, opt := range opts {
		opt(t)
	}
	return t
}

func (t *Tracer) Enable() *Tracer {
	t.enable = true
	return t
}

func (t *Tracer) recorder(id *SpanID, create bool) (rec *Recorder) {
	t.lock.Lock()
	rec, ok := t.recs[id.spanID]
	if ok {
		if create {
			t.lock.Unlock()
			// NOTE: rec.Reference() 会占用 rec.lock，若处在 t.lock 中，会引发死锁
			return rec.Reference()
		}
		t.lock.Unlock()
		return rec
	}
	defer t.lock.Unlock()

	if !create {
		return DummyRecorder
	}
	rec = NewRecorder(NewSpanWith(id), t.collector)

	// NOTE: OnFinish() 也会占用 rec.lock，但由于是新创建的 rec，该占用动作无害
	rec.Service(t.service).Hostname(t.hostname).Team(t.team).OnFinish(func() {
		t.lock.Lock()
		delete(t.recs, id.spanID)
		t.lock.Unlock()
	})
	t.recs[id.spanID] = rec
	return rec
}

// 获取一个 Recorder：
//
// 1. 根据 req 获取 SpanID（若 req 中无 Span 信息则生成）
// 2. 根据 SpanID 生成新的 Recorder
//
// 使用该方法新建的 Recorder 需调用 Finish() 以通知 Recorder 结束记录
//
func (t *Tracer) FromHTTP(req *http.Request) *Recorder {
	if !t.enable || req == nil {
		return DummyRecorder
	}
	span := SpanIDFromHTTP(req)
	if span == nil {
		span = NewRootSpanID()
		if t.sampler.Sample() {
			span.Sample()
		}
		SetHTTPSpanID(span, req, nil)
	}
	rec := t.recorder(span, true)
	return rec
}

// 尝试获取一个 Recorder 的引用：
//
// 1. 根据 req 获取 SpanID（若 req 中无 Span 信息则返回 DummyRecorder）
// 2. 根据 SpanID 获取到对应的 Recoder
// 3. 如果没有 Recorder 存在，则返回 DummyRecorder
// 4. 如果该 SpanID 已存在 Recorder，则直接返回该 Recorder
//
// 使用该方法获取到的 Recorder 无需调用 Finish()
//
func (t *Tracer) RefFromHTTP(req *http.Request) *Recorder {
	if !t.enable || req == nil {
		return DummyRecorder
	}
	span := SpanIDFromHTTP(req)
	if span == nil {
		return DummyRecorder
	}
	return t.recorder(span, false)
}

// 从一个 ContextToken 获取对应的 Recorder
//
func (t *Tracer) FromContextToken(tctx string) *Recorder {

	// token 为空相当于不存在父 Span，所以生成新的 RootSpan
	if len(tctx) == 0 {
		span := NewRootSpanID()
		if t.sampler.Sample() {
			span.Sample()
		}
		return t.recorder(span, true)
	}
	span, err := ParseContextToken(tctx)
	if err != nil {
		return DummyRecorder
	}
	return t.recorder(span, true)
}

func (t *Tracer) Close() error {
	return t.collector.Close()
}

//--------------------------------------------------------------
// Global functions for DefaultTracer

var DefaultTracer = NewTracer()

func TracerEnable(opts ...func(*Tracer)) {

	t := NewTracer(SetCollector(nil), SetSampler(nil))
	for _, opt := range opts {
		opt(t)
	}
	if t.sampler == nil {
		// 默认每秒最多采样一个点
		t.sampler = NewTokenRateSampler(1)
	}
	if t.collector == nil {
		c, err := NewServiceCollector("", t.service)
		if err != nil {
			log.Warn("fail to init collector for tracer:", err)
			return
		}
		t.collector = c
	}
	DefaultTracer = t.Enable()
}

func FromHTTP(req *http.Request) *Recorder {
	return DefaultTracer.FromHTTP(req)
}

func RefFromHTTP(req *http.Request) *Recorder {
	return DefaultTracer.RefFromHTTP(req)
}

func FromContextToken(tctx string) *Recorder {
	return DefaultTracer.FromContextToken(tctx)
}
