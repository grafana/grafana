package sockjs

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func (h *Handler) jsonp(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("content-type", "application/javascript; charset=UTF-8")

	if err := req.ParseForm(); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	callback := req.Form.Get("c")
	if callback == "" {
		http.Error(rw, `"callback" parameter required`, http.StatusInternalServerError)
		return
	} else if invalidCallback.MatchString(callback) {
		http.Error(rw, `invalid character in "callback" parameter`, http.StatusBadRequest)
		return
	}
	rw.WriteHeader(http.StatusOK)
	rw.(http.Flusher).Flush()

	sess, err := h.sessionByRequest(req)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	recv := newHTTPReceiver(rw, req, 1, &jsonpFrameWriter{callback}, ReceiverTypeJSONP)
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

func (h *Handler) jsonpSend(rw http.ResponseWriter, req *http.Request) {
	if err := req.ParseForm(); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	var data io.Reader
	data = req.Body

	formReader := strings.NewReader(req.PostFormValue("d"))
	if formReader.Len() != 0 {
		data = formReader
	}
	if data == nil {
		http.Error(rw, "Payload expected.", http.StatusBadRequest)
		return
	}
	var messages []string
	err := json.NewDecoder(data).Decode(&messages)
	if err == io.EOF {
		http.Error(rw, "Payload expected.", http.StatusBadRequest)
		return
	}
	if err != nil {
		http.Error(rw, "Broken JSON encoding.", http.StatusBadRequest)
		return
	}
	sessionID, _ := h.parseSessionID(req.URL)
	h.sessionsMux.Lock()
	defer h.sessionsMux.Unlock()
	if sess, ok := h.sessions[sessionID]; !ok {
		http.NotFound(rw, req)
	} else {
		if err := sess.accept(messages...); err != nil {
			http.Error(rw, err.Error(), http.StatusInternalServerError)
			return
		}
		rw.Header().Set("content-type", "text/plain; charset=UTF-8")
		_, _ = rw.Write([]byte("ok"))
	}
}

type jsonpFrameWriter struct {
	callback string
}

func (j *jsonpFrameWriter) write(w io.Writer, frame string) (int, error) {
	return fmt.Fprintf(w, "%s(%s);\r\n", j.callback, quote(frame))
}
