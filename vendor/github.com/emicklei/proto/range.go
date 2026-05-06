// Copyright (c) 2017 Ernest Micklei
//
// MIT License
//
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

package proto

import (
	"fmt"
	"strconv"
)

// Range is to specify number intervals (with special end value "max")
type Range struct {
	From, To int
	Max      bool
}

// SourceRepresentation return a single number if from = to. Returns <from> to <to> otherwise unless Max then return <from> to max.
func (r Range) SourceRepresentation() string {
	if r.Max {
		return fmt.Sprintf("%d to max", r.From)
	}
	if r.From == r.To {
		return strconv.Itoa(r.From)
	}
	return fmt.Sprintf("%d to %d", r.From, r.To)
}

// parseRanges is used to parse ranges for extensions and reserved
func parseRanges(p *Parser, n Visitee) (list []Range, err error) {
	seenTo := false
	negate := false // for numbers
	for {
		pos, tok, lit := p.next()
		if isString(lit) {
			return list, p.unexpected(lit, "integer, <to> <max>", n)
		}
		switch lit {
		case "-":
			negate = true
		case ",":
		case "to":
			seenTo = true
		case ";":
			p.nextPut(pos, tok, lit) // allow for inline comment parsing
			goto done
		case "max":
			if !seenTo {
				return list, p.unexpected(lit, "to", n)
			}
			from := list[len(list)-1]
			list = append(list[0:len(list)-1], Range{From: from.From, Max: true})
		default:
			// must be number
			i, err := strconv.Atoi(lit)
			if err != nil {
				return list, p.unexpected(lit, "range integer", n)
			}
			if negate {
				i = -i
				negate = false
			}
			if seenTo {
				// replace last two ranges with one
				if len(list) < 1 {
					p.unexpected(lit, "integer", n)
				}
				from := list[len(list)-1]
				list = append(list[0:len(list)-1], Range{From: from.From, To: i})
				seenTo = false
			} else {
				list = append(list, Range{From: i, To: i})
			}
		}
	}
done:
	return
}
