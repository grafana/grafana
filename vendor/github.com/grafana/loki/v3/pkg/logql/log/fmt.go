package log

import (
	"bytes"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"text/template"
	"text/template/parse"
	"time"

	"github.com/Masterminds/sprig/v3"
	"github.com/grafana/regexp"

	"github.com/grafana/loki/v3/pkg/logqlmodel"
)

const (
	functionLineName      = "__line__"
	functionTimestampName = "__timestamp__"
)

var (
	_ Stage = &LineFormatter{}
	_ Stage = &LabelsFormatter{}

	// Available map of functions for the text template engine.
	functionMap = template.FuncMap{
		// olds functions deprecated.
		"ToLower":    strings.ToLower,
		"ToUpper":    strings.ToUpper,
		"Replace":    strings.Replace,
		"Trim":       strings.Trim,
		"TrimLeft":   strings.TrimLeft,
		"TrimRight":  strings.TrimRight,
		"TrimPrefix": strings.TrimPrefix,
		"TrimSuffix": strings.TrimSuffix,
		"TrimSpace":  strings.TrimSpace,
		"regexReplaceAll": func(regex string, s string, repl string) (string, error) {
			r, err := regexp.Compile(regex)
			if err != nil {
				return "", err
			}
			return r.ReplaceAllString(s, repl), nil
		},
		"regexReplaceAllLiteral": func(regex string, s string, repl string) (string, error) {
			r, err := regexp.Compile(regex)
			if err != nil {
				return "", err
			}
			return r.ReplaceAllLiteralString(s, repl), nil
		},
		"count": func(regexsubstr string, s string) (int, error) {
			r, err := regexp.Compile(regexsubstr)
			if err != nil {
				return 0, err
			}
			matches := r.FindAllStringIndex(s, -1)
			return len(matches), nil
		},
		"urldecode":        url.QueryUnescape,
		"urlencode":        url.QueryEscape,
		"bytes":            convertBytes,
		"duration":         convertDuration,
		"duration_seconds": convertDuration,
		"unixEpochMillis":  unixEpochMillis,
		"unixEpochNanos":   unixEpochNanos,
		"toDateInZone":     toDateInZone,
		"unixToTime":       unixToTime,
		"alignLeft":        alignLeft,
		"alignRight":       alignRight,
	}

	// sprig template functions
	templateFunctions = []string{
		"b64enc",
		"b64dec",
		"lower",
		"upper",
		"title",
		"trunc",
		"substr",
		"contains",
		"hasPrefix",
		"hasSuffix",
		"indent",
		"nindent",
		"replace",
		"repeat",
		"trim",
		"trimAll",
		"trimSuffix",
		"trimPrefix",
		"int",
		"float64",
		"add",
		"sub",
		"mul",
		"div",
		"mod",
		"addf",
		"subf",
		"mulf",
		"divf",
		"max",
		"min",
		"maxf",
		"minf",
		"ceil",
		"floor",
		"round",
		"fromJson",
		"date",
		"toDate",
		"now",
		"unixEpoch",
		"default",
	}
)

func addLineAndTimestampFunctions(currLine func() string, currTimestamp func() int64) map[string]interface{} {
	functions := make(map[string]interface{}, len(functionMap)+2)
	for k, v := range functionMap {
		functions[k] = v
	}
	functions[functionLineName] = func() string {
		return currLine()
	}
	functions[functionTimestampName] = func() time.Time {
		return time.Unix(0, currTimestamp())
	}
	return functions
}

// toEpoch converts a string with Unix time to an time Value
func unixToTime(epoch string) (time.Time, error) {
	var ct time.Time
	l := len(epoch)
	i, err := strconv.ParseInt(epoch, 10, 64)
	if err != nil {
		return ct, fmt.Errorf("unable to parse time '%v': %w", epoch, err)
	}
	switch l {
	case 5:
		// days 19373
		return time.Unix(i*86400, 0), nil
	case 10:
		// seconds 1673798889
		return time.Unix(i, 0), nil
	case 13:
		// milliseconds 1673798889902
		return time.Unix(0, i*1000*1000), nil
	case 16:
		// microseconds 1673798889902000
		return time.Unix(0, i*1000), nil
	case 19:
		// nanoseconds 1673798889902000000
		return time.Unix(0, i), nil
	default:
		return ct, fmt.Errorf("unable to parse time '%v': %w", epoch, err)
	}
}

func unixEpochMillis(date time.Time) string {
	return strconv.FormatInt(date.UnixMilli(), 10)
}

func unixEpochNanos(date time.Time) string {
	return strconv.FormatInt(date.UnixNano(), 10)
}

func toDateInZone(fmt, zone, str string) time.Time {
	loc, err := time.LoadLocation(zone)
	if err != nil {
		loc, _ = time.LoadLocation("UTC")
	}
	t, _ := time.ParseInLocation(fmt, str, loc)
	return t
}

