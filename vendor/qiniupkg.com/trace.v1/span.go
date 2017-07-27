package trace

import (
	"errors"
	"strings"
	"time"
)

type Trace struct {
	Span
	Subs []*Trace
}

type spanID struct {
	Trace  ID `json:"t" trace:"t"`
	Span   ID `json:"s" trace:"s"`
	Parent ID `json:"p" trace:"p"`
}

func (sid *spanID) spanIDString() string {
	if sid.Parent == 0 {
		return sid.Trace.String() + "/" + sid.Span.String()
	}
	return sid.Trace.String() + "/" + sid.Span.String() + "/" + sid.Parent.String()
}

type Node struct {
	Hostname string `json:"hn" trace:"hn"`
}

type SpanID struct {
	spanID

	Mode      string `json:"md" trace:"md"`
	Timestamp int64  `json:"ts" trace:"ts"` // in us
	Duration  int64  `json:"du" trace:"du"` // in us
	SpanName  string `json:"name,omitempty" trace:"name,omitempty"`
	Team      string `json:"team,omitempty" trace:"team,omitempty"`
	Service   string `json:"svr" trace:"svr"`
	Node      Node   `json:"node" trace:"node"`

	sampled bool
}

const SpanIDDelimiter = "/"

var (
	ErrBadSpanContext = errors.New("bad span context")
)

// 用于生成该 Span 对应的 Context token 字符串，通常用于跨进程间的传递
//
func (id *SpanID) ContextToken() string {
	tid := id.spanIDString()
	if id.sampled {
		return tid + "|1"
	}
	return tid + "|0"
}

// 用于从 ContextToken() 生成的 Context token 字符串解析出 SpanID
//
func ParseContextToken(token string) (*SpanID, error) {

	parts := strings.Split(token, "|")
	if len(parts) != 2 {
		return nil, ErrBadSpanContext
	}
	sid, err := parseIDString(parts[0])
	if err != nil {
		return nil, err
	}

	var sample bool
	switch parts[1] {
	case "0":
		sample = false
	case "1":
		sample = true
	default:
		return nil, ErrBadSpanContext
	}

	return &SpanID{
		spanID:    *sid,
		Timestamp: time.Now().UnixNano() / 1000,
		sampled:   sample,
	}, nil
}

func parseIDString(s string) (*spanID, error) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 && len(parts) != 3 {
		return nil, ErrBadSpanContext
	}
	root, err := ParseID(parts[0])
	if err != nil {
		return nil, ErrBadSpanContext
	}
	id, err := ParseID(parts[1])
	if err != nil {
		return nil, ErrBadSpanContext
	}
	var parent ID
	if len(parts) == 3 {
		i, err := ParseID(parts[2])
		if err != nil {
			return nil, ErrBadSpanContext
		}
		parent = i
	}
	return &spanID{
		Trace:  root,
		Span:   id,
		Parent: parent,
	}, nil
}

func (id *SpanID) Sample() {
	id.sampled = true
}

func (id *SpanID) Sampled() bool {
	return id.sampled
}

func (id *SpanID) IsRoot() bool {
	return id.Parent == 0
}

func (id *SpanID) Finish() {
	id.Duration = time.Now().UnixNano()/1000 - id.Timestamp
}

func NewRootSpanID() *SpanID {
	return &SpanID{
		spanID: spanID{
			Trace: generateID(),
			Span:  generateID(),
		},
		Timestamp: time.Now().UnixNano() / 1000,
		sampled:   false,
	}
}

func NewSpanID(parent *SpanID) *SpanID {
	return &SpanID{
		spanID: spanID{
			Trace:  parent.Trace,
			Span:   generateID(),
			Parent: parent.Span,
		},
		Node:      parent.Node,
		Service:   parent.Service,
		Timestamp: time.Now().UnixNano() / 1000,
		sampled:   parent.sampled,
	}
}

// TinyEvent 代表在一个 span 的时间段内发生的一个用户自定义事件，其中：
//
//	1. S 表示该事件的发生时间相对于 span 开始时间的位移（in us）
//	2. E 表示该事件的结束时间相对于 S 的位移（in us）
//	3. V 用于该事件的标识字符
//
// S 和 E 被赋值的不同组合代表不同的含义:
//
// 	1. S == nil, E == nil 时，TinyEvent 等价于 V 的信息（无任何时间属性）
//	2. S != nil, E == nil 时，TinyEvent 等价于带 timestamp 的 V
//	3. S == nil, E != nil 时，同 2
//	4. S != nil, E != nil 时，TinyEvent 表示一个事件标识 V 的发生时间段
//
type TinyEvent struct {
	S *int64 `json:"s,omitempty"` // optional
	E *int64 `json:"e,omitempty"` // optional
	V string `json:"v,omitempty"` // optional
}

type KVAnnotation struct {
	Key string `json:"k"`
	*TinyEvent
}

type TSAnnotations []*TinyEvent
type KVAnnotations []*KVAnnotation
type TagAnnotations map[string]*TinyEvent

type Span struct {
	*SpanID `json:"id"`

	TS  TSAnnotations  `json:"ts,omitempty"`
	KV  KVAnnotations  `json:"kv,omitempty"`
	Tag TagAnnotations `json:"tag,omitempty"`
}

func (s *Span) Len() int {
	return len(s.TS) + len(s.KV) + len(s.Tag)
}

func NewRootSpan() *Span {
	return &Span{
		SpanID: NewRootSpanID(),
		Tag:    make(TagAnnotations),
	}
}

func NewSpan(parent *Span) *Span {
	return &Span{
		SpanID: NewSpanID(parent.SpanID),
		Tag:    make(TagAnnotations),
	}
}

func NewSpanWith(id *SpanID) *Span {
	return &Span{
		SpanID: id,
		Tag:    make(TagAnnotations),
	}
}
