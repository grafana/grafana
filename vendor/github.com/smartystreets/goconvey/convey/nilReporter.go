package convey

import (
	"github.com/smartystreets/goconvey/convey/reporting"
)

type nilReporter struct{}

func (self *nilReporter) BeginStory(story *reporting.StoryReport)  {}
func (self *nilReporter) Enter(scope *reporting.ScopeReport)       {}
func (self *nilReporter) Report(report *reporting.AssertionResult) {}
func (self *nilReporter) Exit()                                    {}
func (self *nilReporter) EndStory()                                {}
func (self *nilReporter) Write(p []byte) (int, error)              { return len(p), nil }
func newNilReporter() *nilReporter                                 { return &nilReporter{} }
