// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hcl

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"sort"

	wordwrap "github.com/mitchellh/go-wordwrap"
	"github.com/zclconf/go-cty/cty"
)

type diagnosticTextWriter struct {
	files map[string]*File
	wr    io.Writer
	width uint
	color bool
}

// NewDiagnosticTextWriter creates a DiagnosticWriter that writes diagnostics
// to the given writer as formatted text.
//
// It is designed to produce text appropriate to print in a monospaced font
// in a terminal of a particular width, or optionally with no width limit.
//
// The given width may be zero to disable word-wrapping of the detail text
// and truncation of source code snippets.
//
// If color is set to true, the output will include VT100 escape sequences to
// color-code the severity indicators. It is suggested to turn this off if
// the target writer is not a terminal.
func NewDiagnosticTextWriter(wr io.Writer, files map[string]*File, width uint, color bool) DiagnosticWriter {
	return &diagnosticTextWriter{
		files: files,
		wr:    wr,
		width: width,
		color: color,
	}
}

func (w *diagnosticTextWriter) WriteDiagnostic(diag *Diagnostic) error {
	if diag == nil {
		return errors.New("nil diagnostic")
	}

	var colorCode, highlightCode, resetCode string
	if w.color {
		switch diag.Severity {
		case DiagError:
			colorCode = "\x1b[31m"
		case DiagWarning:
			colorCode = "\x1b[33m"
		}
		resetCode = "\x1b[0m"
		highlightCode = "\x1b[1;4m"
	}

	var severityStr string
	switch diag.Severity {
	case DiagError:
		severityStr = "Error"
	case DiagWarning:
		severityStr = "Warning"
	default:
		// should never happen
		severityStr = "???????"
	}

	fmt.Fprintf(w.wr, "%s%s%s: %s\n\n", colorCode, severityStr, resetCode, diag.Summary)

	if diag.Subject != nil {
		snipRange := *diag.Subject
		highlightRange := snipRange
		if diag.Context != nil {
			// Show enough of the source code to include both the subject
			// and context ranges, which overlap in all reasonable
			// situations.
			snipRange = RangeOver(snipRange, *diag.Context)
		}
		// We can't illustrate an empty range, so we'll turn such ranges into
		// single-character ranges, which might not be totally valid (may point
		// off the end of a line, or off the end of the file) but are good
		// enough for the bounds checks we do below.
		if snipRange.Empty() {
			snipRange.End.Byte++
			snipRange.End.Column++
		}
		if highlightRange.Empty() {
			highlightRange.End.Byte++
			highlightRange.End.Column++
		}

		file := w.files[diag.Subject.Filename]
		if file == nil || file.Bytes == nil {
			fmt.Fprintf(w.wr, "  on %s line %d:\n  (source code not available)\n\n", diag.Subject.Filename, diag.Subject.Start.Line)
		} else {

			var contextLine string
			if diag.Subject != nil {
				contextLine = contextString(file, diag.Subject.Start.Byte)
				if contextLine != "" {
					contextLine = ", in " + contextLine
				}
			}

			fmt.Fprintf(w.wr, "  on %s line %d%s:\n", diag.Subject.Filename, diag.Subject.Start.Line, contextLine)

			src := file.Bytes
			sc := NewRangeScanner(src, diag.Subject.Filename, bufio.ScanLines)

			for sc.Scan() {
				lineRange := sc.Range()
				if !lineRange.Overlaps(snipRange) {
					continue
				}

				beforeRange, highlightedRange, afterRange := lineRange.PartitionAround(highlightRange)
				if highlightedRange.Empty() {
					fmt.Fprintf(w.wr, "%4d: %s\n", lineRange.Start.Line, sc.Bytes())
				} else {
					before := beforeRange.SliceBytes(src)
					highlighted := highlightedRange.SliceBytes(src)
					after := afterRange.SliceBytes(src)
					fmt.Fprintf(
						w.wr, "%4d: %s%s%s%s%s\n",
						lineRange.Start.Line,
						before,
						highlightCode, highlighted, resetCode,
						after,
					)
				}

			}

			w.wr.Write([]byte{'\n'})
		}

		if diag.Expression != nil && diag.EvalContext != nil {
			// We will attempt to render the values for any variables
			// referenced in the given expression as additional context, for
			// situations where the same expression is evaluated multiple
			// times in different scopes.
			expr := diag.Expression
			ctx := diag.EvalContext

			vars := expr.Variables()
			stmts := make([]string, 0, len(vars))
			seen := make(map[string]struct{}, len(vars))
			for _, traversal := range vars {
				val, diags := traversal.TraverseAbs(ctx)
				if diags.HasErrors() {
					// Skip anything that generates errors, since we probably
					// already have the same error in our diagnostics set
					// already.
					continue
				}

				traversalStr := w.traversalStr(traversal)
				if _, exists := seen[traversalStr]; exists {
					continue // don't show duplicates when the same variable is referenced multiple times
				}
				switch {
				case !val.IsKnown():
					// Can't say anything about this yet, then.
					continue
				case val.IsNull():
					stmts = append(stmts, fmt.Sprintf("%s set to null", traversalStr))
				default:
					stmts = append(stmts, fmt.Sprintf("%s as %s", traversalStr, w.valueStr(val)))
				}
				seen[traversalStr] = struct{}{}
			}

			sort.Strings(stmts) // FIXME: Should maybe use a traversal-aware sort that can sort numeric indexes properly?
			last := len(stmts) - 1

			for i, stmt := range stmts {
				switch i {
				case 0:
					w.wr.Write([]byte{'w', 'i', 't', 'h', ' '})
				default:
					w.wr.Write([]byte{' ', ' ', ' ', ' ', ' '})
				}
				w.wr.Write([]byte(stmt))
				switch i {
				case last:
					w.wr.Write([]byte{'.', '\n', '\n'})
				default:
					w.wr.Write([]byte{',', '\n'})
				}
			}
		}
	}

	if diag.Detail != "" {
		detail := diag.Detail
		if w.width != 0 {
			detail = wordwrap.WrapString(detail, w.width)
		}
		fmt.Fprintf(w.wr, "%s\n\n", detail)
	}

	return nil
}

