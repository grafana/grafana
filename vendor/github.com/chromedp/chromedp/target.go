package chromedp

import (
	"context"
	"encoding/json"
	"strings"
	"sync/atomic"
	"time"

	"github.com/mailru/easyjson"

	"github.com/chromedp/cdproto"
	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/dom"
	"github.com/chromedp/cdproto/inspector"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/cdproto/target"
)

// Target manages a Chrome DevTools Protocol target.
type Target struct {
	browser   *Browser
	SessionID target.SessionID
	TargetID  target.ID

	waitQueue  chan func() bool
	eventQueue chan *cdproto.Message

	// below are the old TargetHandler fields.

	// frames is the set of encountered frames.
	frames map[cdp.FrameID]*cdp.Frame

	// cur is the current top level frame.
	cur *cdp.Frame

	// logging funcs
	logf, errf func(string, ...interface{})

	tick chan time.Time
}

func (t *Target) run(ctx context.Context) {
	// tryWaits runs all wait functions on the current top-level frame, if
	// neither are empty.
	//
	// This function is run after each DOM event, since those are the vast
	// majority that we wait on, and approximately every 5ms. The periodic
	// runs are necessary to wait for events such as a node no longer being
	// visible in Chrome.
	tryWaits := func() {
		n := len(t.waitQueue)
		if n == 0 || t.cur == nil {
			return
		}
		for i := 0; i < n; i++ {
			fn := <-t.waitQueue
			if !fn() {
				// try again later.
				t.waitQueue <- fn
			}
		}
	}

	for {
		select {
		case msg := <-t.eventQueue:
			if err := t.processEvent(ctx, msg); err != nil {
				t.errf("could not process event: %v", err)
				continue
			}
			if msg.Method.Domain() == "DOM" {
				tryWaits()
			}
		case <-t.tick:
			tryWaits()
		case <-ctx.Done():
			return
		}
	}
}

