// Copyright 2017 Google Inc. All Rights Reserved.
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

package profiler

import (
	"bytes"
	"regexp"
	"runtime"
	"strings"

	"github.com/google/pprof/profile"
)

var shouldAssumeSymbolized = isSymbolizedGoVersion(runtime.Version())

type function interface {
	Name() string
	FileLine(pc uintptr) (string, int)
}

// funcForPC is a wrapper for runtime.FuncForPC. Defined as var for testing.
var funcForPC = func(pc uintptr) function {
	if f := runtime.FuncForPC(pc); f != nil {
		return f
	}
	return nil
}

// parseAndSymbolize parses a profile from a buffer, symbolizes it
// if it's not yet symbolized, and writes the profile back as a
// gzip-compressed marshaled protobuf.
func parseAndSymbolize(data *bytes.Buffer) error {
	p, err := profile.ParseData(data.Bytes())
	if err != nil {
		return err
	}

	// Do nothing if the profile is already symbolized.
	if symbolized(p) {
		return nil
	}
	// Clear the profile functions to avoid creating duplicates.
	p.Function = nil
	symbolize(p)
	data.Reset()
	return p.Write(data)
}

// isSymbolizedGoVersion returns true if Go version equals to or is
// higher than Go 1.9. Starting Go 1.9 the profiles are symbolized
// by runtime/pprof.
func isSymbolizedGoVersion(goVersion string) bool {
	r, err := regexp.Compile(`go(1\.9|1\.[1-9][0-9]|[2-9]).*`)
	if err == nil && r.MatchString(goVersion) {
		return true
	}
	return false
}

// symbolized checks if all locations have symbolized function
// information.
func symbolized(p *profile.Profile) bool {
	for _, l := range p.Location {
		if len(l.Line) == 0 || l.Line[0].Function == nil {
			return false
		}
	}
	return true
}

func symbolize(p *profile.Profile) {
	fns := profileFunctionMap{}
	for _, l := range p.Location {
		pc := uintptr(l.Address)
		f := funcForPC(pc)
		if f == nil {
			continue
		}
		file, lineno := f.FileLine(pc)
		l.Line = []profile.Line{
			{
				Function: fns.findOrAddFunction(f.Name(), file, p),
				Line:     int64(lineno),
			},
		}
	}
	// Trim runtime functions. Always hide runtime.goexit. Other runtime
	// functions are only hidden for heap profile when they appear at the beginning.
	isHeapProfile := p.PeriodType != nil && p.PeriodType.Type == "space"
	for _, s := range p.Sample {
		show := !isHeapProfile
		var i int
		for _, l := range s.Location {
			if len(l.Line) > 0 && l.Line[0].Function != nil {
				name := l.Line[0].Function.Name
				if name == "runtime.goexit" || !show && strings.HasPrefix(name, "runtime.") {
					continue
				}
			}
			show = true
			s.Location[i] = l
			i++
		}
		// If all locations of a sample are trimmed, keep the root location.
		if i == 0 && len(s.Location) > 0 {
			s.Location[0] = s.Location[len(s.Location)-1]
			i = 1
		}
		s.Location = s.Location[:i]
	}
}

type profileFunctionMap map[profile.Function]*profile.Function

func (fns profileFunctionMap) findOrAddFunction(name, filename string, p *profile.Profile) *profile.Function {
	f := profile.Function{
		Name:       name,
		SystemName: name,
		Filename:   filename,
	}
	if fp := fns[f]; fp != nil {
		return fp
	}
	fp := new(profile.Function)
	fns[f] = fp

	*fp = f
	fp.ID = uint64(len(p.Function) + 1)
	p.Function = append(p.Function, fp)
	return fp
}
