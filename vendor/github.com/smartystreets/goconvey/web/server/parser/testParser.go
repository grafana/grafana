package parser

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/smartystreets/goconvey/convey/reporting"
	"github.com/smartystreets/goconvey/web/server/contract"
)

type testParser struct {
	test       *contract.TestResult
	line       string
	index      int
	inJson     bool
	jsonLines  []string
	otherLines []string
}

func parseTestOutput(test *contract.TestResult) *contract.TestResult {
	parser := newTestParser(test)
	parser.parseTestFunctionOutput()
	return test
}

func newTestParser(test *contract.TestResult) *testParser {
	self := new(testParser)
	self.test = test
	return self
}

func (self *testParser) parseTestFunctionOutput() {
	if len(self.test.RawLines) > 0 {
		self.processLines()
		self.deserializeJson()
		self.composeCapturedOutput()
	}
}

func (self *testParser) processLines() {
	for self.index, self.line = range self.test.RawLines {
		if !self.processLine() {
			break
		}
	}
}

func (self *testParser) processLine() bool {
	if strings.HasSuffix(self.line, reporting.OpenJson) {
		self.inJson = true
		self.accountForOutputWithoutNewline()

	} else if self.line == reporting.CloseJson {
		self.inJson = false

	} else if self.inJson {
		self.jsonLines = append(self.jsonLines, self.line)

	} else if isPanic(self.line) {
		self.parsePanicOutput()
		return false

	} else if isGoTestLogOutput(self.line) {
		self.parseLogLocation()

	} else {
		self.otherLines = append(self.otherLines, self.line)
	}
	return true
}

// If fmt.Print(f) produces output with no \n and that output
// is that last output before the framework spits out json
// (which starts with ''>>>>>'') then without this code
// all of the json is counted as output, not as json to be
// parsed and displayed by the web UI.
func (self *testParser) accountForOutputWithoutNewline() {
	prefix := strings.Split(self.line, reporting.OpenJson)[0]
	if prefix != "" {
		self.otherLines = append(self.otherLines, prefix)
	}
}

func (self *testParser) deserializeJson() {
	formatted := createArrayForJsonItems(self.jsonLines)
	var scopes []reporting.ScopeResult
	err := json.Unmarshal(formatted, &scopes)
	if err != nil {
		panic(fmt.Sprintf(bugReportRequest, err, formatted))
	}
	self.test.Stories = scopes
}
func (self *testParser) parsePanicOutput() {
	for index, line := range self.test.RawLines[self.index:] {
		self.parsePanicLocation(index, line)
		self.preserveStackTraceIndentation(index, line)
	}
	self.test.Error = strings.Join(self.test.RawLines, "\n")
}
func (self *testParser) parsePanicLocation(index int, line string) {
	if !panicLineHasMetadata(line) {
		return
	}
	metaLine := self.test.RawLines[index+4]
	fields := strings.Split(metaLine, " ")
	fileAndLine := strings.Split(fields[0], ":")
	self.test.File = fileAndLine[0]
	if len(fileAndLine) >= 2 {
		self.test.Line, _ = strconv.Atoi(fileAndLine[1])
	}
}
func (self *testParser) preserveStackTraceIndentation(index int, line string) {
	if panicLineShouldBeIndented(index, line) {
		self.test.RawLines[index] = "\t" + line
	}
}
func (self *testParser) parseLogLocation() {
	self.otherLines = append(self.otherLines, self.line)
	lineFields := self.line
	fields := strings.Split(lineFields, ":")
	self.test.File = strings.TrimSpace(fields[0])
	self.test.Line, _ = strconv.Atoi(fields[1])
}

func (self *testParser) composeCapturedOutput() {
	self.test.Message = strings.Join(self.otherLines, "\n")
}

func createArrayForJsonItems(lines []string) []byte {
	jsonArrayItems := strings.Join(lines, "")
	jsonArrayItems = removeTrailingComma(jsonArrayItems)
	return []byte(fmt.Sprintf("[%s]\n", jsonArrayItems))
}
func removeTrailingComma(rawJson string) string {
	if trailingComma(rawJson) {
		return rawJson[:len(rawJson)-1]
	}
	return rawJson
}
func trailingComma(value string) bool {
	return strings.HasSuffix(value, ",")
}

func isGoTestLogOutput(line string) bool {
	return strings.Count(line, ":") == 2
}

func isPanic(line string) bool {
	return strings.HasPrefix(line, "panic: ")
}

func panicLineHasMetadata(line string) bool {
	return strings.HasPrefix(line, "goroutine") && strings.Contains(line, "[running]")
}
func panicLineShouldBeIndented(index int, line string) bool {
	return strings.Contains(line, "+") || (index > 0 && strings.Contains(line, "panic: "))
}

const bugReportRequest = `
Uh-oh! Looks like something went wrong. Please copy the following text and file a bug report at: 

https://github.com/smartystreets/goconvey/issues?state=open

======= BEGIN BUG REPORT =======

ERROR: %v

OUTPUT: %s

======= END BUG REPORT =======

`
