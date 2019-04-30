package chromedp

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/chromedp/cdproto"
	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/cdproto/target"
	jlexer "github.com/mailru/easyjson/jlexer"
)

// Browser is the high-level Chrome DevTools Protocol browser manager, handling
// the browser process runner, WebSocket clients, associated targets, and
// network, page, and DOM events.
type Browser struct {
	// LostConnection is closed when the websocket connection to Chrome is
	// dropped. This can be useful to make sure that Browser's context is
	// cancelled (and the handler stopped) once the connection has failed.
	LostConnection chan struct{}

	conn Transport

	// next is the next message id.
	next int64

	// newTabQueue is the queue used to create new target handlers, once a new
	// tab is created and attached to. The newly created Target is sent back
	// via newTabResult.
	newTabQueue chan *Target

	// delTabQueue is used to clean up target handlers after the sessions
	// are detached.
	delTabQueue chan target.SessionID

	// cmdQueue is the outgoing command queue.
	cmdQueue chan cmdJob

	// logging funcs
	logf func(string, ...interface{})
	errf func(string, ...interface{})
	dbgf func(string, ...interface{})

	// The optional fields below are helpful for some tests.

	// process can be initialized by the allocators which start a process
	// when allocating a browser.
	process *os.Process

	// userDataDir can be initialized by the allocators which set up user
	// data dirs directly.
	userDataDir string
}

type cmdJob struct {
	// msg is the message being sent.
	msg *cdproto.Message

	// resp is the channel to send the response to; must be non-nil.
	resp chan *cdproto.Message

	// respID is the ID to receive a response in resp for. If zero, msg.ID
	// is used. If non-zero and different than msg.ID, msg.ID's response is
	// discarded.
	respID int64
}

// NewBrowser creates a new browser.
func NewBrowser(ctx context.Context, urlstr string, opts ...BrowserOption) (*Browser, error) {
	b := &Browser{
		LostConnection: make(chan struct{}),

		newTabQueue: make(chan *Target),
		delTabQueue: make(chan target.SessionID, 1),

		// Fit some jobs without blocking, to reduce blocking in
		// Execute.
		cmdQueue: make(chan cmdJob, 32),

		logf: log.Printf,
	}
	// apply options
	for _, o := range opts {
		o(b)
	}
	// ensure errf is set
	if b.errf == nil {
		b.errf = func(s string, v ...interface{}) { b.logf("ERROR: "+s, v...) }
	}

	// dial
	var err error
	b.conn, err = DialContext(ctx, forceIP(urlstr), WithConnDebugf(b.dbgf))
	if err != nil {
		return nil, err
	}

	go b.run(ctx)
	return b, nil
}

// forceIP forces the host component in urlstr to be an IP address.
//
// Since Chrome 66+, Chrome DevTools Protocol clients connecting to a browser
// must send the "Host:" header as either an IP address, or "localhost".
func forceIP(urlstr string) string {
	if i := strings.Index(urlstr, "://"); i != -1 {
		scheme := urlstr[:i+3]
		host, port, path := urlstr[len(scheme)+3:], "", ""
		if i := strings.Index(host, "/"); i != -1 {
			host, path = host[:i], host[i:]
		}
		if i := strings.Index(host, ":"); i != -1 {
			host, port = host[:i], host[i:]
		}
		if addr, err := net.ResolveIPAddr("ip", host); err == nil {
			urlstr = scheme + addr.IP.String() + port + path
		}
	}
	return urlstr
}

func (b *Browser) newExecutorForTarget(ctx context.Context, targetID target.ID, sessionID target.SessionID) *Target {
	if targetID == "" {
		panic("empty target ID")
	}
	if sessionID == "" {
		panic("empty session ID")
	}
	t := &Target{
		browser:   b,
		TargetID:  targetID,
		SessionID: sessionID,

		eventQueue: make(chan *cdproto.Message, 1024),
		waitQueue:  make(chan func() bool, 1024),
		frames:     make(map[cdp.FrameID]*cdp.Frame),

		logf: b.logf,
		errf: b.errf,

		tick: make(chan time.Time, 1),
	}
	go t.run(ctx)
	// This send should be blocking, to ensure the tab is inserted into the
	// map before any more target events are routed.
	b.newTabQueue <- t
	return t
}

