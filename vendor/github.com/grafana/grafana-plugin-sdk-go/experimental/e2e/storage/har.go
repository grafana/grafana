package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/chromedp/cdproto/har"
	"github.com/google/uuid"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/e2e/utils"
)

// harFiles is a global map of HAR files that are currently being read or written.
var harFiles = files{files: map[string]*file{}}

// HAR is a Storage implementation that stores requests and responses in HAR format on disk.
type HAR struct {
	path        string
	har         *har.HAR
	currentTime func() time.Time
	newUUID     func() string
}

// NewHARStorage creates a new HARStorage.
func NewHARStorage(path string) *HAR {
	storage := &HAR{
		path:        path,
		har:         &har.HAR{},
		currentTime: time.Now,
		newUUID:     newUUID,
	}
	storage.Init()
	return storage
}

// WithCurrentTimeOverride replaces the default s.currentTime() with the given function.
func (s *HAR) WithCurrentTimeOverride(fn func() time.Time) {
	s.currentTime = fn
	s.Init()
}

// WithUUIDOverride replaces the default s.newUUID() with the given function.
func (s *HAR) WithUUIDOverride(fn func() string) {
	s.newUUID = fn
	s.Init()
}

// Init initializes the HAR storage.
func (s *HAR) Init() {
	if err := s.Load(); err == nil {
		return
	}
	s.har.Log = &har.Log{
		Version: "1.2",
		Creator: &har.Creator{
			Name:    "grafana-plugin-sdk-go",
			Version: "experimental",
		},
		Entries: make([]*har.Entry, 0),
		Pages: []*har.Page{{
			StartedDateTime: s.currentTime().Format(time.RFC3339),
			Title:           "Grafana E2E",
			ID:              s.newUUID(),
			PageTimings:     &har.PageTimings{},
		}},
	}
}

// Add converts the http.Request and http.Response to a har.Entry and adds it to the Fixture.
func (s *HAR) Add(req *http.Request, res *http.Response) error {
	harFiles.lock(s.path)
	defer harFiles.unlock(s.path)
	var (
		err     error
		reqBody []byte
		resBody []byte
	)

	reqHeaders := make([]*har.NameValuePair, 0)
	for name, value := range req.Header.Clone() {
		reqHeaders = append(reqHeaders, &har.NameValuePair{Name: name, Value: value[0]})
	}

	resHeaders := make([]*har.NameValuePair, 0)
	for name, value := range res.Header.Clone() {
		resHeaders = append(resHeaders, &har.NameValuePair{Name: name, Value: value[0]})
	}

	queryString := make([]*har.NameValuePair, 0)
	for name, value := range req.URL.Query() {
		queryString = append(queryString, &har.NameValuePair{Name: name, Value: value[0]})
	}

	if req.Body != nil {
		reqBody, err = utils.ReadRequestBody(req)
		if err != nil {
			return err
		}
	}

	if res.Body != nil {
		resBody, err = io.ReadAll(res.Body)
		if err != nil {
			return err
		}
		res.Body = io.NopCloser(bytes.NewReader(resBody))
	}

	reqCookies := make([]*har.Cookie, 0)
	for _, cookie := range req.Cookies() {
		reqCookies = append(reqCookies, &har.Cookie{Name: cookie.Name, Value: cookie.Value})
	}

	resCookies := make([]*har.Cookie, 0)
	for _, cookie := range res.Cookies() {
		resCookies = append(resCookies, &har.Cookie{Name: cookie.Name, Value: cookie.Value})
	}

	_ = s.loadUnsafe()
	s.har.Log.Entries = append(s.har.Log.Entries, &har.Entry{
		StartedDateTime: s.currentTime().Format(time.RFC3339),
		Time:            0.0,
		Comment:         s.newUUID(),
		Cache: &har.Cache{
			Comment: "Not cached",
		},
		Timings: &har.Timings{
			Send:    0.0,
			Wait:    0.0,
			Receive: 0.0,
		},
		Request: &har.Request{
			Method:      req.Method,
			HTTPVersion: req.Proto,
			URL:         req.URL.String(),
			Headers:     reqHeaders,
			QueryString: queryString,
			Cookies:     reqCookies,
			BodySize:    int64(len(reqBody)),
			PostData: &har.PostData{
				MimeType: req.Header.Get("Content-Type"),
				Text:     string(reqBody),
			},
		},
		Response: &har.Response{
			Status:      int64(res.StatusCode),
			StatusText:  res.Status,
			HTTPVersion: res.Proto,
			Headers:     resHeaders,
			HeadersSize: -1,
			BodySize:    int64(len(resBody)),
			Cookies:     resCookies,
			RedirectURL: res.Header.Get("Location"),
			Content: &har.Content{
				Size:     int64(len(resBody)),
				MimeType: res.Header.Get("Content-Type"),
				Text:     string(resBody),
			},
		},
	})
	return s.saveUnsafe()
}

