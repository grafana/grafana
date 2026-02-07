package middleware

import (
	"bytes"
	"fmt"
	"html/template"
	"net/http"
	"path"
)

// RapiDocOpts configures the RapiDoc middlewares
type RapiDocOpts struct {
	// BasePath for the UI, defaults to: /
	BasePath string

	// Path combines with BasePath to construct the path to the UI, defaults to: "docs".
	Path string

	// SpecURL is the URL of the spec document.
	//
	// Defaults to: /swagger.json
	SpecURL string

	// Title for the documentation site, default to: API documentation
	Title string

	// Template specifies a custom template to serve the UI
	Template string

	// RapiDocURL points to the js asset that generates the rapidoc site.
	//
	// Defaults to https://unpkg.com/rapidoc/dist/rapidoc-min.js
	RapiDocURL string
}

func (r *RapiDocOpts) EnsureDefaults() {
	common := toCommonUIOptions(r)
	common.EnsureDefaults()
	fromCommonToAnyOptions(common, r)

	// rapidoc-specifics
	if r.RapiDocURL == "" {
		r.RapiDocURL = rapidocLatest
	}
	if r.Template == "" {
		r.Template = rapidocTemplate
	}
}

// RapiDoc creates a middleware to serve a documentation site for a swagger spec.
//
// This allows for altering the spec before starting the http listener.
func RapiDoc(opts RapiDocOpts, next http.Handler) http.Handler {
	opts.EnsureDefaults()

	pth := path.Join(opts.BasePath, opts.Path)
	tmpl := template.Must(template.New("rapidoc").Parse(opts.Template))
	assets := bytes.NewBuffer(nil)
	if err := tmpl.Execute(assets, opts); err != nil {
		panic(fmt.Errorf("cannot execute template: %w", err))
	}

	return serveUI(pth, assets.Bytes(), next)
}

const (
	rapidocLatest   = "https://unpkg.com/rapidoc/dist/rapidoc-min.js"
	rapidocTemplate = `<!doctype html>
<html>
<head>
  <title>{{ .Title }}</title>
  <meta charset="utf-8"> <!-- Important: rapi-doc uses utf8 characters -->
  <script type="module" src="{{ .RapiDocURL }}"></script>
</head>
<body>
  <rapi-doc spec-url="{{ .SpecURL }}"></rapi-doc>
</body>
</html>
`
)
