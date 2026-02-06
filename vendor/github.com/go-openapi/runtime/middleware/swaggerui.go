package middleware

import (
	"bytes"
	"fmt"
	"html/template"
	"net/http"
	"path"
)

// SwaggerUIOpts configures the SwaggerUI middleware
type SwaggerUIOpts struct {
	// BasePath for the API, defaults to: /
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

	// OAuthCallbackURL the url called after OAuth2 login
	OAuthCallbackURL string

	// The three components needed to embed swagger-ui

	// SwaggerURL points to the js that generates the SwaggerUI site.
	//
	// Defaults to: https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js
	SwaggerURL string

	SwaggerPresetURL string
	SwaggerStylesURL string

	Favicon32 string
	Favicon16 string
}

// EnsureDefaults in case some options are missing
func (r *SwaggerUIOpts) EnsureDefaults() {
	r.ensureDefaults()

	if r.Template == "" {
		r.Template = swaggeruiTemplate
	}
}

func (r *SwaggerUIOpts) EnsureDefaultsOauth2() {
	r.ensureDefaults()

	if r.Template == "" {
		r.Template = swaggerOAuthTemplate
	}
}

func (r *SwaggerUIOpts) ensureDefaults() {
	common := toCommonUIOptions(r)
	common.EnsureDefaults()
	fromCommonToAnyOptions(common, r)

	// swaggerui-specifics
	if r.OAuthCallbackURL == "" {
		r.OAuthCallbackURL = path.Join(r.BasePath, r.Path, "oauth2-callback")
	}
	if r.SwaggerURL == "" {
		r.SwaggerURL = swaggerLatest
	}
	if r.SwaggerPresetURL == "" {
		r.SwaggerPresetURL = swaggerPresetLatest
	}
	if r.SwaggerStylesURL == "" {
		r.SwaggerStylesURL = swaggerStylesLatest
	}
	if r.Favicon16 == "" {
		r.Favicon16 = swaggerFavicon16Latest
	}
	if r.Favicon32 == "" {
		r.Favicon32 = swaggerFavicon32Latest
	}
}

// SwaggerUI creates a middleware to serve a documentation site for a swagger spec.
//
// This allows for altering the spec before starting the http listener.
func SwaggerUI(opts SwaggerUIOpts, next http.Handler) http.Handler {
	opts.EnsureDefaults()

	pth := path.Join(opts.BasePath, opts.Path)
	tmpl := template.Must(template.New("swaggerui").Parse(opts.Template))
	assets := bytes.NewBuffer(nil)
	if err := tmpl.Execute(assets, opts); err != nil {
		panic(fmt.Errorf("cannot execute template: %w", err))
	}

	return serveUI(pth, assets.Bytes(), next)
}

const (
	swaggerLatest          = "https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"
	swaggerPresetLatest    = "https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js"
	swaggerStylesLatest    = "https://unpkg.com/swagger-ui-dist/swagger-ui.css"
	swaggerFavicon32Latest = "https://unpkg.com/swagger-ui-dist/favicon-32x32.png"
	swaggerFavicon16Latest = "https://unpkg.com/swagger-ui-dist/favicon-16x16.png"
	swaggeruiTemplate      = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
		<title>{{ .Title }}</title>

    <link rel="stylesheet" type="text/css" href="{{ .SwaggerStylesURL }}" >
    <link rel="icon" type="image/png" href="{{ .Favicon32 }}" sizes="32x32" />
    <link rel="icon" type="image/png" href="{{ .Favicon16 }}" sizes="16x16" />
    <style>
      html
      {
        box-sizing: border-box;
        overflow: -moz-scrollbars-vertical;
        overflow-y: scroll;
      }

      *,
      *:before,
      *:after
      {
        box-sizing: inherit;
      }

      body
      {
        margin:0;
        background: #fafafa;
      }
    </style>
  </head>

  <body>
    <div id="swagger-ui"></div>

    <script src="{{ .SwaggerURL }}"> </script>
    <script src="{{ .SwaggerPresetURL }}"> </script>
    <script>
    window.onload = function() {
      // Begin Swagger UI call region
      const ui = SwaggerUIBundle({
        url: '{{ .SpecURL }}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
		oauth2RedirectUrl: '{{ .OAuthCallbackURL }}'
      })
      // End Swagger UI call region

      window.ui = ui
    }
  </script>
  </body>
</html>
`
)
