package jsonschema

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

type resource struct {
	url          string // base url of resource. can be empty
	floc         string // fragment with json-pointer from root resource
	doc          interface{}
	draft        *Draft
	subresources map[string]*resource // key is floc. only applicable for root resource
	schema       *Schema
}

func (r *resource) String() string {
	return r.url + r.floc
}

func newResource(url string, r io.Reader) (*resource, error) {
	if strings.IndexByte(url, '#') != -1 {
		panic(fmt.Sprintf("BUG: newResource(%q)", url))
	}
	doc, err := unmarshal(r)
	if err != nil {
		return nil, fmt.Errorf("jsonschema: invalid json %s: %v", url, err)
	}
	url, err = toAbs(url)
	if err != nil {
		return nil, err
	}
	return &resource{
		url:  url,
		floc: "#",
		doc:  doc,
	}, nil
}

// fillSubschemas fills subschemas in res into r.subresources
func (r *resource) fillSubschemas(c *Compiler, res *resource) error {
	if err := c.validateSchema(r, res.doc, res.floc[1:]); err != nil {
		return err
	}

	if r.subresources == nil {
		r.subresources = make(map[string]*resource)
	}
	if err := r.draft.listSubschemas(res, r.baseURL(res.floc), r.subresources); err != nil {
		return err
	}

	// ensure subresource.url uniqueness
	url2floc := make(map[string]string)
	for _, sr := range r.subresources {
		if sr.url != "" {
			if floc, ok := url2floc[sr.url]; ok {
				return fmt.Errorf("jsonschema: %q and %q in %s have same canonical-uri", floc[1:], sr.floc[1:], r.url)
			}
			url2floc[sr.url] = sr.floc
		}
	}

	return nil
}

// listResources lists all subresources in res
func (r *resource) listResources(res *resource) []*resource {
	var result []*resource
	prefix := res.floc + "/"
	for _, sr := range r.subresources {
		if strings.HasPrefix(sr.floc, prefix) {
			result = append(result, sr)
		}
	}
	return result
}

func (r *resource) findResource(url string) *resource {
	if r.url == url {
		return r
	}
	for _, res := range r.subresources {
		if res.url == url {
			return res
		}
	}
	return nil
}

// resolve fragment f with sr as base
func (r *resource) resolveFragment(c *Compiler, sr *resource, f string) (*resource, error) {
	if f == "#" || f == "#/" {
		return sr, nil
	}

	// resolve by anchor
	if !strings.HasPrefix(f, "#/") {
		// check in given resource
		for _, anchor := range r.draft.anchors(sr.doc) {
			if anchor == f[1:] {
				return sr, nil
			}
		}

		// check in subresources that has same base url
		prefix := sr.floc + "/"
		for _, res := range r.subresources {
			if strings.HasPrefix(res.floc, prefix) && r.baseURL(res.floc) == sr.url {
				for _, anchor := range r.draft.anchors(res.doc) {
					if anchor == f[1:] {
						return res, nil
					}
				}
			}
		}
		return nil, nil
	}

	// resolve by ptr
	floc := sr.floc + f[1:]
	if res, ok := r.subresources[floc]; ok {
		return res, nil
	}

	// non-standrad location
	doc := r.doc
	for _, item := range strings.Split(floc[2:], "/") {
		item = strings.Replace(item, "~1", "/", -1)
		item = strings.Replace(item, "~0", "~", -1)
		item, err := url.PathUnescape(item)
		if err != nil {
			return nil, err
		}
		switch d := doc.(type) {
		case map[string]interface{}:
			if _, ok := d[item]; !ok {
				return nil, nil
			}
			doc = d[item]
		case []interface{}:
			index, err := strconv.Atoi(item)
			if err != nil {
				return nil, err
			}
			if index < 0 || index >= len(d) {
				return nil, nil
			}
			doc = d[index]
		default:
			return nil, nil
		}
	}

	id, err := r.draft.resolveID(r.baseURL(floc), doc)
	if err != nil {
		return nil, err
	}
	res := &resource{url: id, floc: floc, doc: doc}
	r.subresources[floc] = res
	if err := r.fillSubschemas(c, res); err != nil {
		return nil, err
	}
	return res, nil
}

func (r *resource) baseURL(floc string) string {
	for {
		if sr, ok := r.subresources[floc]; ok {
			if sr.url != "" {
				return sr.url
			}
		}
		slash := strings.LastIndexByte(floc, '/')
		if slash == -1 {
			break
		}
		floc = floc[:slash]
	}
	return r.url
}

// url helpers ---

func toAbs(s string) (string, error) {
	// if windows absolute file path, convert to file url
	// because: net/url parses driver name as scheme
	if runtime.GOOS == "windows" && len(s) >= 3 && s[1:3] == `:\` {
		s = "file:///" + filepath.ToSlash(s)
	}

	u, err := url.Parse(s)
	if err != nil {
		return "", err
	}
	if u.IsAbs() {
		return s, nil
	}

	// s is filepath
	if s, err = filepath.Abs(s); err != nil {
		return "", err
	}
	if runtime.GOOS == "windows" {
		s = "file:///" + filepath.ToSlash(s)
	} else {
		s = "file://" + s
	}
	u, err = url.Parse(s) // to fix spaces in filepath
	return u.String(), err
}

func resolveURL(base, ref string) (string, error) {
	if ref == "" {
		return base, nil
	}
	if strings.HasPrefix(ref, "urn:") {
		return ref, nil
	}

	refURL, err := url.Parse(ref)
	if err != nil {
		return "", err
	}
	if refURL.IsAbs() {
		return ref, nil
	}

	if strings.HasPrefix(base, "urn:") {
		base, _ = split(base)
		return base + ref, nil
	}

	baseURL, err := url.Parse(base)
	if err != nil {
		return "", err
	}
	return baseURL.ResolveReference(refURL).String(), nil
}

func split(uri string) (string, string) {
	hash := strings.IndexByte(uri, '#')
	if hash == -1 {
		return uri, "#"
	}
	f := uri[hash:]
	if f == "#/" {
		f = "#"
	}
	return uri[0:hash], f
}

func (s *Schema) url() string {
	u, _ := split(s.Location)
	return u
}

func (s *Schema) loc() string {
	_, f := split(s.Location)
	return f[1:]
}

func unmarshal(r io.Reader) (interface{}, error) {
	decoder := json.NewDecoder(r)
	decoder.UseNumber()
	var doc interface{}
	if err := decoder.Decode(&doc); err != nil {
		return nil, err
	}
	if t, _ := decoder.Token(); t != nil {
		return nil, fmt.Errorf("invalid character %v after top-level value", t)
	}
	return doc, nil
}
