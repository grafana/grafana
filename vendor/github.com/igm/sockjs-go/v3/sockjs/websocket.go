package sockjs

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

func (h *Handler) sockjsWebsocket(rw http.ResponseWriter, req *http.Request) {
	upgrader := h.options.WebsocketUpgrader
	if upgrader == nil {
		upgrader = new(websocket.Upgrader)
	}
	conn, err := upgrader.Upgrade(rw, req, nil)
	if err != nil {
		return
	}
	sessID, _ := h.parseSessionID(req.URL)
	sess := newSession(req, sessID, h.options.DisconnectDelay, h.options.HeartbeatDelay)
	receiver := newWsReceiver(conn, h.options.WebsocketWriteTimeout)
	if err := sess.attachReceiver(receiver); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	if h.handlerFunc != nil {
		go h.handlerFunc(Session{sess})
	}
	readCloseCh := make(chan struct{})
	go func() {
		var d []string
		for {
			err := conn.ReadJSON(&d)
			if err != nil {
				close(readCloseCh)
				return
			}
			if err := sess.accept(d...); err != nil {
				close(readCloseCh)
				return
			}
		}
	}()

	select {
	case <-readCloseCh:
	case <-receiver.doneNotify():
	}
	sess.close()
	if err := conn.Close(); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
}

type wsReceiver struct {
	conn         *websocket.Conn
	closeCh      chan struct{}
	writeTimeout time.Duration
}

func newWsReceiver(conn *websocket.Conn, writeTimeout time.Duration) *wsReceiver {
	return &wsReceiver{
		conn:         conn,
		closeCh:      make(chan struct{}),
		writeTimeout: writeTimeout,
	}
}

func (w *wsReceiver) sendBulk(messages ...string) error {
	if len(messages) > 0 {
		return w.sendFrame(fmt.Sprintf("a[%s]", strings.Join(transform(messages, quote), ",")))
	}
	return nil
}

func (w *wsReceiver) sendFrame(frame string) error {
	if w.writeTimeout != 0 {
		if err := w.conn.SetWriteDeadline(time.Now().Add(w.writeTimeout)); err != nil {
			w.close()
			return err
		}
	}
	if err := w.conn.WriteMessage(websocket.TextMessage, []byte(frame)); err != nil {
		w.close()
		return err
	}
	return nil
}

func (w *wsReceiver) close() {
	select {
	case <-w.closeCh: // already closed
	default:
		close(w.closeCh)
	}
}
func (w *wsReceiver) canSend() bool {
	select {
	case <-w.closeCh: // already closed
		return false
	default:
		return true
	}
}
func (w *wsReceiver) doneNotify() <-chan struct{}        { return w.closeCh }
func (w *wsReceiver) interruptedNotify() <-chan struct{} { return nil }
func (w *wsReceiver) receiverType() ReceiverType         { return ReceiverTypeWebsocket }
