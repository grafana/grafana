package ring

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"html/template"
	"math"
	"net/http"
	"sort"
	"strings"
	"time"
)

//go:embed ring_status.gohtml
var defaultPageContent string
var defaultPageTemplate = template.Must(template.New("webpage").Funcs(template.FuncMap{
	"mod": func(i, j int) bool { return i%j == 0 },
	"humanFloat": func(f float64) string {
		return fmt.Sprintf("%.3g", f)
	},
	"timeOrEmptyString": func(t time.Time) string {
		if t.IsZero() {
			return ""
		}
		return t.Format(time.RFC3339)
	},
	"durationSince": func(t time.Time) string { return time.Since(t).Truncate(time.Second).String() },
}).Parse(defaultPageContent))

type httpResponse struct {
	Ingesters []ingesterDesc `json:"shards"`
	Now       time.Time      `json:"now"`
	// ShowTokens indicates whether the Show Tokens button is clicked.
	ShowTokens bool `json:"-"`
	// DisableTokens hides the concept of tokens entirely in the page, across all elements.
	DisableTokens bool `json:"-"`
}

type ingesterDesc struct {
	ID                       string    `json:"id"`
	State                    string    `json:"state"`
	Address                  string    `json:"address"`
	HeartbeatTimestamp       time.Time `json:"timestamp"`
	RegisteredTimestamp      time.Time `json:"registered_timestamp"`
	ReadOnly                 bool      `json:"read_only"`
	ReadOnlyUpdatedTimestamp time.Time `json:"read_only_updated_timestamp"`
	Zone                     string    `json:"zone"`
	Tokens                   []uint32  `json:"tokens"`
	NumTokens                int       `json:"-"`
	Ownership                float64   `json:"-"`
}

type ringAccess interface {
	casRing(ctx context.Context, f func(in interface{}) (out interface{}, retry bool, err error)) error
	getRing(context.Context) (*Desc, error)
}

type ringPageHandler struct {
	r                ringAccess
	heartbeatTimeout time.Duration
	disableTokens    bool
}

func newRingPageHandler(r ringAccess, heartbeatTimeout time.Duration, disableTokens bool) *ringPageHandler {
	return &ringPageHandler{
		r:                r,
		heartbeatTimeout: heartbeatTimeout,
		disableTokens:    disableTokens,
	}
}

func (h *ringPageHandler) handle(w http.ResponseWriter, req *http.Request) {
	if req.Method == http.MethodPost {
		ingesterID := req.FormValue("forget")
		if err := h.forget(req.Context(), ingesterID); err != nil {
			http.Error(
				w,
				fmt.Errorf("error forgetting instance '%s': %w", ingesterID, err).Error(),
				http.StatusInternalServerError,
			)
			return
		}

		// Implement PRG pattern to prevent double-POST and work with CSRF middleware.
		// https://en.wikipedia.org/wiki/Post/Redirect/Get

		// http.Redirect() would convert our relative URL to absolute, which is not what we want.
		// Browser knows how to do that, and it also knows real URL. Furthermore it will also preserve tokens parameter.
		// Note that relative Location URLs are explicitly allowed by specification, so we're not doing anything wrong here.
		w.Header().Set("Location", "#")
		w.WriteHeader(http.StatusFound)

		return
	}

	ringDesc, err := h.r.getRing(req.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	ownedTokens := ringDesc.CountTokens()

	var ingesterIDs []string
	for id := range ringDesc.Ingesters {
		ingesterIDs = append(ingesterIDs, id)
	}
	sort.Strings(ingesterIDs)

	now := time.Now()
	var ingesters []ingesterDesc
	for _, id := range ingesterIDs {
		ing := ringDesc.Ingesters[id]
		state := ing.State.String()
		if !ing.IsHealthy(Reporting, h.heartbeatTimeout, now) {
			state = "UNHEALTHY"
		}

		ro, rots := ing.GetReadOnlyState()

		ingesters = append(ingesters, ingesterDesc{
			ID:                       id,
			State:                    state,
			Address:                  ing.Addr,
			HeartbeatTimestamp:       time.Unix(ing.Timestamp, 0).UTC(),
			RegisteredTimestamp:      ing.GetRegisteredAt().UTC(),
			ReadOnly:                 ro,
			ReadOnlyUpdatedTimestamp: rots.UTC(),
			Tokens:                   ing.Tokens,
			Zone:                     ing.Zone,
			NumTokens:                len(ing.Tokens),
			Ownership:                (float64(ownedTokens[id]) / float64(math.MaxUint32)) * 100,
		})
	}

	tokensParam := req.URL.Query().Get("tokens")

	renderHTTPResponse(w, httpResponse{
		Ingesters:     ingesters,
		Now:           now,
		ShowTokens:    tokensParam == "true",
		DisableTokens: h.disableTokens,
	}, defaultPageTemplate, req)
}

// RenderHTTPResponse either responds with json or a rendered html page using the passed in template
// by checking the Accepts header
func renderHTTPResponse(w http.ResponseWriter, v any, t *template.Template, r *http.Request) {
	accept := r.Header.Get("Accept")
	if strings.Contains(accept, "application/json") {
		writeJSONResponse(w, v)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	if err := t.Execute(w, v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *ringPageHandler) forget(ctx context.Context, id string) error {
	unregister := func(in interface{}) (out interface{}, retry bool, err error) {
		if in == nil {
			return nil, false, fmt.Errorf("found empty ring when trying to unregister")
		}

		ringDesc := in.(*Desc)
		ringDesc.RemoveIngester(id)
		return ringDesc, true, nil
	}
	return h.r.casRing(ctx, unregister)
}

// WriteJSONResponse writes some JSON as a HTTP response.
func writeJSONResponse(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")

	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
