package log

import (
	"bytes"
	"errors"
	"fmt"
	"unicode/utf8"

	"github.com/grafana/jsonparser"

	"github.com/grafana/loki/v3/pkg/logql/log/jsonexpr"
	"github.com/grafana/loki/v3/pkg/logql/log/logfmt"
	"github.com/grafana/loki/v3/pkg/logql/log/pattern"
	"github.com/grafana/loki/v3/pkg/logqlmodel"

	"github.com/grafana/regexp"
	jsoniter "github.com/json-iterator/go"
	"github.com/prometheus/common/model"
)

const (
	jsonSpacer      = '_'
	duplicateSuffix = "_extracted"
	trueString      = "true"
	falseString     = "false"
	// How much stack space to allocate for unescaping JSON strings; if a string longer
	// than this needs to be escaped, it will result in a heap allocation
	unescapeStackBufSize = 64
)

var (
	_ Stage = &JSONParser{}
	_ Stage = &RegexpParser{}
	_ Stage = &LogfmtParser{}

	trueBytes = []byte("true")

	errUnexpectedJSONObject = fmt.Errorf("expecting json object(%d), but it is not", jsoniter.ObjectValue)
	errMissingCapture       = errors.New("at least one named capture must be supplied")
	errFoundAllLabels       = errors.New("found all required labels")
	errLabelDoesNotMatch    = errors.New("found a label with a matcher that didn't match")
)

type JSONParser struct {
	prefixBuffer []byte // buffer used to build json keys
	lbs          *LabelsBuilder

	keys        internedStringSet
	parserHints ParserHint
}

// NewJSONParser creates a log stage that can parse a json log line and add properties as labels.
func NewJSONParser() *JSONParser {
	return &JSONParser{
		prefixBuffer: make([]byte, 0, 1024),
		keys:         internedStringSet{},
	}
}

func (j *JSONParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	parserHints := lbs.ParserLabelHints()
	if parserHints.NoLabels() {
		return line, true
	}

	// reset the state.
	j.prefixBuffer = j.prefixBuffer[:0]
	j.lbs = lbs
	j.parserHints = parserHints

	if err := jsonparser.ObjectEach(line, j.parseObject); err != nil {
		if errors.Is(err, errFoundAllLabels) {
			// Short-circuited
			return line, true
		}

		if errors.Is(err, errLabelDoesNotMatch) {
			// one of the label matchers does not match. The whole line can be thrown away
			return line, false
		}

		addErrLabel(errJSON, err, lbs)

		return line, true
	}
	return line, true
}

func (j *JSONParser) parseObject(key, value []byte, dataType jsonparser.ValueType, _ int) error {
	var err error
	switch dataType {
	case jsonparser.String, jsonparser.Number, jsonparser.Boolean:
		err = j.parseLabelValue(key, value, dataType)
	case jsonparser.Object:
		prefixLen := len(j.prefixBuffer)
		if ok := j.nextKeyPrefix(key); ok {
			err = jsonparser.ObjectEach(value, j.parseObject)
		}
		// rollback the prefix as we exit the current object.
		j.prefixBuffer = j.prefixBuffer[:prefixLen]
		return err
	}

	if j.parserHints.AllRequiredExtracted() {
		// Not actually an error. Parsing can be short-circuited
		// and this tells jsonparser to stop parsing
		return errFoundAllLabels
	}

	return err
}

// nextKeyPrefix load the next prefix in the buffer and tells if it should be processed based on hints.
func (j *JSONParser) nextKeyPrefix(key []byte) bool {
	// first add the spacer if needed.
	if len(j.prefixBuffer) != 0 {
		j.prefixBuffer = append(j.prefixBuffer, byte(jsonSpacer))
	}
	j.prefixBuffer = appendSanitized(j.prefixBuffer, key)
	return j.lbs.ParserLabelHints().ShouldExtractPrefix(unsafeGetString(j.prefixBuffer))
}

