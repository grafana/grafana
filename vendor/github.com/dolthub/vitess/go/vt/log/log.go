/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// You can modify this file to hook up a different logging library instead of glog.
// If you adapt to a different logging framework, you may need to use that
// framework's equivalent of *Depth() functions so the file and line number printed
// point to the real caller instead of your adapter function.

package log

import "log"

var (
	// Flush ensures any pending I/O is written.
	Flush = func(){}

	// Info formats arguments like fmt.Print.
	Info = log.Print
	// Infof formats arguments like fmt.Printf.
	Infof = log.Printf

	// Warning formats arguments like fmt.Print.
	Warning = log.Print
	// Warningf formats arguments like fmt.Printf.
	Warningf = log.Printf

	// Error formats arguments like fmt.Print.
	Error = log.Print
	// Errorf formats arguments like fmt.Printf.
	Errorf = log.Printf

	// Fatal formats arguments like fmt.Print.
	Fatal = log.Fatal
	// Fatalf formats arguments like fmt.Printf
	Fatalf = log.Fatalf
)
