package asmfmt

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"strings"
	"unicode"
)

// Format the input and return the formatted data.
// If any error is encountered, no data will be returned.
func Format(in io.Reader) ([]byte, error) {
	src := bufio.NewReaderSize(in, 512<<10)
	dst := &bytes.Buffer{}
	state := fstate{out: dst, defines: make(map[string]struct{})}
	for {
		data, _, err := src.ReadLine()
		if err == io.EOF {
			state.flush()
			break
		}
		if err != nil {
			return nil, err
		}
		err = state.addLine(data)
		if err != nil {
			return nil, err
		}
	}
	return dst.Bytes(), nil
}

type fstate struct {
	out           *bytes.Buffer
	insideBlock   bool // Block comment
	indentation   int  // Indentation level
	lastEmpty     bool
	lastComment   bool
	lastStar      bool // Block comment, last line started with a star.
	lastLabel     bool
	anyContents   bool
	lastContinued bool // Last line continued
	queued        []statement
	comments      []string
	defines       map[string]struct{}
}

type statement struct {
	instruction string
	params      []string // Parameters
	comment     string   // Without slashes
	function    bool     // Probably define call
	continued   bool     // Multiline statement, continues on next line
	contComment bool     // Multiline statement, comment only
}

// Add a new input line.
// Since you are looking at ths code:
// This code has grown over a considerable amount of time,
// and deserves a rewrite with proper parsing instead of this hodgepodge.
// Its output is stable, and could be used as reference for a rewrite.
func (f *fstate) addLine(b []byte) error {
	if bytes.Contains(b, []byte{0}) {
		return fmt.Errorf("zero (0) byte in input. file is unlikely an assembler file")
	}
	s := string(b)
	// Inside block comment
	if f.insideBlock {
		defer func() {
			f.lastComment = true
		}()
		if strings.Contains(s, "*/") {
			ends := strings.Index(s, "*/")
			end := s[:ends]
			if strings.HasPrefix(strings.TrimSpace(s), "*") && f.lastStar {
				end = strings.TrimSpace(end) + " "
			}
			end = end + "*/"
			f.insideBlock = false
			s = strings.TrimSpace(s[ends+2:])
			if strings.HasSuffix(s, "\\") {
				end = end + " \\"
				if len(s) == 1 {
					s = ""
				}
			}
			f.out.WriteString(end + "\n")
			if len(s) == 0 {
				return nil
			}
		} else {
			// Insert a space on lines that begin with '*'
			if strings.HasPrefix(strings.TrimSpace(s), "*") {
				s = strings.TrimSpace(s)
				f.out.WriteByte(' ')
				f.lastStar = true
			} else {
				f.lastStar = false
			}
			fmt.Fprintln(f.out, s)
			return nil
		}
	}
	s = strings.TrimSpace(s)

	// Comment is the the only line content.
	if strings.HasPrefix(s, "//") {
		// Non-comment content is now added.
		defer func() {
			f.anyContents = true
			f.lastEmpty = false
			f.lastStar = false
		}()

		s = strings.TrimPrefix(s, "//")
		if len(f.queued) > 0 {
			f.flush()
		}
		// Newline before comments
		if len(f.comments) == 0 {
			f.newLine()
		}

		// Preserve whitespace if the first character after the comment
		// is a whitespace
		ts := strings.TrimSpace(s)
		var q string
		if (ts != s && len(ts) > 0) || (len(s) > 0 && strings.ContainsAny(string(s[0]), `+/`)) || (len(s) >= 8 && s[:8] == "go:build") {
			q = fmt.Sprint("//" + s)
		} else if len(ts) > 0 {
			// Insert a space before the comment
			q = fmt.Sprint("// " + s)
		} else {
			q = fmt.Sprint("//")
		}
		f.comments = append(f.comments, q)
		f.lastComment = true
		return nil
	}

	// Handle end-of blockcomments.
	if strings.Contains(s, "/*") && !strings.HasSuffix(s, `\`) {
		starts := strings.Index(s, "/*")
		ends := strings.Index(s, "*/")
		lineComment := strings.Index(s, "//")
		if lineComment >= 0 {
			if lineComment < starts {
				goto exitcomm
			}
			if lineComment < ends && !f.insideBlock {
				goto exitcomm
			}
			if ends > starts && ends < lineComment {
				// If there is something left between the end and the line comment, keep it.
				if len(strings.TrimSpace(s[ends:lineComment])) > 0 {
					goto exitcomm
				}
			}
		}
		pre := s[:starts]
		pre = strings.TrimSpace(pre)

		if len(pre) > 0 {
			if strings.HasSuffix(s, `\`) {
				goto exitcomm
			}
			// Add items before the comment section as a line.
			if ends > starts && ends >= len(s)-2 {
				comm := strings.TrimSpace(s[starts+2 : ends])
				return f.addLine([]byte(pre + " //" + comm))
			}
			err := f.addLine([]byte(pre))
			if err != nil {
				return err
			}
		}

		f.flush()

		// Convert single line /* comment */ to // Comment
		if ends > starts && ends >= len(s)-2 {
			return f.addLine([]byte("// " + strings.TrimSpace(s[starts+2:ends])))
		}

		// Comments inside multiline defines.
		if strings.HasSuffix(s, `\`) {
			f.indent()
			s = strings.TrimSpace(strings.TrimSuffix(s, `\`)) + ` \`
		}

		// Otherwise output
		fmt.Fprint(f.out, "/*")
		s = strings.TrimSpace(s[starts+2:])
		f.insideBlock = ends < 0
		f.lastComment = true
		f.lastStar = true
		if len(s) == 0 {
			f.out.WriteByte('\n')
			return nil
		}
		f.out.WriteByte(' ')
		f.out.WriteString(s + "\n")
		return nil
	}
exitcomm:

	if len(s) == 0 {
		f.flush()

		// No more than two empty lines in a row
		// cannot start with NL
		if f.lastEmpty || !f.anyContents {
			return nil
		}
		if f.lastContinued {
			f.indentation = 0
			f.lastContinued = false
		}
		f.lastEmpty = true
		return f.out.WriteByte('\n')
	}

	// Non-comment content is now added.
	defer func() {
		f.anyContents = true
		f.lastEmpty = false
		f.lastStar = false
		f.lastComment = false
	}()

	st := newStatement(s, f.defines)
	if st == nil {
		return nil
	}
	if def := st.define(); def != "" {
		f.defines[def] = struct{}{}
	}
	if st.instruction == "package" {
		if _, ok := f.defines["package"]; !ok {
			return fmt.Errorf("package instruction found. Go files are not supported")
		}
	}

	// Move anything that isn't a comment to the next line
	if st.isLabel() && len(st.params) > 0 && !st.continued {
		idx := strings.Index(s, ":")
		st = newStatement(s[:idx+1], f.defines)
		defer f.addLine([]byte(s[idx+1:]))
	}

	// Should this line be at level 0?
	if st.level0() && !(st.continued && f.lastContinued) {
		if st.isTEXT() && len(f.queued) == 0 && len(f.comments) > 0 {
			f.indentation = 0
		}
		f.flush()

		// Add newline before jump target.
		f.newLine()

		f.indentation = 0
		f.queued = append(f.queued, *st)
		f.flush()

		if !st.isPreProcessor() && !st.isGlobal() {
			f.indentation = 1
		}
		f.lastLabel = true
		return nil
	}

	defer func() {
		f.lastLabel = false
	}()
	f.queued = append(f.queued, *st)
	if st.isTerminator() || (f.lastContinued && !st.continued) {
		// Terminators should always be at level 1
		f.indentation = 1
		f.flush()
		f.indentation = 0
	} else if st.isCommand() {
		// handles cases where a JMP/RET isn't a terminator
		f.indentation = 1
	}
	f.lastContinued = st.continued
	return nil
}

// indent the current line with current indentation.
func (f *fstate) indent() {
	for i := 0; i < f.indentation; i++ {
		f.out.WriteByte('\t')
	}
}

// flush any queued comments and commands
func (f *fstate) flush() {
	for _, line := range f.comments {
		f.indent()
		fmt.Fprintln(f.out, line)
	}
	f.comments = nil
	s := formatStatements(f.queued)
	for _, line := range s {
		f.indent()
		fmt.Fprintln(f.out, line)
	}
	f.queued = nil
}

// Add a newline, unless last line was empty or a comment
func (f *fstate) newLine() {
	// Always newline before comment-only line.
	if !f.lastEmpty && !f.lastComment && !f.lastLabel && f.anyContents {
		f.out.WriteByte('\n')
	}
}

// newStatement will parse a line and return it as a statement.
// Will return nil if the line is empty after whitespace removal.
func newStatement(s string, defs map[string]struct{}) *statement {
	s = strings.TrimSpace(s)
	st := statement{}

	// Fix where a comment start if any
	// We need to make sure that the comment isn't embedded in a string literal
	startcom := strings.Index(s, "//")
	startstr := strings.Index(s, "\"")
	for endstr := 0; startcom > startstr && startstr > endstr; {
		// This does not check for any escaping (i.e. "\"")
		endstr = startstr + 1 + strings.Index(s[startstr+1:], "\"")
		startcom = endstr + strings.Index(s[endstr:], "//")
		if startcom < endstr {
			startcom = 0
		}
		startstr = endstr + 1 + strings.Index(s[endstr+1:], "\"")
	}
	if startcom > 0 {
		st.comment = strings.TrimSpace(s[startcom+2:])
		s = strings.TrimSpace(s[:startcom])
	}

	// Split into fields
	fields := strings.Fields(s)
	if len(fields) < 1 {
		return nil
	}
	st.instruction = fields[0]

	// Handle defined macro calls
	if len(defs) > 0 {
		inst := strings.Split(st.instruction, "(")[0]
		if _, ok := defs[inst]; ok {
			st.function = true
		}
	}
	if strings.HasPrefix(s, "/*") {
		st.function = true
	}
	// We may not have it defined as a macro, if defined in an external
	// .h file, so we try to detect the remaining ones.
	if strings.ContainsAny(st.instruction, "(_") {
		st.function = true
	}
	if len(st.params) > 0 && strings.HasPrefix(st.params[0], "(") {
		st.function = true
	}
	if st.function {
		st.instruction = s
	}

	if st.instruction == "\\" && len(st.comment) > 0 {
		st.instruction = fmt.Sprintf("\\ // %s", st.comment)
		st.comment = ""
		st.function = true
		st.continued = true
		st.contComment = true
	}

	s = strings.TrimPrefix(s, st.instruction)
	st.instruction = strings.Replace(st.instruction, "\t", " ", -1)
	s = strings.TrimSpace(s)

	st.setParams(s)

	// Remove trailing ;
	if len(st.params) > 0 {
		st.params[len(st.params)-1] = strings.TrimSuffix(st.params[len(st.params)-1], ";")
	} else {
		st.instruction = strings.TrimSuffix(st.instruction, ";")
	}

	// Register line continuations.
	if len(st.params) > 0 {
		p := st.params[len(st.params)-1]
		if st.willContinue() {
			p = strings.TrimSuffix(st.params[len(st.params)-1], `\`)
			p = strings.TrimSpace(p)
			if len(p) > 0 {
				st.params[len(st.params)-1] = p
			} else {
				st.params = st.params[:len(st.params)-1]
			}
			st.continued = true
		}
	}
	if strings.HasSuffix(st.instruction, `\`) && !st.contComment {
		i := strings.TrimSuffix(st.instruction, `\`)
		st.instruction = strings.TrimSpace(i)
		st.continued = true
	}

	if len(st.params) == 0 && !st.isLabel() {
		st.function = true
	}

	return &st
}

// setParams will add the string given as parameters.
// Inline comments are retained.
// There will be a space after ",", unless inside a comment.
// A tab is replaced by a space for consistent indentation.
func (st *statement) setParams(s string) {
	st.params = make([]string, 0)
	runes := []rune(s)
	last := '\n'
	inComment := false
	inStringLiteral := false
	inCharLiteral := false
	out := make([]rune, 0, len(runes))
	for _, r := range runes {
		switch r {
		case '"':
			if last != '\\' && inStringLiteral {
				inStringLiteral = false
			} else if last != '\\' && !inStringLiteral {
				inStringLiteral = true
			}
		case '\'':
			if last != '\\' && inCharLiteral {
				inCharLiteral = false
			} else if last != '\\' && !inCharLiteral {
				inCharLiteral = true
			}
		case ',':
			if inComment || inStringLiteral || inCharLiteral {
				break
			}
			c := strings.TrimSpace(string(out))
			if len(c) > 0 {
				st.params = append(st.params, c)
			}
			out = out[0:0]
			continue
		case '/':
			if last == '*' && inComment {
				inComment = false
			}
		case '*':
			if last == '/' {
				inComment = true
			}
		case '\t':
			if !st.isPreProcessor() {
				r = ' '
			}
		case ';':
			if inComment || inStringLiteral || inCharLiteral {
				break
			}
			out = []rune(strings.TrimSpace(string(out)) + "; ")
			last = r
			continue
		}
		if last == ';' && unicode.IsSpace(r) {
			continue
		}
		last = r
		out = append(out, r)
	}
	c := strings.TrimSpace(string(out))
	if len(c) > 0 {
		st.params = append(st.params, c)
	}
}

// Return true if this line should be at indentation level 0.
func (st statement) level0() bool {
	return st.isLabel() || st.isTEXT() || st.isPreProcessor()
}

// Will return true if the statement is a label.
func (st statement) isLabel() bool {
	return strings.HasSuffix(st.instruction, ":")
}

// isPreProcessor will return if the statement is a preprocessor statement.
func (st statement) isPreProcessor() bool {
	return strings.HasPrefix(st.instruction, "#")
}

// isGlobal returns true if the current instruction is
// a global. Currently that is DATA, GLOBL, FUNCDATA and PCDATA
func (st statement) isGlobal() bool {
	up := strings.ToUpper(st.instruction)
	switch up {
	case "DATA", "GLOBL", "FUNCDATA", "PCDATA":
		return true
	default:
		return false
	}
}

// isTEXT returns true if the instruction is "TEXT"
// or one of the "isGlobal" types
func (st statement) isTEXT() bool {
	up := strings.ToUpper(st.instruction)
	return up == "TEXT" || st.isGlobal()
}

// We attempt to identify "terminators", after which
// indentation is likely to be level 0.
func (st statement) isTerminator() bool {
	up := strings.ToUpper(st.instruction)
	return up == "RET" || up == "JMP"
}

// Detects commands based on case.
func (st statement) isCommand() bool {
	if st.isLabel() {
		return false
	}
	up := strings.ToUpper(st.instruction)
	return up == st.instruction
}

// Detect if last character is '\', indicating a multiline statement.
func (st statement) willContinue() bool {
	if st.continued {
		return true
	}
	if len(st.params) == 0 {
		return false
	}
	return strings.HasSuffix(st.params[len(st.params)-1], `\`)
}

// define returns the macro defined in this line.
// if none is defined "" is returned.
func (st statement) define() string {
	if st.instruction == "#define" && len(st.params) > 0 {
		r := strings.TrimSpace(strings.Split(st.params[0], "(")[0])
		r = strings.Trim(r, `\`)
		return r
	}
	return ""
}

func (st *statement) cleanParams() {
	// Remove whitespace before semicolons
	if strings.HasSuffix(st.instruction, ";") {
		s := strings.TrimSuffix(st.instruction, ";")
		st.instruction = strings.TrimSpace(s) + ";"
	}
}

// formatStatements will format a slice of statements and return each line
// as a separate string.
// Comments and line-continuation (\) are aligned with spaces.
func formatStatements(s []statement) []string {
	res := make([]string, len(s))
	maxParam := 0 // Length of longest parameter
	maxInstr := 0 // Length of longest instruction WITH parameters.
	maxAlone := 0 // Length of longest instruction without parameters.
	for i, x := range s {
		// Clean up and store
		x.cleanParams()
		s[i] = x

		il := len([]rune(x.instruction)) + 1 // Instruction length
		l := il
		// Ignore length if we are a define "function"
		// or we are a parameterless instruction.
		if l > maxInstr && !x.function && !(x.isCommand() && len(x.params) == 0) {
			maxInstr = l
		}
		if x.function && il > maxAlone {
			maxAlone = il
		}
		if len(x.params) > 1 {
			l = 2 * (len(x.params) - 1) // Spaces between parameters
		} else {
			l = 0
		}
		// Add parameters
		for _, y := range x.params {
			l += len([]rune(y))
		}
		l++
		if l > maxParam {
			maxParam = l
		}
	}

	maxParam += maxInstr
	if maxInstr == 0 {
		maxInstr = maxAlone
	}

	for i, x := range s {
		r := x.instruction
		if x.contComment {
			res[i] = x.instruction
			continue
		}
		p := strings.Join(x.params, ", ")
		if len(x.params) > 0 || len(x.comment) > 0 {
			for len(r) < maxInstr {
				r += " "
			}
		}
		r = r + p
		if len(x.comment) > 0 && !x.continued {
			it := maxParam - len([]rune(r))
			for i := 0; i < it; i++ {
				r = r + " "
			}
			r += fmt.Sprintf("// %s", x.comment)
		}

		if x.continued {
			// Find continuation placement.
			it := maxParam - len([]rune(r))
			if maxAlone > maxParam {
				it = maxAlone - len([]rune(r))
			}
			for i := 0; i < it; i++ {
				r = r + " "
			}
			r += `\`
			// Add comment, if any.
			if len(x.comment) > 0 {
				r += " // " + x.comment
			}
		}
		res[i] = r
	}
	return res
}
