// Copyright 2019 CUE Authors
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

package cli

import (
	"bufio"
	"fmt"
	"io"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/internal/task"
)

func init() {
	task.Register("tool/cli.Print", newPrintCmd)
	task.Register("tool/cli.Ask", newAskCmd)

	// For backwards compatibility.
	task.Register("print", newPrintCmd)
}

type printCmd struct{}

func newPrintCmd(v cue.Value) (task.Runner, error) {
	return &printCmd{}, nil
}

func (c *printCmd) Run(ctx *task.Context) (res interface{}, err error) {
	str := ctx.String("text")
	if ctx.Err != nil {
		return nil, ctx.Err
	}
	fmt.Fprintln(ctx.Stdout, str)
	return nil, nil
}

type askCmd struct{}

func newAskCmd(v cue.Value) (task.Runner, error) {
	return &askCmd{}, nil
}

type oneByteReader struct {
	r io.Reader
}

func (r *oneByteReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	return r.r.Read(p[:1])
}

func (c *askCmd) Run(ctx *task.Context) (res interface{}, err error) {
	str := ctx.String("prompt")
	if ctx.Err != nil {
		return nil, ctx.Err
	}
	if str != "" {
		fmt.Fprint(ctx.Stdout, str+" ")
	}

	// Roger is convinced that bufio.Scanner will only issue as many reads
	// as it needs, so that limiting it to one-byte reads should be enough
	// to not read any bytes after a newline.
	// This behavior is true today but technically not documented,
	// so Roger will send a CL to properly document it.
	//
	// TODO(mvdan): come back to remove this notice once Roger's CL is
	// approved, or to rewrite the code if it is rejected.
	scanner := bufio.NewScanner(&oneByteReader{ctx.Stdin})
	var response string
	if scanner.Scan() {
		response = scanner.Text()
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	update := map[string]interface{}{"response": response}

	switch v := ctx.Lookup("response"); v.IncompleteKind() {
	case cue.BoolKind:
		switch strings.ToLower(response) {
		case "yes":
			update["response"] = true
		default:
			update["response"] = false
		}
	case cue.StringKind:
		// already set above
	}
	return update, nil
}