func init() {
	sprigFuncMap := sprig.GenericFuncMap()
	for _, v := range templateFunctions {
		if function, ok := sprigFuncMap[v]; ok {
			functionMap[v] = function
		}
	}
}

type LineFormatter struct {
	*template.Template
	buf *bytes.Buffer

	currentLine []byte
	currentTs   int64
}

// NewFormatter creates a new log line formatter from a given text template.
func NewFormatter(tmpl string) (*LineFormatter, error) {
	lf := &LineFormatter{
		buf: bytes.NewBuffer(make([]byte, 4096)),
	}

	functions := addLineAndTimestampFunctions(func() string {
		return unsafeGetString(lf.currentLine)
	}, func() int64 {
		return lf.currentTs
	})

	t, err := template.New("line").Option("missingkey=zero").Funcs(functions).Parse(tmpl)
	if err != nil {
		return nil, fmt.Errorf("invalid line template: %w", err)
	}
	lf.Template = t
	return lf, nil
}

func (lf *LineFormatter) Process(ts int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	lf.buf.Reset()
	lf.currentLine = line
	lf.currentTs = ts

	// map now is taking from a pool
	m, ret := lbs.Map()
	defer func() {
		if ret { // if we return the base map from the labels builder we should not put it back in the pool
			smp.Put(m)
		}
	}()
	if err := lf.Template.Execute(lf.buf, m); err != nil {
		lbs.SetErr(errTemplateFormat)
		lbs.SetErrorDetails(err.Error())
		return line, true
	}
	return lf.buf.Bytes(), true
}

func (lf *LineFormatter) RequiredLabelNames() []string {
	return uniqueString(listNodeFields([]parse.Node{lf.Root}))
}

func listNodeFields(nodes []parse.Node) []string {
	var res []string
	for _, node := range nodes {
		switch node.Type() {
		case parse.NodePipe:
			res = append(res, listNodeFieldsFromPipe(node.(*parse.PipeNode))...)
		case parse.NodeAction:
			res = append(res, listNodeFieldsFromPipe(node.(*parse.ActionNode).Pipe)...)
		case parse.NodeList:
			res = append(res, listNodeFields(node.(*parse.ListNode).Nodes)...)
		case parse.NodeCommand:
			res = append(res, listNodeFields(node.(*parse.CommandNode).Args)...)
		case parse.NodeIf, parse.NodeWith, parse.NodeRange:
			res = append(res, listNodeFieldsFromBranch(node)...)
		case parse.NodeField:
			res = append(res, node.(*parse.FieldNode).Ident...)
		}
	}
	return res
}

func listNodeFieldsFromBranch(node parse.Node) []string {
	var res []string
	var b parse.BranchNode
	switch node.Type() {
	case parse.NodeIf:
		b = node.(*parse.IfNode).BranchNode
	case parse.NodeWith:
		b = node.(*parse.WithNode).BranchNode
	case parse.NodeRange:
		b = node.(*parse.RangeNode).BranchNode
	default:
		return res
	}
	if b.Pipe != nil {
		res = append(res, listNodeFieldsFromPipe(b.Pipe)...)
	}
	if b.List != nil {
		res = append(res, listNodeFields(b.List.Nodes)...)
	}
	if b.ElseList != nil {
		res = append(res, listNodeFields(b.ElseList.Nodes)...)
	}
	return res
}

func listNodeFieldsFromPipe(p *parse.PipeNode) []string {
	var res []string
	for _, c := range p.Cmds {
		res = append(res, listNodeFields(c.Args)...)
	}
	return res
}

// LabelFmt is a configuration struct for formatting a label.
type LabelFmt struct {
	Name  string
	Value string

	Rename bool
}

// NewRenameLabelFmt creates a configuration to rename a label.
func NewRenameLabelFmt(dst, target string) LabelFmt {
	return LabelFmt{
		Name:   dst,
		Rename: true,
		Value:  target,
	}
}

// NewTemplateLabelFmt creates a configuration to format a label using text template.
func NewTemplateLabelFmt(dst, template string) LabelFmt {
	return LabelFmt{
		Name:   dst,
		Rename: false,
		Value:  template,
	}
}

type labelFormatter struct {
	tmpl *template.Template
	LabelFmt
}

type LabelsFormatter struct {
	formats []labelFormatter
	buf     *bytes.Buffer

	currentLine []byte
	currentTs   int64
}

