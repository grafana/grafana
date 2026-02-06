// Copyright 2019 Gregory Petrosyan <gregory.petrosyan@gmail.com>
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.

package rapid

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"html/template"
	"image"
	"image/color"
	"image/png"
	"io"
	"math"
	"time"
)

var (
	visBitSetColor   = color.Black
	visBitUnsetColor = color.White

	visTmpl = template.Must(template.New("rapid-vis").Parse(visHTML))
)

type visTmplData struct {
	Title     string
	Images    [][]*visTmplImage
	VisCSS    template.CSS
	RebootCSS template.CSS
}

type visGroupInfo struct {
	Classes string
	Label   string
}

type visTmplImage struct {
	Base64 string
	Title  string
	Alt    string
	Width  int
	Height int

	GroupBegins []visGroupInfo
	GroupEnds   []visGroupInfo
}

func visWriteHTML(w io.Writer, title string, recData []recordedBits) error {
	d := &visTmplData{
		Title:     fmt.Sprintf("%v (%v)", title, time.Now().Format(time.RFC1123)),
		VisCSS:    template.CSS(visCSS),
		RebootCSS: template.CSS(visRebootCSS),
	}

	labelClasses := map[string]string{}
	lastLabelClass := 0

	for _, rd := range recData {
		var images []*visTmplImage

		for _, u := range rd.data {
			tmplImg, err := visNewUint64Image(u).toTmplImage()
			if err != nil {
				return err
			}

			images = append(images, tmplImg)
		}

		for _, group := range rd.groups {
			if _, ok := labelClasses[group.label]; !ok {
				labelClasses[group.label] = fmt.Sprintf("label-%v", lastLabelClass)
				lastLabelClass++
			}
		}

		for _, group := range rd.groups {
			images[group.begin].GroupBegins = append(images[group.begin].GroupBegins, visGroupToInfo(labelClasses, group))
			if group.end > 0 {
				images[group.end-1].GroupEnds = append(images[group.end-1].GroupEnds, visGroupToInfo(labelClasses, group))
			}
		}

		d.Images = append(d.Images, images)
	}

	return visTmpl.Execute(w, d)
}

func visGroupToInfo(labelClasses map[string]string, group groupInfo) visGroupInfo {
	discardClass := ""
	if group.discard {
		discardClass = "discard "
	}

	endlessClass := ""
	if group.end <= 0 {
		endlessClass = "endless "
	}

	return visGroupInfo{
		Classes: discardClass + endlessClass + labelClasses[group.label],
		Label:   group.label,
	}
}

type visUint64Image struct {
	u uint64
	p color.Palette
}

func visNewUint64Image(u uint64) *visUint64Image {
	s := newRandomBitStream(u, false)
	h1 := genFloat01(s)
	h2 := genFloat01(s)

	return &visUint64Image{
		u: u,
		p: color.Palette{visBitSetColor, visBitUnsetColor, visHsv(h1*360, 1, 1), visHsv(h2*360, 1, 1)},
	}
}

func (img *visUint64Image) ColorModel() color.Model {
	return img.p
}

func (img *visUint64Image) Bounds() image.Rectangle {
	return image.Rect(0, 0, 64, 2)
}

func (img *visUint64Image) ColorIndexAt(x, y int) uint8 {
	switch y {
	case 0:
		if (x/8)%2 == 0 {
			return 2
		}
		return 3
	default:
		if img.u&(1<<uint(63-x)) != 0 {
			return 0
		}
		return 1
	}
}

func (img *visUint64Image) At(x, y int) color.Color {
	return img.p[img.ColorIndexAt(x, y)]
}

func (img *visUint64Image) toTmplImage() (*visTmplImage, error) {
	enc := png.Encoder{
		CompressionLevel: png.BestCompression,
	}

	var buf bytes.Buffer
	err := enc.Encode(&buf, img)
	if err != nil {
		return nil, err
	}

	return &visTmplImage{
		Base64: base64.StdEncoding.EncodeToString(buf.Bytes()),
		Title:  fmt.Sprintf("0x%x / %d", img.u, img.u),
		Alt:    fmt.Sprintf("0x%x", img.u),
		Width:  64,
		Height: 2,
	}, nil
}

const visHTML = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="description" content="rapid debug data visualization">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>[rapid] {{.Title}}</title>
		<style>
{{- .RebootCSS }}
		</style>
		<style>
{{- .VisCSS }}
		</style>
	</head>
	<body>
		<h1>{{.Title}}</h1>
		{{range .Images -}}
		<div class="vis">
			{{range . -}}
			{{range .GroupBegins}}<span title="{{.Label}}" class="group {{.Classes}}"><span class="label">{{.Label}}</span>{{end}}
			<img title="{{.Title}}" alt="{{.Alt}}" width="{{.Width}}" height="{{.Height}}" src="data:image/png;base64,{{.Base64}}">
			{{range .GroupEnds}}</span>{{end}}
			{{end}}
		</div>
		{{end}}
	</body>
