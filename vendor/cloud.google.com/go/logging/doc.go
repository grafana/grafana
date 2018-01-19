// Copyright 2016 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
Package logging contains a Stackdriver Logging client suitable for writing logs.
For reading logs, and working with sinks, metrics and monitored resources,
see package cloud.google.com/go/logging/logadmin.

This client uses Logging API v2.
See https://cloud.google.com/logging/docs/api/v2/ for an introduction to the API.


Note: This package is in beta.  Some backwards-incompatible changes may occur.


Creating a Client

Use a Client to interact with the Stackdriver Logging API.

	// Create a Client
	ctx := context.Background()
	client, err := logging.NewClient(ctx, "my-project")
	if err != nil {
		// TODO: Handle error.
	}


Basic Usage

For most use-cases, you'll want to add log entries to a buffer to be periodically
flushed (automatically and asynchronously) to the Stackdriver Logging service.

	// Initialize a logger
	lg := client.Logger("my-log")

	// Add entry to log buffer
	lg.Log(logging.Entry{Payload: "something happened!"})


Closing your Client

You should call Client.Close before your program exits to flush any buffered log entries to the Stackdriver Logging service.

	// Close the client when finished.
	err = client.Close()
	if err != nil {
		// TODO: Handle error.
	}


Synchronous Logging

For critical errors, you may want to send your log entries immediately.
LogSync is slow and will block until the log entry has been sent, so it is
not recommended for basic use.

	lg.LogSync(ctx, logging.Entry{Payload: "ALERT! Something critical happened!"})


The Standard Logger Interface

You may want use a standard log.Logger in your program.

	// stdlg implements log.Logger
	stdlg := lg.StandardLogger(logging.Info)
	stdlg.Println("some info")


Log Levels

An Entry may have one of a number of severity levels associated with it.

	logging.Entry{
		Payload: "something terrible happened!",
		Severity: logging.Critical,
	}

*/
package logging // import "cloud.google.com/go/logging"
