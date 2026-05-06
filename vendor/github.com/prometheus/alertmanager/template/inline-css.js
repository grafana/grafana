#!/usr/bin/env node

// Copyright 2021 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const juice = require('juice')
const fs = require('fs')

const inputFile = 'email.html'
const outputFile = 'email.tmpl'

var inputData = ''

try {
	inputData = fs.readFileSync(inputFile, 'utf8')
} catch (err) {
	console.error(err)
	process.exit(1)
}

var templateData = juice(inputData)

const outputData = `
{{ define "email.default.subject" }}{{ template "__subject" . }}{{ end }}
{{ define "email.default.html" }}
${templateData}
{{ end }}
`

fs.writeFileSync(outputFile, outputData)