</html>`

const visCSS = `
body {
	margin: 1rem;
}

.vis {
	display: flex;
	margin-bottom: 1rem;
}

.vis img {
	height: 1rem;
	margin: 0.3rem;

	image-rendering: pixelated;
	image-rendering: crisp-edges;
	image-rendering: -moz-crisp-edges;
	-ms-interpolation-mode: nearest-neighbor;
}

.vis .group {
	position: relative;
	display: inline-flex;
	padding: 0 0 1rem;
	background-color: rgba(0, 0, 0, 0.05);
	border-radius: 0 0 0.5rem 0.5rem;
	border-bottom: 2px solid black;
}

.vis .group.discard {
	background-color: rgba(255, 0, 0, 0.2);
}

.vis .group.endless {
	background-color: white;
}

.vis .group .label {
	font-size: 80%;
	white-space: nowrap;
	position: absolute;
	bottom: 0;
	left: 0.3rem;
	max-width: 100%;
	overflow: hidden;
}

.vis .group.discard > .label {
	color: red;
}

.vis .group.label-0 {
	border-bottom-color: red;
}
.vis .group.label-1 {
	border-bottom-color: maroon;
}
.vis .group.label-2 {
	border-bottom-color: yellow;
}
.vis .group.label-3 {
	border-bottom-color: olive;
}
.vis .group.label-4 {
	border-bottom-color: lime;
}
.vis .group.label-5 {
	border-bottom-color: green;
}
.vis .group.label-6 {
	border-bottom-color: aqua;
}
.vis .group.label-7 {
	border-bottom-color: teal;
}
.vis .group.label-8 {
	border-bottom-color: blue;
}
.vis .group.label-9 {
	border-bottom-color: navy;
}
.vis .group.label-10 {
	border-bottom-color: fuchsia;
}
.vis .group.label-11 {
	border-bottom-color: purple;
}
.vis .group.label-12 {
	border-bottom-color: red;
}
.vis .group.label-13 {
	border-bottom-color: maroon;
}
.vis .group.label-14 {
	border-bottom-color: yellow;
}
.vis .group.label-15 {
	border-bottom-color: olive;
}
.vis .group.label-16 {
	border-bottom-color: lime;
}
.vis .group.label-17 {
	border-bottom-color: green;
}
.vis .group.label-18 {
	border-bottom-color: aqua;
}
.vis .group.label-19 {
	border-bottom-color: teal;
}
.vis .group.label-20 {
	border-bottom-color: blue;
}
.vis .group.label-21 {
	border-bottom-color: navy;
}
.vis .group.label-22 {
	border-bottom-color: fuchsia;
}
.vis .group.label-23 {
	border-bottom-color: purple;
}
`

const visRebootCSS = `
/*!
 * Bootstrap Reboot v4.1.3 (https://getbootstrap.com/)
 * Copyright 2011-2018 The Bootstrap Authors
 * Copyright 2011-2018 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 * Forked from Normalize.css, licensed MIT (https://github.com/necolas/normalize.css/blob/master/LICENSE.md)
 */
*,
*::before,
*::after {
	box-sizing: border-box;
}

html {
	font-family: sans-serif;
	line-height: 1.15;
	-webkit-text-size-adjust: 100%;
	-ms-text-size-adjust: 100%;
	-ms-overflow-style: scrollbar;
	-webkit-tap-highlight-color: rgba(0, 0, 0, 0);
}

@-ms-viewport {
	width: device-width;
}

article, aside, figcaption, figure, footer, header, hgroup, main, nav, section {
	display: block;
}

body {
	margin: 0;
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
	font-size: 1rem;
	font-weight: 400;
	line-height: 1.5;
	color: #212529;
	text-align: left;
	background-color: #fff;
}

[tabindex="-1"]:focus {
	outline: 0 !important;
}

hr {
	box-sizing: content-box;
	height: 0;
	overflow: visible;
}

h1, h2, h3, h4, h5, h6 {
	margin-top: 0;
	margin-bottom: 0.5rem;
}

p {
	margin-top: 0;
	margin-bottom: 1rem;
}

abbr[title],
abbr[data-original-title] {
	text-decoration: underline;
	-webkit-text-decoration: underline dotted;
	text-decoration: underline dotted;
	cursor: help;
	border-bottom: 0;
}

address {
	margin-bottom: 1rem;
	font-style: normal;
	line-height: inherit;
}

ol,
ul,
dl {
	margin-top: 0;
	margin-bottom: 1rem;
}

ol ol,
ul ul,
ol ul,
ul ol {
	margin-bottom: 0;
}

dt {
	font-weight: 700;
}

