package sockjs

import (
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
)

var iframeTemplate = `<!doctype html>
<html><head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
</head><body><h2>Don't panic!</h2>
  <script>
    document.domain = document.domain;
    var c = parent.%s;
    c.start();
    function p(d) {c.message(d);};
    window.onload = function() {c.stop();};
  </script>
`

var invalidCallback = regexp.MustCompile(`[^a-zA-Z0-9_.]`)

func init() {
	iframeTemplate += strings.Repeat(" ", 1024-len(iframeTemplate)+14)
	iframeTemplate += "\r\n\r\n"
}

func (h *Handler) htmlFile(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("content-type", "text/html; charset=UTF-8")

	if err := req.ParseForm(); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	callback := req.Form.Get("c")
	if callback == "" {
		http.Error(rw, `"callback" parameter required`, http.StatusBadRequest)
		return
	} else if invalidCallback.MatchString(callback) {
		http.Error(rw, `invalid character in "callback" parameter`, http.StatusBadRequest)
		return
	}
	rw.WriteHeader(http.StatusOK)
	fmt.Fprintf(rw, iframeTemplate, callback)
	rw.(http.Flusher).Flush()
	sess, err := h.sessionByRequest(req)
	if err != nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	recv := newHTTPReceiver(rw, req, h.options.ResponseLimit, new(htmlfileFrameWriter), ReceiverTypeHtmlFile)
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

type htmlfileFrameWriter struct{}

func (*htmlfileFrameWriter) write(w io.Writer, frame string) (int, error) {
	return fmt.Fprintf(w, "<script>\np(%s);\n</script>\r\n", quote(frame))
}