// NewLabelsFormatter creates a new formatter that can format multiple labels at once.
// Either by renaming or using text template.
// It is not allowed to reformat the same label twice within the same formatter.
func NewLabelsFormatter(fmts []LabelFmt) (*LabelsFormatter, error) {
	if err := validate(fmts); err != nil {
		return nil, err
	}
	formats := make([]labelFormatter, 0, len(fmts))

	lf := &LabelsFormatter{
		buf: bytes.NewBuffer(make([]byte, 1024)),
	}

	functions := addLineAndTimestampFunctions(func() string {
		return unsafeGetString(lf.currentLine)
	}, func() int64 {
		return lf.currentTs
	})

	for _, fm := range fmts {
		toAdd := labelFormatter{LabelFmt: fm}
		if !fm.Rename {
			t, err := template.New("label").Option("missingkey=zero").Funcs(functions).Parse(fm.Value)
			if err != nil {
				return nil, fmt.Errorf("invalid template for label '%s': %s", fm.Name, err)
			}
			toAdd.tmpl = t
		}
		formats = append(formats, toAdd)
	}
	lf.formats = formats
	return lf, nil
}

func validate(fmts []LabelFmt) error {
	// it would be too confusing to rename and change the same label value.
	// To avoid confusion we allow to have a label name only once per stage.
	uniqueLabelName := map[string]struct{}{}
	for _, f := range fmts {
		if f.Name == logqlmodel.ErrorLabel {
			return fmt.Errorf("%s cannot be formatted", f.Name)
		}
		if _, ok := uniqueLabelName[f.Name]; ok {
			return fmt.Errorf("multiple label name '%s' not allowed in a single format operation", f.Name)
		}
		uniqueLabelName[f.Name] = struct{}{}
	}
	return nil
}

func (lf *LabelsFormatter) Process(ts int64, l []byte, lbs *LabelsBuilder) ([]byte, bool) {
	lf.currentLine = l
	lf.currentTs = ts

	var m = smp.Get()
	defer smp.Put(m)
	for _, f := range lf.formats {
		if f.Rename {
			v, category, ok := lbs.GetWithCategory(f.Value)
			if ok {
				lbs.Set(category, f.Name, v)
				lbs.Del(f.Value)
			}
			continue
		}
		lf.buf.Reset()
		if len(m) == 0 {
			lbs.IntoMap(m)
		}
		if err := f.tmpl.Execute(lf.buf, m); err != nil {
			lbs.SetErr(errTemplateFormat)
			lbs.SetErrorDetails(err.Error())
			continue
		}
		lbs.Set(ParsedLabel, f.Name, lf.buf.String())
	}
	return l, true
}

func (lf *LabelsFormatter) RequiredLabelNames() []string {
	var names []string
	for _, fm := range lf.formats {
		if fm.Rename {
			names = append(names, fm.Value)
			continue
		}
		names = append(names, listNodeFields([]parse.Node{fm.tmpl.Root})...)
	}
	return uniqueString(names)
}

func trunc(c int, s string) string {
	runes := []rune(s)
	l := len(runes)
	if c < 0 && l+c > 0 {
		return string(runes[l+c:])
	}
	if c >= 0 && l > c {
		return string(runes[:c])
	}
	return s
}

func alignLeft(count int, src string) string {
	runes := []rune(src)
	l := len(runes)
	if count < 0 || count == l {
		return src
	}
	pad := count - l
	if pad > 0 {
		return src + strings.Repeat(" ", pad)
	}
	return string(runes[:count])
}

func alignRight(count int, src string) string {
	runes := []rune(src)
	l := len(runes)
	if count < 0 || count == l {
		return src
	}
	pad := count - l
	if pad > 0 {
		return strings.Repeat(" ", pad) + src
	}
	return string(runes[l-count:])
}

type Decolorizer struct{}

// RegExp to select ANSI characters courtesy of https://github.com/acarl005/stripansi
const ansiPattern = "[\u001B\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PRZcf-ntqry=><~]))"

var ansiRegex = regexp.MustCompile(ansiPattern)

func NewDecolorizer() (*Decolorizer, error) {
	return &Decolorizer{}, nil
}

func (Decolorizer) Process(_ int64, line []byte, _ *LabelsBuilder) ([]byte, bool) {
	return ansiRegex.ReplaceAll(line, []byte{}), true
}
func (Decolorizer) RequiredLabelNames() []string { return []string{} }

// substring creates a substring of the given string.
//
// If start is < 0, this calls string[:end].
//
// If start is >= 0 and end < 0 or end bigger than s length, this calls string[start:]
//
// Otherwise, this calls string[start, end].
func substring(start, end int, s string) string {
	runes := []rune(s)
	l := len(runes)
	if end > l {
		end = l
	}
	if start > l {
		start = l
	}
	if start < 0 {
		if end < 0 {
			return ""
		}
		return string(runes[:end])
	}
	if end < 0 {
		return string(runes[start:])
	}
	if start > end {
		return ""
	}
	return string(runes[start:end])
}