// Entries converts HAR entries to a slice of Entry (http.Request and http.Response pairs).
func (s *HAR) Entries() []*Entry {
	_ = s.Load()
	entries := make([]*Entry, len(s.har.Log.Entries))
	for i, e := range s.har.Log.Entries {
		postData := ""
		if e.Request.PostData != nil {
			postData = e.Request.PostData.Text
		}
		req, err := http.NewRequest(e.Request.Method, e.Request.URL, nil)
		if err != nil {
			fmt.Println("Failed to create request", "err", err)
			continue
		}
		req.Body = io.NopCloser(strings.NewReader(postData))
		req.ContentLength = e.Request.BodySize
		req.Header = make(http.Header)
		for _, header := range e.Request.Headers {
			req.Header.Add(header.Name, header.Value)
		}

		bodyReq := req.Clone(context.Background())
		bodyReq.Body = io.NopCloser(strings.NewReader(postData))
		res := &http.Response{
			StatusCode:    int(e.Response.Status),
			Status:        e.Response.StatusText,
			Proto:         e.Response.HTTPVersion,
			Header:        make(http.Header),
			Body:          io.NopCloser(strings.NewReader(e.Response.Content.Text)),
			ContentLength: int64(len(e.Response.Content.Text)),
			Request:       bodyReq,
		}

		for _, header := range e.Response.Headers {
			res.Header.Add(header.Name, header.Value)
		}

		// use the HAR entry's comment field to store the ID of the entry
		if e.Comment == "" {
			e.Comment = newUUID()
		}

		entries[i] = &Entry{
			Request:  req,
			Response: res,
		}
	}

	return entries
}

// Delete removes the HAR entry matching the given Request.
func (s *HAR) Delete(req *http.Request) bool {
	_ = s.Load()
	i, entry := s.findEntry(req)
	if entry == nil {
		return false
	}
	s.har.Log.Entries = append(s.har.Log.Entries[:i], s.har.Log.Entries[i+1:]...)
	err := s.Save()
	if err != nil {
		fmt.Printf("Failed to delete entry: %s\n", err.Error())
		return false
	}
	return true
}

// Save writes the HAR to disk.
func (s *HAR) Save() error {
	harFiles.lock(s.path)
	defer harFiles.unlock(s.path)
	return s.saveUnsafe()
}

func (s *HAR) saveUnsafe() error {
	err := os.MkdirAll(filepath.Dir(s.path), os.ModePerm) // #nosec G301
	if err != nil {
		return err
	}
	raw, err := json.Marshal(s.har)
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, raw, 0600)
}

// Load reads the HAR from disk.
func (s *HAR) Load() error {
	harFiles.rLock(s.path)
	defer harFiles.rUnlock(s.path)
	return s.loadUnsafe()
}

func (s *HAR) loadUnsafe() error {
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}

	return json.Unmarshal(raw, &s.har)
}

// Match returns the stored http.Response for the given request.
func (s *HAR) Match(req *http.Request) *http.Response {
	if _, entry := s.findEntry(req); entry != nil {
		return entry.Response
	}
	return nil
}

// findEntry returns them matching entry index and entry for the given request.
func (s *HAR) findEntry(req *http.Request) (int, *Entry) {
	for i, entry := range s.Entries() {
		if res := entry.Match(req); res != nil {
			_ = res.Body.Close()
			return i, entry
		}
	}
	return -1, nil
}

func newUUID() string {
	return uuid.New().String()
}