func (b *Browser) Execute(ctx context.Context, method string, params json.Marshaler, res json.Unmarshaler) error {
	paramsMsg := emptyObj
	if params != nil {
		var err error
		if paramsMsg, err = json.Marshal(params); err != nil {
			return err
		}
	}

	id := atomic.AddInt64(&b.next, 1)
	ch := make(chan *cdproto.Message, 1)
	b.cmdQueue <- cmdJob{
		msg: &cdproto.Message{
			ID:     id,
			Method: cdproto.MethodType(method),
			Params: paramsMsg,
		},
		resp: ch,
	}
	select {
	case msg := <-ch:
		switch {
		case msg == nil:
			return ErrChannelClosed
		case msg.Error != nil:
			return msg.Error
		case res != nil:
			return json.Unmarshal(msg.Result, res)
		}
	case <-ctx.Done():
		return ctx.Err()
	}
	return nil
}

type tabEvent struct {
	sessionID target.SessionID
	msg       *cdproto.Message
}

//go:generate easyjson browser.go

//easyjson:json
type eventReceivedMessageFromTarget struct {
	SessionID target.SessionID `json:"sessionId"`
	Message   messageString    `json:"message"`
}

type messageString struct {
	lexer jlexer.Lexer // to avoid an alloc
	M     cdproto.Message
}

func (m *messageString) UnmarshalEasyJSON(l *jlexer.Lexer) {
	if l.IsNull() {
		l.Skip()
	} else {
		l.AddError(unmarshal(&m.lexer, l.UnsafeBytes(), &m.M))
	}
}