func (j *JSONParser) parseLabelValue(key, value []byte, dataType jsonparser.ValueType) error {
	// the first time we use the field as label key.
	if len(j.prefixBuffer) == 0 {
		key, ok := j.keys.Get(key, func() (string, bool) {
			field := sanitizeLabelKey(string(key), true)
			if j.lbs.BaseHas(field) {
				field = field + duplicateSuffix
			}
			if !j.lbs.ParserLabelHints().ShouldExtract(field) {
				return "", false
			}
			return field, true
		})
		if !ok {
			return nil
		}
		j.lbs.Set(ParsedLabel, key, readValue(value, dataType))
		if !j.parserHints.ShouldContinueParsingLine(key, j.lbs) {
			return errLabelDoesNotMatch
		}
		return nil

	}
	// otherwise we build the label key using the buffer

	// snapshot the current prefix position
	prefixLen := len(j.prefixBuffer)
	j.prefixBuffer = append(j.prefixBuffer, byte(jsonSpacer))
	j.prefixBuffer = appendSanitized(j.prefixBuffer, key)
	keyString, ok := j.keys.Get(j.prefixBuffer, func() (string, bool) {
		if j.lbs.BaseHas(string(j.prefixBuffer)) {
			j.prefixBuffer = append(j.prefixBuffer, duplicateSuffix...)
		}
		if !j.parserHints.ShouldExtract(string(j.prefixBuffer)) {
			return "", false
		}

		return string(j.prefixBuffer), true
	})

	// reset the prefix position
	j.prefixBuffer = j.prefixBuffer[:prefixLen]
	if !ok {
		return nil
	}

	j.lbs.Set(ParsedLabel, keyString, readValue(value, dataType))
	if !j.parserHints.ShouldContinueParsingLine(keyString, j.lbs) {
		return errLabelDoesNotMatch
	}
	return nil
}

func (j *JSONParser) RequiredLabelNames() []string { return []string{} }

func readValue(v []byte, dataType jsonparser.ValueType) string {
	switch dataType {
	case jsonparser.String:
		return unescapeJSONString(v)
	case jsonparser.Null:
		return ""
	case jsonparser.Number:
		return string(v)
	case jsonparser.Boolean:
		if bytes.Equal(v, trueBytes) {
			return trueString
		}
		return falseString
	default:
		return ""
	}
}

func unescapeJSONString(b []byte) string {
	var stackbuf [unescapeStackBufSize]byte // stack-allocated array for allocation-free unescaping of small strings
	bU, err := jsonparser.Unescape(b, stackbuf[:])
	if err != nil {
		return ""
	}
	res := string(bU)
	// rune error is rejected by Prometheus
	for _, r := range res {
		if r == utf8.RuneError {
			return ""
		}
	}
	return res
}

type RegexpParser struct {
	regex     *regexp.Regexp
	nameIndex map[int]string

	keys internedStringSet
}

// NewRegexpParser creates a new log stage that can extract labels from a log line using a regex expression.
// The regex expression must contains at least one named match. If the regex doesn't match the line is not filtered out.
func NewRegexpParser(re string) (*RegexpParser, error) {
	regex, err := regexp.Compile(re)
	if err != nil {
		return nil, err
	}
	if regex.NumSubexp() == 0 {
		return nil, errMissingCapture
	}
	nameIndex := map[int]string{}
	uniqueNames := map[string]struct{}{}
	for i, n := range regex.SubexpNames() {
		if n != "" {
			if !model.LabelName(n).IsValid() {
				return nil, fmt.Errorf("invalid extracted label name '%s'", n)
			}
			if _, ok := uniqueNames[n]; ok {
				return nil, fmt.Errorf("duplicate extracted label name '%s'", n)
			}
			nameIndex[i] = n
			uniqueNames[n] = struct{}{}
		}
	}
	if len(nameIndex) == 0 {
		return nil, errMissingCapture
	}
	return &RegexpParser{
		regex:     regex,
		nameIndex: nameIndex,
		keys:      internedStringSet{},
	}, nil
}

func (r *RegexpParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	parserHints := lbs.ParserLabelHints()
	for i, value := range r.regex.FindSubmatch(line) {
		if name, ok := r.nameIndex[i]; ok {
			key, ok := r.keys.Get(unsafeGetBytes(name), func() (string, bool) {
				sanitize := sanitizeLabelKey(name, true)
				if len(sanitize) == 0 {
					return "", false
				}
				if lbs.BaseHas(sanitize) {
					sanitize = fmt.Sprintf("%s%s", sanitize, duplicateSuffix)
				}
				if !parserHints.ShouldExtract(sanitize) {
					return "", false
				}

				return sanitize, true
			})
			if !ok {
				continue
			}

			lbs.Set(ParsedLabel, key, string(value))
			if !parserHints.ShouldContinueParsingLine(key, lbs) {
				return line, false
			}
		}
	}
	return line, true
}