func (t *Target) Execute(ctx context.Context, method string, params json.Marshaler, res json.Unmarshaler) error {
	paramsMsg := emptyObj
	if params != nil {
		var err error
		if paramsMsg, err = json.Marshal(params); err != nil {
			return err
		}
	}
	innerID := atomic.AddInt64(&t.browser.next, 1)
	msg := &cdproto.Message{
		ID:     innerID,
		Method: cdproto.MethodType(method),
		Params: paramsMsg,
	}
	msgJSON, err := easyjson.Marshal(msg)
	if err != nil {
		return err
	}
	sendParams := target.SendMessageToTarget(string(msgJSON)).
		WithSessionID(t.SessionID)
	sendParamsJSON, _ := easyjson.Marshal(sendParams)

	ch := make(chan *cdproto.Message, 1)
	outerID := atomic.AddInt64(&t.browser.next, 1)
	t.browser.cmdQueue <- cmdJob{
		msg: &cdproto.Message{
			ID:     outerID,
			Method: target.CommandSendMessageToTarget,
			Params: sendParamsJSON,
		},
		// We want to grab the response from the inner message.
		resp:   ch,
		respID: innerID,
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

// below are the old TargetHandler methods.

// processEvent processes an incoming event.
func (t *Target) processEvent(ctx context.Context, msg *cdproto.Message) error {
	if msg == nil {
		return ErrChannelClosed
	}
	// unmarshal
	ev, err := cdproto.UnmarshalMessage(msg)
	if err != nil {
		if strings.Contains(err.Error(), "unknown command or event") {
			// This is most likely an event received from an older
			// Chrome which a newer cdproto doesn't have, as it is
			// deprecated. Ignore that error.
			// TODO: use error wrapping once Go 1.13 is released.
			return nil
		}
		return err
	}

	switch ev.(type) {
	case *inspector.EventDetached:
		return nil
	case *dom.EventDocumentUpdated:
		t.documentUpdated(ctx)
		return nil
	}

	switch msg.Method.Domain() {
	case "Page":
		t.pageEvent(ev)
	case "DOM":
		t.domEvent(ev)
	}
	return nil
}

// documentUpdated handles the document updated event, retrieving the document
// root for the root frame.
func (t *Target) documentUpdated(ctx context.Context) {
	f := t.cur
	f.Lock()
	defer f.Unlock()

	// invalidate nodes
	if f.Root != nil {
		close(f.Root.Invalidated)
	}

	f.Nodes = make(map[cdp.NodeID]*cdp.Node)
	var err error
	f.Root, err = dom.GetDocument().WithPierce(true).Do(ctx, t)
	if err == context.Canceled {
		return // TODO: perhaps not necessary, but useful to keep the tests less noisy
	}
	if err != nil {
		t.errf("could not retrieve document root for %s: %v", f.ID, err)
		return
	}
	f.Root.Invalidated = make(chan struct{})
	walk(f.Nodes, f.Root)
}

// emptyObj is an empty JSON object message.
var emptyObj = easyjson.RawMessage([]byte(`{}`))

// pageEvent handles incoming page events.
func (t *Target) pageEvent(ev interface{}) {
	var id cdp.FrameID
	var op frameOp

	switch e := ev.(type) {
	case *page.EventFrameNavigated:
		t.frames[e.Frame.ID] = e.Frame
		if e.Frame.ParentID == "" {
			// This frame is only the new top-level frame if it has
			// no parent.
			t.cur = e.Frame
		}
		return

	case *page.EventFrameAttached:
		id, op = e.FrameID, frameAttached(e.ParentFrameID)

	case *page.EventFrameDetached:
		id, op = e.FrameID, frameDetached

	case *page.EventFrameStartedLoading:
		id, op = e.FrameID, frameStartedLoading

	case *page.EventFrameStoppedLoading:
		id, op = e.FrameID, frameStoppedLoading

		// ignored events
	case *page.EventFrameRequestedNavigation:
		return
	case *page.EventDomContentEventFired:
		return
	case *page.EventLoadEventFired:
		return
	case *page.EventFrameResized:
		return
	case *page.EventLifecycleEvent:
		return
	case *page.EventNavigatedWithinDocument:
		return

	default:
		t.errf("unhandled page event %T", ev)
		return
	}

	f := t.frames[id]
	if f == nil {
		// This can happen if a frame is attached or starts loading
		// before it's ever navigated to. We won't have all the frame
		// details just yet, but that's okay.
		f = &cdp.Frame{ID: id}
		t.frames[id] = f
	}

	f.Lock()
	defer f.Unlock()

	op(f)
}

// domEvent handles incoming DOM events.
func (t *Target) domEvent(ev interface{}) {
	f := t.cur

	var id cdp.NodeID
	var op nodeOp

	switch e := ev.(type) {
	case *dom.EventSetChildNodes:
		id, op = e.ParentID, setChildNodes(f.Nodes, e.Nodes)

	case *dom.EventAttributeModified:
		id, op = e.NodeID, attributeModified(e.Name, e.Value)

	case *dom.EventAttributeRemoved:
		id, op = e.NodeID, attributeRemoved(e.Name)

	case *dom.EventInlineStyleInvalidated:
		if len(e.NodeIds) == 0 {
			return
		}

		id, op = e.NodeIds[0], inlineStyleInvalidated(e.NodeIds[1:])

	case *dom.EventCharacterDataModified:
		id, op = e.NodeID, characterDataModified(e.CharacterData)

	case *dom.EventChildNodeCountUpdated:
		id, op = e.NodeID, childNodeCountUpdated(e.ChildNodeCount)

	case *dom.EventChildNodeInserted:
		id, op = e.ParentNodeID, childNodeInserted(f.Nodes, e.PreviousNodeID, e.Node)

	case *dom.EventChildNodeRemoved:
		id, op = e.ParentNodeID, childNodeRemoved(f.Nodes, e.NodeID)

	case *dom.EventShadowRootPushed:
		id, op = e.HostID, shadowRootPushed(f.Nodes, e.Root)

	case *dom.EventShadowRootPopped:
		id, op = e.HostID, shadowRootPopped(f.Nodes, e.RootID)

	case *dom.EventPseudoElementAdded:
		id, op = e.ParentID, pseudoElementAdded(f.Nodes, e.PseudoElement)

	case *dom.EventPseudoElementRemoved:
		id, op = e.ParentID, pseudoElementRemoved(f.Nodes, e.PseudoElementID)

	case *dom.EventDistributedNodesUpdated:
		id, op = e.InsertionPointID, distributedNodesUpdated(e.DistributedNodes)

	default:
		t.errf("unhandled node event %T", ev)
		return
	}

	n, ok := f.Nodes[id]
	if !ok {
		// Node ID has been invalidated. Nothing to do.
		return
	}

	f.Lock()
	defer f.Unlock()

	op(n)
}

type TargetOption func(*Target)