dd {
	margin-bottom: .5rem;
	margin-left: 0;
}

blockquote {
	margin: 0 0 1rem;
}

dfn {
	font-style: italic;
}

b,
strong {
	font-weight: bolder;
}

small {
	font-size: 80%;
}

sub,
sup {
	position: relative;
	font-size: 75%;
	line-height: 0;
	vertical-align: baseline;
}

sub {
	bottom: -.25em;
}

sup {
	top: -.5em;
}

a {
	color: #007bff;
	text-decoration: none;
	background-color: transparent;
}

a:hover {
	color: #0056b3;
	text-decoration: underline;
}

a:not([href]):not([tabindex]) {
	color: inherit;
	text-decoration: none;
}

a:not([href]):not([tabindex]):hover, a:not([href]):not([tabindex]):focus {
	color: inherit;
	text-decoration: none;
}

a:not([href]):not([tabindex]):focus {
	outline: 0;
}

pre,
code,
kbd,
samp {
	font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
	font-size: 1em;
}

pre {
	margin-top: 0;
	margin-bottom: 1rem;
	overflow: auto;
	-ms-overflow-style: scrollbar;
}

figure {
	margin: 0 0 1rem;
}

img {
	vertical-align: middle;
	border-style: none;
}

svg {
	overflow: hidden;
	vertical-align: middle;
}

table {
	border-collapse: collapse;
}

caption {
	padding-top: 0.75rem;
	padding-bottom: 0.75rem;
	color: #6c757d;
	text-align: left;
	caption-side: bottom;
}

th {
	text-align: inherit;
}

label {
	display: inline-block;
	margin-bottom: 0.5rem;
}

button {
	border-radius: 0;
}

button:focus {
	outline: 1px dotted;
	outline: 5px auto -webkit-focus-ring-color;
}

input,
button,
select,
optgroup,
textarea {
	margin: 0;
	font-family: inherit;
	font-size: inherit;
	line-height: inherit;
}

button,
input {
	overflow: visible;
}

button,
select {
	text-transform: none;
}

button,
html [type="button"],
[type="reset"],
[type="submit"] {
	-webkit-appearance: button;
}

button::-moz-focus-inner,
[type="button"]::-moz-focus-inner,
[type="reset"]::-moz-focus-inner,
[type="submit"]::-moz-focus-inner {
	padding: 0;
	border-style: none;
}

input[type="radio"],
input[type="checkbox"] {
	box-sizing: border-box;
	padding: 0;
}

input[type="date"],
input[type="time"],
input[type="datetime-local"],
input[type="month"] {
	-webkit-appearance: listbox;
}

textarea {
	overflow: auto;
	resize: vertical;
}

fieldset {
	min-width: 0;
	padding: 0;
	margin: 0;
	border: 0;
}

legend {
	display: block;
	width: 100%;
	max-width: 100%;
	padding: 0;
	margin-bottom: .5rem;
	font-size: 1.5rem;
	line-height: inherit;
	color: inherit;
	white-space: normal;
}

progress {
	vertical-align: baseline;
}

[type="number"]::-webkit-inner-spin-button,
[type="number"]::-webkit-outer-spin-button {
	height: auto;
}

[type="search"] {
	outline-offset: -2px;
	-webkit-appearance: none;
}

[type="search"]::-webkit-search-cancel-button,
[type="search"]::-webkit-search-decoration {
	-webkit-appearance: none;
}

::-webkit-file-upload-button {
	font: inherit;
	-webkit-appearance: button;
}

output {
	display: inline-block;
}

summary {
	display: list-item;
	cursor: pointer;
}

template {
	display: none;
}

[hidden] {
	display: none !important;
}
`

// Copyright 2013 Lucas Beyer
// Licensed under MIT (https://github.com/lucasb-eyer/go-colorful/blob/master/LICENSE)
//
// Hsv creates a new Color given a Hue in [0..360], a Saturation and a Value in [0..1]
func visHsv(H, S, V float64) color.RGBA {
	Hp := H / 60.0
	C := V * S
	X := C * (1.0 - math.Abs(math.Mod(Hp, 2.0)-1.0))

	m := V - C
	r, g, b := 0.0, 0.0, 0.0

	switch {
	case 0.0 <= Hp && Hp < 1.0:
		r = C
		g = X
	case 1.0 <= Hp && Hp < 2.0:
		r = X
		g = C
	case 2.0 <= Hp && Hp < 3.0:
		g = C
		b = X
	case 3.0 <= Hp && Hp < 4.0:
		g = X
		b = C
	case 4.0 <= Hp && Hp < 5.0:
		r = X
		b = C
	case 5.0 <= Hp && Hp < 6.0:
		r = C
		b = X
	}

	return color.RGBA{R: uint8((m + r) * 255), G: uint8((m + g) * 255), B: uint8((m + b) * 255), A: 255}
}