func (b *Browser) run(ctx context.Context) {
	defer b.conn.Close()

	// tabEventQueue is the queue of incoming target events, to be routed by
	// their session ID.
	tabEventQueue := make(chan tabEvent, 1)

	// resQueue is the incoming command result queue.
	resQueue := make(chan *cdproto.Message, 1)

	// This goroutine continuously reads events from the websocket
	// connection. The separate goroutine is needed since a websocket read
	// is blocking, so it cannot be used in a select statement.
	go func() {
		// Reuse the space for the read message, since in some cases
		// like EventTargetReceivedMessageFromTarget we throw it away.
		lexer := new(jlexer.Lexer)
		readMsg := new(cdproto.Message)
		for {
			*readMsg = cdproto.Message{}
			if err := b.conn.Read(ctx, readMsg); err != nil {
				// If the websocket failed, most likely Chrome
				// was closed or crashed. Signal that so the
				// entire browser handler can be stopped.
				close(b.LostConnection)
				return
			}
			if readMsg.Method == cdproto.EventRuntimeExceptionThrown {
				ev := new(runtime.EventExceptionThrown)
				if err := unmarshal(lexer, readMsg.Params, ev); err != nil {
					b.errf("%s", err)
					continue
				}
				b.errf("%+v\n", ev.ExceptionDetails)
				continue
			}

			var msg *cdproto.Message
			var sessionID target.SessionID
			if readMsg.Method == cdproto.EventTargetReceivedMessageFromTarget {
				ev := new(eventReceivedMessageFromTarget)
				if err := unmarshal(lexer, readMsg.Params, ev); err != nil {
					b.errf("%s", err)
					continue
				}
				sessionID = ev.SessionID
				msg = &ev.Message.M
			} else {
				// We're passing along readMsg to another
				// goroutine, so we must make a copy of it.
				msg = new(cdproto.Message)
				*msg = *readMsg
			}
			switch {
			case msg.Method != "":
				if sessionID == "" {
					switch msg.Method {
					case cdproto.EventTargetDetachedFromTarget:
						var ev target.EventDetachedFromTarget
						if err := unmarshal(lexer, readMsg.Params, &ev); err != nil {
							b.errf("%s", err)
							continue
						}
						b.delTabQueue <- ev.SessionID
					default:
						// TODO: are any other browser
						// events useful?
					}
					continue
				}
				tabEventQueue <- tabEvent{
					sessionID: sessionID,
					msg:       msg,
				}
			case msg.ID != 0:
				// We can't process the response here, as it's
				// another goroutine that maintans respByID.
				resQueue <- msg
			default:
				b.errf("ignoring malformed incoming message (missing id or method): %#v", msg)
			}
		}
	}()

	// This goroutine handles tabs, as well as routing events to each tab
	// via the pages map.
	go func() {
		ticker := time.NewTicker(2 * time.Millisecond)
		defer ticker.Stop()

		// This map is only safe for use within this goroutine, so don't
		// declare it as a Browser field.
		pages := make(map[target.SessionID]*Target, 32)
		for {
			select {
			case t := <-b.newTabQueue:
				if _, ok := pages[t.SessionID]; ok {
					b.errf("executor for %q already exists", t.SessionID)
				}
				pages[t.SessionID] = t

			case event := <-tabEventQueue:
				page, ok := pages[event.sessionID]
				if !ok {
					b.errf("unknown session ID %q", event.sessionID)
					continue
				}
				select {
				case page.eventQueue <- event.msg:
				default:
					panic("eventQueue is full")
				}

			case sessionID := <-b.delTabQueue:
				if _, ok := pages[sessionID]; !ok {
					b.errf("executor for %q doesn't exist", sessionID)
				}
				delete(pages, sessionID)

			case t := <-ticker.C:
				// Roughly once every 2ms, give every target a
				// chance to run periodic work like checking if
				// a wait function is complete.
				//
				// If a target hasn't picked up the previous
				// tick, skip it.
				for _, target := range pages {
					select {
					case target.tick <- t:
					default:
					}
				}

			case <-ctx.Done():
				return
			}
		}
	}()

	respByID := make(map[int64]chan *cdproto.Message)

	// This goroutine handles sending commands to the browser, and sending
	// responses back for each of these commands via respByID.
	for {
		select {
		case res := <-resQueue:
			resp, ok := respByID[res.ID]
			if !ok {
				b.errf("id %d not present in response map", res.ID)
				continue
			}
			if resp != nil {
				// resp could be nil, if we're not interested in
				// this response; for CommandSendMessageToTarget.
				resp <- res
				close(resp)
			}
			delete(respByID, res.ID)

		case q := <-b.cmdQueue:
			if _, ok := respByID[q.msg.ID]; ok {
				b.errf("id %d already present in response map", q.msg.ID)
				continue
			}
			if q.respID > 0 {
				respByID[q.msg.ID] = nil // discard this response
				respByID[q.respID] = q.resp
			} else {
				respByID[q.msg.ID] = q.resp
			}

			if err := b.conn.Write(ctx, q.msg); err != nil {
				b.errf("%s", err)
				continue
			}

		case <-b.LostConnection:
			return
		case <-ctx.Done():
			return
		}
	}
}

// BrowserOption is a browser option.
type BrowserOption func(*Browser)

// WithBrowserLogf is a browser option to specify a func to receive general logging.
func WithBrowserLogf(f func(string, ...interface{})) BrowserOption {
	return func(b *Browser) { b.logf = f }
}

// WithBrowserErrorf is a browser option to specify a func to receive error logging.
func WithBrowserErrorf(f func(string, ...interface{})) BrowserOption {
	return func(b *Browser) { b.errf = f }
}

// WithBrowserDebugf is a browser option to specify a func to log actual
// websocket messages.
func WithBrowserDebugf(f func(string, ...interface{})) BrowserOption {
	return func(b *Browser) { b.dbgf = f }
}

// WithConsolef is a browser option to specify a func to receive chrome log events.
//
// Note: NOT YET IMPLEMENTED.
func WithConsolef(f func(string, ...interface{})) BrowserOption {
	return func(b *Browser) {
	}
}
