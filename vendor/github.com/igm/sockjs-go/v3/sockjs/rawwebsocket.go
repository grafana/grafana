package sockjs

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

func (h *Handler) rawWebsocket(rw http.ResponseWriter, req *http.Request) {
	upgrader := h.options.WebsocketUpgrader
	if upgrader == nil {
		upgrader = new(websocket.Upgrader)
	}
	conn, err := upgrader.Upgrade(rw, req, nil)
	if err != nil {
		return
	}

	sessID := ""
	sess := newSession(req, sessID, h.options.DisconnectDelay, h.options.HeartbeatDelay)
	sess.raw = true

	receiver := newRawWsReceiver(conn, h.options.WebsocketWriteTimeout)
	if err := sess.attachReceiver(receiver); err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	if h.handlerFunc != nil {
		go h.handlerFunc(Session{sess})
	}
	readCloseCh := make(chan struct{})
	go func() {
		for {
			frameType, p, err := conn.ReadMessage()
			if err != nil {
				close(readCloseCh)
				return
			}
			if frameType == websocket.TextMessage || frameType == websocket.BinaryMessage {
				if err := sess.accept(string(p)); err != nil {
					close(readCloseCh)
					return
				}
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

type rawWsReceiver struct {
	conn         *websocket.Conn
	closeCh      chan struct{}
	writeTimeout time.Duration
}

func newRawWsReceiver(conn *websocket.Conn, writeTimeout time.Duration) *rawWsReceiver {
	return &rawWsReceiver{
		conn:         conn,
		closeCh:      make(chan struct{}),
		writeTimeout: writeTimeout,
	}
}

func (w *rawWsReceiver) sendBulk(messages ...string) error {
	if len(messages) > 0 {
		for _, m := range messages {
			if w.writeTimeout != 0 {
				if err := w.conn.SetWriteDeadline(time.Now().Add(w.writeTimeout)); err != nil {
					w.close()
					return err
				}
			}
			if err := w.conn.WriteMessage(websocket.TextMessage, []byte(m)); err != nil {
				w.close()
				return err
			}

		}
	}
	return nil
}

func (w *rawWsReceiver) sendFrame(frame string) error {
	if w.writeTimeout != 0 {
		if err := w.conn.SetWriteDeadline(time.Now().Add(w.writeTimeout)); err != nil {
			w.close()
			return err
		}
	}
	if frame == "h" {
		if err := w.conn.WriteMessage(websocket.PingMessage, []byte{}); err != nil {
			w.close()
			return err
		}
	} else if len(frame) > 0 && frame[0] == 'c' {
		status, reason, err := parseCloseFrame(frame)
		if err != nil {
			w.close()
			return err
		}
		msg := websocket.FormatCloseMessage(int(status), reason)
		if err := w.conn.WriteMessage(websocket.CloseMessage, msg); err != nil {
			w.close()
			return err
		}
	} else {
		if err := w.conn.WriteMessage(websocket.TextMessage, []byte(frame)); err != nil {
			w.close()
			return err
		}
	}
	return nil
}

func (w *rawWsReceiver) receiverType() ReceiverType {
	return ReceiverTypeRawWebsocket
}

func parseCloseFrame(frame string) (status uint32, reason string, err error) {
	var items [2]interface{}
	if err := json.Unmarshal([]byte(frame)[1:], &items); err != nil {
		return 0, "", err
	}
	statusF, _ := items[0].(float64)
	status = uint32(statusF)
	reason, _ = items[1].(string)
	return
}

func (w *rawWsReceiver) close() {
	select {
	case <-w.closeCh: // already closed
	default:
		close(w.closeCh)
	}
}
func (w *rawWsReceiver) canSend() bool {
	select {
	case <-w.closeCh: // already closed
		return false
	default:
		return true
	}
}
func (w *rawWsReceiver) doneNotify() <-chan struct{}        { return w.closeCh }
func (w *rawWsReceiver) interruptedNotify() <-chan struct{} { return nil }