func (r *RegexpParser) RequiredLabelNames() []string { return []string{} }

type LogfmtParser struct {
	strict    bool
	keepEmpty bool
	dec       *logfmt.Decoder
	keys      internedStringSet
}

// NewLogfmtParser creates a parser that can extract labels from a logfmt log line.
// Each keyval is extracted into a respective label.
func NewLogfmtParser(strict, keepEmpty bool) *LogfmtParser {
	return &LogfmtParser{
		strict:    strict,
		keepEmpty: keepEmpty,
		dec:       logfmt.NewDecoder(nil),
		keys:      internedStringSet{},
	}
}

func (l *LogfmtParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	parserHints := lbs.ParserLabelHints()
	if parserHints.NoLabels() {
		return line, true
	}

	l.dec.Reset(line)
	for !l.dec.EOL() {
		ok := l.dec.ScanKeyval()
		if !ok {
			// for strict parsing, do not continue on errs
			if l.strict {
				break
			}

			continue
		}

		key, ok := l.keys.Get(l.dec.Key(), func() (string, bool) {
			sanitized := sanitizeLabelKey(string(l.dec.Key()), true)
			if len(sanitized) == 0 {
				return "", false
			}

			if lbs.BaseHas(sanitized) {
				sanitized = fmt.Sprintf("%s%s", sanitized, duplicateSuffix)
			}

			if !parserHints.ShouldExtract(sanitized) {
				return "", false
			}
			return sanitized, true
		})
		if !ok {
			continue
		}

		val := l.dec.Value()
		// the rune error replacement is rejected by Prometheus, so we skip it.
		if bytes.ContainsRune(val, utf8.RuneError) {
			val = nil
		}

		if !l.keepEmpty && len(val) == 0 {
			continue
		}

		lbs.Set(ParsedLabel, key, string(val))
		if !parserHints.ShouldContinueParsingLine(key, lbs) {
			return line, false
		}

		if parserHints.AllRequiredExtracted() {
			break
		}
	}

	if l.strict && l.dec.Err() != nil {
		addErrLabel(errLogfmt, l.dec.Err(), lbs)

		if !parserHints.ShouldContinueParsingLine(logqlmodel.ErrorLabel, lbs) {
			return line, false
		}
		return line, true
	}

	return line, true
}

func (l *LogfmtParser) RequiredLabelNames() []string { return []string{} }

type PatternParser struct {
	matcher *pattern.Matcher
	names   []string
}

func NewPatternParser(pn string) (*PatternParser, error) {
	m, err := pattern.New(pn)
	if err != nil {
		return nil, err
	}
	for _, name := range m.Names() {
		if !model.LabelName(name).IsValid() {
			return nil, fmt.Errorf("invalid capture label name '%s'", name)
		}
	}
	return &PatternParser{
		matcher: m,
		names:   m.Names(),
	}, nil
}

func (l *PatternParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	parserHints := lbs.ParserLabelHints()
	if parserHints.NoLabels() {
		return line, true
	}
	matches := l.matcher.Matches(line)
	names := l.names[:len(matches)]
	for i, m := range matches {
		name := names[i]
		if lbs.BaseHas(name) {
			name = name + duplicateSuffix
		}

		if !parserHints.ShouldExtract(name) {
			continue
		}

		lbs.Set(ParsedLabel, name, string(m))
		if !parserHints.ShouldContinueParsingLine(name, lbs) {
			return line, false
		}
	}
	return line, true
}

func (l *PatternParser) RequiredLabelNames() []string { return []string{} }

type LogfmtExpressionParser struct {
	expressions map[string][]interface{}
	dec         *logfmt.Decoder
	keys        internedStringSet
	strict      bool
}

func NewLogfmtExpressionParser(expressions []LabelExtractionExpr, strict bool) (*LogfmtExpressionParser, error) {
	if len(expressions) == 0 {
		return nil, fmt.Errorf("no logfmt expression provided")
	}
	paths := make(map[string][]interface{}, len(expressions))

	for _, exp := range expressions {
		path, err := logfmt.Parse(exp.Expression, false)
		if err != nil {
			return nil, fmt.Errorf("cannot parse expression [%s]: %w", exp.Expression, err)
		}

		if !model.LabelName(exp.Identifier).IsValid() {
			return nil, fmt.Errorf("invalid extracted label name '%s'", exp.Identifier)
		}
		paths[exp.Identifier] = path
	}
	return &LogfmtExpressionParser{
		expressions: paths,
		dec:         logfmt.NewDecoder(nil),
		keys:        internedStringSet{},
		strict:      strict,
	}, nil
}

