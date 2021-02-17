package sockjs

import (
	"fmt"
	"io"
	"net/http"
)

func (h *Handler) eventSource(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("content-type", "text/event-stream; charset=UTF-8")
	_, _ = fmt.Fprint(rw, "\r\n")
	rw.(http.Flusher).Flush()

	recv := newHTTPReceiver(rw, req, h.options.ResponseLimit, new(eventSourceFrameWriter), ReceiverTypeEventSource)
	sess, err := h.sessionByRequest(req)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := sess.attachReceiver(recv); err != nil {
		if err := recv.sendFrame(cFrame); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		recv.close()
		return
	}
	sess.startHandlerOnce.Do(func() { go h.handlerFunc(Session{sess}) })
	select {
	case <-recv.doneNotify():
	case <-recv.interruptedNotify():
	}
}

type eventSourceFrameWriter struct{}

func (*eventSourceFrameWriter) write(w io.Writer, frame string) (int, error) {
	return fmt.Fprintf(w, "data: %s\r\n\r\n", frame)
}
