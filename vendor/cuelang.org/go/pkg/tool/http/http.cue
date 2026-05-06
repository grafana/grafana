// Copyright 2018 The CUE Authors
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package http

Get:    Do & {method: "GET"}
Post:   Do & {method: "POST"}
Put:    Do & {method: "PUT"}
Delete: Do & {method: "DELETE"}

Do: {
	$id: *"tool/http.Do" | "http" // http for backwards compatibility

	method: string
	url:    string // TODO: make url.URL type

	tls: {
		// Whether the server certificate must be validated.
		verify: *true | bool
		// PEM encoded certificate(s) to validate the server certificate.
		// If not set the CA bundle of the system is used.
		caCert?: bytes | string
	}

	request: {
		body?: bytes | string
		header: [string]:  string | [...string]
		trailer: [string]: string | [...string]
	}
	response: {
		status:     string
		statusCode: int

		body: *bytes | string
		header: [string]:  string | [...string]
		trailer: [string]: string | [...string]
	}
}

//  TODO: support serving once we have the cue serve command.
// Serve: {
//  port: int
//
//  cert: string
//  key:  string
//
//  handle: [Pattern=string]: Message & {
//   pattern: Pattern
//  }
// }