func (l *LogfmtExpressionParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	// If there are no expressions, extract common labels
	// and add the suffix "_extracted"
	if len(l.expressions) == 0 {
		return line, false
	}

	if lbs.ParserLabelHints().NoLabels() {
		return line, true
	}

	// Create a map of every renamed label and its original name
	// in order to retrieve it later in the extraction phase
	keys := make(map[string]string, len(l.expressions))
	for id, paths := range l.expressions {
		keys[id] = fmt.Sprintf("%v", paths...)
		if !lbs.BaseHas(id) {
			lbs.Set(ParsedLabel, id, "")
		}
	}

	l.dec.Reset(line)
	var current []byte
	for !l.dec.EOL() {
		ok := l.dec.ScanKeyval()
		if !ok {
			// for strict parsing, do not continue on errs
			if l.strict {
				break
			}

			continue
		}

		current = l.dec.Key()
		key, ok := l.keys.Get(current, func() (string, bool) {
			sanitized := sanitizeLabelKey(string(current), true)
			if len(sanitized) == 0 {
				return "", false
			}

			_, alwaysExtract := keys[sanitized]
			if !alwaysExtract && !lbs.ParserLabelHints().ShouldExtract(sanitized) {
				return "", false
			}
			return sanitized, true
		})

		if !ok {
			continue
		}

		val := l.dec.Value()
		if bytes.ContainsRune(val, utf8.RuneError) {
			val = nil
		}

		for id, orig := range keys {
			if key == orig {
				key = id
				break
			}
		}

		if _, ok := l.expressions[key]; ok {
			if lbs.BaseHas(key) {
				key = key + duplicateSuffix
				if !lbs.ParserLabelHints().ShouldExtract(key) {
					// Don't extract duplicates if we don't have to
					break
				}
			}

			lbs.Set(ParsedLabel, key, string(val))

			if lbs.ParserLabelHints().AllRequiredExtracted() {
				break
			}
		}
	}

	if l.strict && l.dec.Err() != nil {
		addErrLabel(errLogfmt, l.dec.Err(), lbs)
		return line, true
	}

	return line, true
}

func (l *LogfmtExpressionParser) RequiredLabelNames() []string { return []string{} }

type JSONExpressionParser struct {
	ids   []string
	paths [][]string
	keys  internedStringSet
}

func NewJSONExpressionParser(expressions []LabelExtractionExpr) (*JSONExpressionParser, error) {
	var ids []string
	var paths [][]string
	for _, exp := range expressions {
		path, err := jsonexpr.Parse(exp.Expression, false)
		if err != nil {
			return nil, fmt.Errorf("cannot parse expression [%s]: %w", exp.Expression, err)
		}

		if !model.LabelName(exp.Identifier).IsValid() {
			return nil, fmt.Errorf("invalid extracted label name '%s'", exp.Identifier)
		}

		ids = append(ids, exp.Identifier)
		paths = append(paths, pathsToString(path))
	}

	return &JSONExpressionParser{
		ids:   ids,
		paths: paths,
		keys:  internedStringSet{},
	}, nil
}

func pathsToString(paths []interface{}) []string {
	stingPaths := make([]string, 0, len(paths))
	for _, p := range paths {
		switch v := p.(type) {
		case int:
			stingPaths = append(stingPaths, fmt.Sprintf("[%d]", v))
		case string:
			stingPaths = append(stingPaths, v)
		}
	}
	return stingPaths
}

