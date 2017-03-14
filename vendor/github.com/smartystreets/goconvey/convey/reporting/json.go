// TODO: under unit test

package reporting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

type JsonReporter struct {
	out        *Printer
	currentKey []string
	current    *ScopeResult
	index      map[string]*ScopeResult
	scopes     []*ScopeResult
}

func (self *JsonReporter) depth() int { return len(self.currentKey) }

func (self *JsonReporter) BeginStory(story *StoryReport) {}

func (self *JsonReporter) Enter(scope *ScopeReport) {
	self.currentKey = append(self.currentKey, scope.Title)
	ID := strings.Join(self.currentKey, "|")
	if _, found := self.index[ID]; !found {
		next := newScopeResult(scope.Title, self.depth(), scope.File, scope.Line)
		self.scopes = append(self.scopes, next)
		self.index[ID] = next
	}
	self.current = self.index[ID]
}

func (self *JsonReporter) Report(report *AssertionResult) {
	self.current.Assertions = append(self.current.Assertions, report)
}

func (self *JsonReporter) Exit() {
	self.currentKey = self.currentKey[:len(self.currentKey)-1]
}

func (self *JsonReporter) EndStory() {
	self.report()
	self.reset()
}
func (self *JsonReporter) report() {
	scopes := []string{}
	for _, scope := range self.scopes {
		serialized, err := json.Marshal(scope)
		if err != nil {
			self.out.Println(jsonMarshalFailure)
			panic(err)
		}
		var buffer bytes.Buffer
		json.Indent(&buffer, serialized, "", "  ")
		scopes = append(scopes, buffer.String())
	}
	self.out.Print(fmt.Sprintf("%s\n%s,\n%s\n", OpenJson, strings.Join(scopes, ","), CloseJson))
}
func (self *JsonReporter) reset() {
	self.scopes = []*ScopeResult{}
	self.index = map[string]*ScopeResult{}
	self.currentKey = nil
}

func (self *JsonReporter) Write(content []byte) (written int, err error) {
	self.current.Output += string(content)
	return len(content), nil
}

func NewJsonReporter(out *Printer) *JsonReporter {
	self := new(JsonReporter)
	self.out = out
	self.reset()
	return self
}

const OpenJson = ">->->OPEN-JSON->->->"   // "⌦"
const CloseJson = "<-<-<-CLOSE-JSON<-<-<" // "⌫"
const jsonMarshalFailure = `

GOCONVEY_JSON_MARSHALL_FAILURE: There was an error when attempting to convert test results to JSON.
Please file a bug report and reference the code that caused this failure if possible.

Here's the panic:

`
