package memberlist

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/hashicorp/memberlist"
)

// HTTPStatusHandler is a http.Handler with status information about memberlist.
type HTTPStatusHandler struct {
	kvs *KVInitService
	tpl *template.Template
}

// StatusPageData represents the data passed to the template rendered by HTTPStatusHandler
type StatusPageData struct {
	Now                       time.Time
	Memberlist                *memberlist.Memberlist
	SortedMembers             []*memberlist.Node
	Store                     map[string]ValueDesc
	MessageHistoryBufferBytes int
	SentMessages              []Message
	ReceivedMessages          []Message
}

// NewHTTPStatusHandler creates a new HTTPStatusHandler that will render the provided template using the data from StatusPageData.
func NewHTTPStatusHandler(kvs *KVInitService, tpl *template.Template) HTTPStatusHandler {
	return HTTPStatusHandler{kvs, tpl}
}

func (h HTTPStatusHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	kv := h.kvs.getKV()
	if kv == nil {
		w.Header().Set("Content-Type", "text/plain")
		// Ignore inactionable errors.
		_, _ = w.Write([]byte("This instance doesn't use memberlist."))
		return
	}

	const (
		downloadKeyParam    = "downloadKey"
		viewKeyParam        = "viewKey"
		viewMsgParam        = "viewMsg"
		deleteMessagesParam = "deleteMessages"
	)

	if err := req.ParseForm(); err == nil {
		if req.Form[downloadKeyParam] != nil {
			downloadKey(w, kv, kv.storeCopy(), req.Form[downloadKeyParam][0]) // Use first value, ignore the rest.
			return
		}

		if req.Form[viewKeyParam] != nil {
			viewKey(w, kv.storeCopy(), req.Form[viewKeyParam][0], getFormat(req))
			return
		}

		if req.Form[viewMsgParam] != nil {
			msgID, err := strconv.Atoi(req.Form[viewMsgParam][0])
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			sent, received := kv.getSentAndReceivedMessages()

			for _, m := range append(sent, received...) {
				if m.ID == msgID {
					viewMessage(w, kv, m, getFormat(req))
					return
				}
			}

			http.Error(w, "message not found", http.StatusNotFound)
			return
		}

		if len(req.Form[deleteMessagesParam]) > 0 && req.Form[deleteMessagesParam][0] == "true" {
			kv.deleteSentReceivedMessages()

			// Redirect back.
			w.Header().Set("Location", "?"+deleteMessagesParam+"=false")
			w.WriteHeader(http.StatusFound)
			return
		}
	}

	members := kv.memberlist.Members()
	sort.Slice(members, func(i, j int) bool {
		return members[i].Name < members[j].Name
	})

	sent, received := kv.getSentAndReceivedMessages()

	v := StatusPageData{
		Now:                       time.Now(),
		Memberlist:                kv.memberlist,
		SortedMembers:             members,
		Store:                     kv.storeCopy(),
		MessageHistoryBufferBytes: kv.cfg.MessageHistoryBufferBytes,
		SentMessages:              sent,
		ReceivedMessages:          received,
	}

	accept := req.Header.Get("Accept")
	if strings.Contains(accept, "application/json") {
		w.Header().Set("Content-Type", "application/json")

		if err := json.NewEncoder(w).Encode(v); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "text/html")
	if err := h.tpl.Execute(w, v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func getFormat(req *http.Request) string {
	const viewFormat = "format"

	format := ""
	if len(req.Form[viewFormat]) > 0 {
		format = req.Form[viewFormat][0]
	}
	return format
}

func viewMessage(w http.ResponseWriter, kv *KV, msg Message, format string) {
	c := kv.GetCodec(msg.Pair.Codec)
	if c == nil {
		http.Error(w, "codec not found", http.StatusNotFound)
		return
	}

	val, err := c.Decode(msg.Pair.Value)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to decode: %v", err), http.StatusInternalServerError)
		return
	}

	formatValue(w, val, format)
}

func viewKey(w http.ResponseWriter, store map[string]ValueDesc, key string, format string) {
	if store[key].value == nil {
		http.Error(w, "value not found", http.StatusNotFound)
		return
	}

	formatValue(w, store[key].value, format)
}

func formatValue(w http.ResponseWriter, val interface{}, format string) {
	w.WriteHeader(200)
	w.Header().Add("content-type", "text/plain")

	switch format {
	case "json", "json-pretty":
		enc := json.NewEncoder(w)
		if format == "json-pretty" {
			enc.SetIndent("", "    ")
		}

		err := enc.Encode(val)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}

	default:
		_, _ = fmt.Fprintf(w, "%#v", val)
	}
}

func downloadKey(w http.ResponseWriter, kv *KV, store map[string]ValueDesc, key string) {
	if store[key].value == nil {
		http.Error(w, "value not found", http.StatusNotFound)
		return
	}

	val := store[key]

	c := kv.GetCodec(store[key].CodecID)
	if c == nil {
		http.Error(w, "codec not found", http.StatusNotFound)
		return
	}

	encoded, err := c.Encode(val.value)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to encode: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Add("content-type", "application/octet-stream")
	// Set content-length so that client knows whether it has received full response or not.
	w.Header().Add("content-length", strconv.Itoa(len(encoded)))
	w.Header().Add("content-disposition", fmt.Sprintf("attachment; filename=%d-%s", val.Version, key))
	w.WriteHeader(200)

	// Ignore errors, we cannot do anything about them.
	_, _ = w.Write(encoded)
}

//go:embed status.gohtml
var defaultPageContent string
var defaultPageTemplate = template.Must(template.New("webpage").Funcs(template.FuncMap{
	"StringsJoin": strings.Join,
}).Parse(defaultPageContent))