func (w *diagnosticTextWriter) WriteDiagnostics(diags Diagnostics) error {
	for _, diag := range diags {
		err := w.WriteDiagnostic(diag)
		if err != nil {
			return err
		}
	}
	return nil
}

func (w *diagnosticTextWriter) traversalStr(traversal Traversal) string {
	// This is a specialized subset of traversal rendering tailored to
	// producing helpful contextual messages in diagnostics. It is not
	// comprehensive nor intended to be used for other purposes.

	var buf bytes.Buffer
	for _, step := range traversal {
		switch tStep := step.(type) {
		case TraverseRoot:
			buf.WriteString(tStep.Name)
		case TraverseAttr:
			buf.WriteByte('.')
			buf.WriteString(tStep.Name)
		case TraverseIndex:
			buf.WriteByte('[')
			if keyTy := tStep.Key.Type(); keyTy.IsPrimitiveType() {
				buf.WriteString(w.valueStr(tStep.Key))
			} else {
				// We'll just use a placeholder for more complex values,
				// since otherwise our result could grow ridiculously long.
				buf.WriteString("...")
			}
			buf.WriteByte(']')
		}
	}
	return buf.String()
}

func (w *diagnosticTextWriter) valueStr(val cty.Value) string {
	// This is a specialized subset of value rendering tailored to producing
	// helpful but concise messages in diagnostics. It is not comprehensive
	// nor intended to be used for other purposes.

	ty := val.Type()
	switch {
	case val.IsNull():
		return "null"
	case !val.IsKnown():
		// Should never happen here because we should filter before we get
		// in here, but we'll do something reasonable rather than panic.
		return "(not yet known)"
	case ty == cty.Bool:
		if val.True() {
			return "true"
		}
		return "false"
	case ty == cty.Number:
		bf := val.AsBigFloat()
		return bf.Text('g', 10)
	case ty == cty.String:
		// Go string syntax is not exactly the same as HCL native string syntax,
		// but we'll accept the minor edge-cases where this is different here
		// for now, just to get something reasonable here.
		return fmt.Sprintf("%q", val.AsString())
	case ty.IsCollectionType() || ty.IsTupleType():
		l := val.LengthInt()
		switch l {
		case 0:
			return "empty " + ty.FriendlyName()
		case 1:
			return ty.FriendlyName() + " with 1 element"
		default:
			return fmt.Sprintf("%s with %d elements", ty.FriendlyName(), l)
		}
	case ty.IsObjectType():
		atys := ty.AttributeTypes()
		l := len(atys)
		switch l {
		case 0:
			return "object with no attributes"
		case 1:
			var name string
			for k := range atys {
				name = k
			}
			return fmt.Sprintf("object with 1 attribute %q", name)
		default:
			return fmt.Sprintf("object with %d attributes", l)
		}
	default:
		return ty.FriendlyName()
	}
}

func contextString(file *File, offset int) string {
	type contextStringer interface {
		ContextString(offset int) string
	}

	if cser, ok := file.Nav.(contextStringer); ok {
		return cser.ContextString(offset)
	}
	return ""
}
