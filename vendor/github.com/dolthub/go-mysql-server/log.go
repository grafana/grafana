// Copyright 2020-2021 Dolthub, Inc.
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

package sqle

import (
	vtlog "github.com/dolthub/vitess/go/vt/log"
	"github.com/sirupsen/logrus"
)

func init() {
	// Flush ensures any pending I/O is written.
	vtlog.Flush = func() {}

	// Info formats arguments like fmt.Print.
	vtlog.Info = logrus.Info
	// Infof formats arguments like fmt.Printf.
	vtlog.Infof = logrus.Infof

	// Warning formats arguments like fmt.Print.
	vtlog.Warning = logrus.Warning
	// Warningf formats arguments like fmt.Printf.
	vtlog.Warningf = logrus.Warningf

	// Error formats arguments like fmt.Print.
	vtlog.Error = logrus.Error
	// Errorf formats arguments like fmt.Printf.
	vtlog.Errorf = logrus.Errorf

	// Fatal formats arguments like fmt.Print.
	vtlog.Fatal = logrus.Fatal
	// Fatalf formats arguments like fmt.Printf
	vtlog.Fatalf = logrus.Fatalf
}
