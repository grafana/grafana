// Copyright 2013 Martini Authors
// Copyright 2014 The Macaron Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package macaron

import (
	"fmt"
	"log"
	"net/http"
	"reflect"
	"runtime"
	"time"
)

var (
	ColorLog      = true
	LogTimeFormat = "2006-01-02 15:04:05"
)

func init() {
	ColorLog = runtime.GOOS != "windows"
}

// LoggerInvoker is an inject.FastInvoker wrapper of func(ctx *Context, log *log.Logger).
type LoggerInvoker func(ctx *Context, log *log.Logger)

func (invoke LoggerInvoker) Invoke(params []interface{}) ([]reflect.Value, error) {
	invoke(params[0].(*Context), params[1].(*log.Logger))
	return nil, nil
}

// Logger returns a middleware handler that logs the request as it goes in and the response as it goes out.
func Logger() Handler {
	return func(ctx *Context, log *log.Logger) {
		start := time.Now()

		log.Printf("%s: Started %s %s for %s", time.Now().Format(LogTimeFormat), ctx.Req.Method, ctx.Req.RequestURI, ctx.RemoteAddr())

		rw := ctx.Resp.(ResponseWriter)
		ctx.Next()

		content := fmt.Sprintf("%s: Completed %s %s %v %s in %v", time.Now().Format(LogTimeFormat), ctx.Req.Method, ctx.Req.RequestURI, rw.Status(), http.StatusText(rw.Status()), time.Since(start))
		if ColorLog {
			switch rw.Status() {
			case 200, 201, 202:
				content = fmt.Sprintf("\033[1;32m%s\033[0m", content)
			case 301, 302:
				content = fmt.Sprintf("\033[1;37m%s\033[0m", content)
			case 304:
				content = fmt.Sprintf("\033[1;33m%s\033[0m", content)
			case 401, 403:
				content = fmt.Sprintf("\033[4;31m%s\033[0m", content)
			case 404:
				content = fmt.Sprintf("\033[1;31m%s\033[0m", content)
			case 500:
				content = fmt.Sprintf("\033[1;36m%s\033[0m", content)
			}
		}
		log.Println(content)
	}
}
