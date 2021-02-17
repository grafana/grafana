package sockjs

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var (
	cFrame              = closeFrame(2010, "Another connection still open")
	xhrStreamingPrelude = strings.Repeat("h", 2048)
)

func (h *Handler) xhrSend(rw http.ResponseWriter, req *http.Request) {
	if req.Body == nil {
		httpError(rw, "Payload expected.", http.StatusBadRequest)
		return
	}
	var messages []string
	err := json.NewDecoder(req.Body).Decode(&messages)
	if err == io.EOF {
		httpError(rw, "Payload expected.", http.StatusBadRequest)
		return
	}
	if _, ok := err.(*json.SyntaxError); ok || err == io.ErrUnexpectedEOF {
		httpError(rw, "Broken JSON encoding.", http.StatusBadRequest)
		return
	}
	sessionID, err := h.parseSessionID(req.URL)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}

	h.sessionsMux.Lock()
	defer h.sessionsMux.Unlock()
	if sess, ok := h.sessions[sessionID]; !ok {
		http.NotFound(rw, req)
	} else {
		if err := sess.accept(messages...); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		rw.Header().Set("content-type", "text/plain; charset=UTF-8") // Ignored by net/http (but protocol test complains), see https://code.google.com/p/go/source/detail?r=902dc062bff8
		rw.WriteHeader(http.StatusNoContent)
	}
}

type xhrFrameWriter struct{}

func (*xhrFrameWriter) write(w io.Writer, frame string) (int, error) {
	return fmt.Fprintf(w, "%s\n", frame)
}

func (h *Handler) xhrPoll(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("content-type", "application/javascript; charset=UTF-8")
	sess, err := h.sessionByRequest(req)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	receiver := newHTTPReceiver(rw, req, 1, new(xhrFrameWriter), ReceiverTypeXHR)
	if err := sess.attachReceiver(receiver); err != nil {
		if err := receiver.sendFrame(cFrame); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		receiver.close()
		return
	}

	sess.startHandlerOnce.Do(func() {
		if h.handlerFunc != nil {
			go h.handlerFunc(Session{sess})
		}
	})

	select {
	case <-receiver.doneNotify():
	case <-receiver.interruptedNotify():
	}
}

func (h *Handler) xhrStreaming(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("content-type", "application/javascript; charset=UTF-8")
	fmt.Fprintf(rw, "%s\n", xhrStreamingPrelude)
	rw.(http.Flusher).Flush()

	sess, err := h.sessionByRequest(req)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	receiver := newHTTPReceiver(rw, req, h.options.ResponseLimit, new(xhrFrameWriter), ReceiverTypeXHRStreaming)

	if err := sess.attachReceiver(receiver); err != nil {
		if err := receiver.sendFrame(cFrame); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		receiver.close()
		return
	}
	sess.startHandlerOnce.Do(func() { go h.handlerFunc(Session{sess}) })

	select {
	case <-receiver.doneNotify():
	case <-receiver.interruptedNotify():
	}
}
