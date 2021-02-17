package sockjs

import (
	"crypto/md5"
	"fmt"
	"net/http"
	"text/template"
)

var tmpl = template.Must(template.New("iframe").Parse(iframeBody))

func (h *Handler) iframe(rw http.ResponseWriter, req *http.Request) {
	etagReq := req.Header.Get("If-None-Match")
	hash := md5.New()
	if _, err := hash.Write([]byte(iframeBody)); err!=nil {
		http.Error(rw, err.Error(), http.StatusInternalServerError)
		return
	}
	etag := fmt.Sprintf("%x", hash.Sum(nil))
	if etag == etagReq {
		rw.WriteHeader(http.StatusNotModified)
		return
	}

	rw.Header().Set("Content-Type", "text/html; charset=UTF-8")
	rw.Header().Add("ETag", etag)
	if err := tmpl.Execute(rw, h.options.SockJSURL); err!=nil {
			http.Error(rw, "could not render iframe content: "+err.Error(), http.StatusInternalServerError)
			return
	}
}

var iframeBody = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <script>
    document.domain = document.domain;
    _sockjs_onload = function(){SockJS.bootstrap_iframe();};
  </script>
  <script src="{{.}}"></script>
</head>
<body>
  <h2>Don't panic!</h2>
  <p>This is a SockJS hidden iframe. It's used for cross domain magic.</p>
</body>
</html>`