func (j *JSONExpressionParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	if len(line) == 0 || lbs.ParserLabelHints().NoLabels() {
		return line, true
	}

	// Check that the line starts correctly
	// the parser will pass an error if other
	// parts of the line are malformed
	if !isValidJSONStart(line) {
		addErrLabel(errJSON, nil, lbs)
		return line, true
	}

	var matches int
	jsonparser.EachKey(line, func(idx int, data []byte, typ jsonparser.ValueType, err error) {
		if err != nil {
			addErrLabel(errJSON, err, lbs)
			return
		}

		identifier := j.ids[idx]
		key, _ := j.keys.Get(unsafeGetBytes(identifier), func() (string, bool) {
			if lbs.BaseHas(identifier) {
				identifier = identifier + duplicateSuffix
			}
			return identifier, true
		})

		switch typ {
		case jsonparser.Null:
			lbs.Set(ParsedLabel, key, "")
		case jsonparser.Object:
			lbs.Set(ParsedLabel, key, string(data))
		default:
			lbs.Set(ParsedLabel, key, unescapeJSONString(data))
		}

		matches++
	}, j.paths...)

	// Ensure there's a label for every value
	if matches < len(j.ids) {
		for _, id := range j.ids {
			if _, ok := lbs.Get(id); !ok {
				lbs.Set(ParsedLabel, id, "")
			}
		}
	}

	return line, true
}

func isValidJSONStart(data []byte) bool {
	switch data[0] {
	case '"', '{', '[':
		return true
	default:
		return false
	}
}

func (j *JSONExpressionParser) RequiredLabelNames() []string { return []string{} }

type UnpackParser struct {
	lbsBuffer []string

	keys internedStringSet
}

// NewUnpackParser creates a new unpack stage.
// The unpack stage will parse a json log line as map[string]string where each key will be translated into labels.
// A special key _entry will also be used to replace the original log line. This is to be used in conjunction with Promtail pack stage.
// see https://grafana.com/docs/loki/latest/clients/promtail/stages/pack/
func NewUnpackParser() *UnpackParser {
	return &UnpackParser{
		lbsBuffer: make([]string, 0, 16),
		keys:      internedStringSet{},
	}
}

func (UnpackParser) RequiredLabelNames() []string { return []string{} }

func (u *UnpackParser) Process(_ int64, line []byte, lbs *LabelsBuilder) ([]byte, bool) {
	if len(line) == 0 || lbs.ParserLabelHints().NoLabels() {
		return line, true
	}

	// we only care about object and values.
	if line[0] != '{' {
		addErrLabel(errJSON, errUnexpectedJSONObject, lbs)
		return line, true
	}

	u.lbsBuffer = u.lbsBuffer[:0]
	entry, err := u.unpack(line, lbs)
	if err != nil {
		if errors.Is(err, errLabelDoesNotMatch) {
			return entry, false
		}
		addErrLabel(errJSON, err, lbs)
		return line, true
	}

	return entry, true
}

func addErrLabel(msg string, err error, lbs *LabelsBuilder) {
	lbs.SetErr(msg)

	if err != nil {
		lbs.SetErrorDetails(err.Error())
	}

	if lbs.ParserLabelHints().PreserveError() {
		lbs.Set(ParsedLabel, logqlmodel.PreserveErrorLabel, "true")
	}
}

func (u *UnpackParser) unpack(entry []byte, lbs *LabelsBuilder) ([]byte, error) {
	var isPacked bool
	err := jsonparser.ObjectEach(entry, func(key, value []byte, typ jsonparser.ValueType, _ int) error {
		switch typ {
		case jsonparser.String:
			if unsafeGetString(key) == logqlmodel.PackedEntryKey {
				// Inlined bytes escape to save allocs
				var stackbuf [unescapeStackBufSize]byte // stack-allocated array for allocation-free unescaping of small strings
				bU, err := jsonparser.Unescape(value, stackbuf[:])
				if err != nil {
					return err
				}

				entry = bU
				isPacked = true
				return nil
			}
			key, ok := u.keys.Get(key, func() (string, bool) {
				field := string(key)
				if lbs.BaseHas(field) {
					field = field + duplicateSuffix
				}
				if !lbs.ParserLabelHints().ShouldExtract(field) {
					return "", false
				}
				return field, true
			})
			if !ok {
				return nil
			}

			// append to the buffer of labels
			u.lbsBuffer = append(u.lbsBuffer, sanitizeLabelKey(key, true), unescapeJSONString(value))
		default:
			return nil
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// flush the buffer if we found a packed entry.
	if isPacked {
		for i := 0; i < len(u.lbsBuffer); i = i + 2 {
			lbs.Set(ParsedLabel, u.lbsBuffer[i], u.lbsBuffer[i+1])
			if !lbs.ParserLabelHints().ShouldContinueParsingLine(u.lbsBuffer[i], lbs) {
				return entry, errLabelDoesNotMatch
			}
		}
	}
	return entry, nil
}
