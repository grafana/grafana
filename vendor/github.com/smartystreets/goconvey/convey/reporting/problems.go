package reporting

import "fmt"

type problem struct {
	silent   bool
	out      *Printer
	errors   []*AssertionResult
	failures []*AssertionResult
}

func (self *problem) BeginStory(story *StoryReport) {}

func (self *problem) Enter(scope *ScopeReport) {}

func (self *problem) Report(report *AssertionResult) {
	if report.Error != nil {
		self.errors = append(self.errors, report)
	} else if report.Failure != "" {
		self.failures = append(self.failures, report)
	}
}

func (self *problem) Exit() {}

func (self *problem) EndStory() {
	self.show(self.showErrors, redColor)
	self.show(self.showFailures, yellowColor)
	self.prepareForNextStory()
}
func (self *problem) show(display func(), color string) {
	if !self.silent {
		fmt.Print(color)
	}
	display()
	if !self.silent {
		fmt.Print(resetColor)
	}
	self.out.Dedent()
}
func (self *problem) showErrors() {
	for i, e := range self.errors {
		if i == 0 {
			self.out.Println("\nErrors:\n")
			self.out.Indent()
		}
		self.out.Println(errorTemplate, e.File, e.Line, e.Error, e.StackTrace)
	}
}
func (self *problem) showFailures() {
	for i, f := range self.failures {
		if i == 0 {
			self.out.Println("\nFailures:\n")
			self.out.Indent()
		}
		self.out.Println(failureTemplate, f.File, f.Line, f.Failure)
	}
}

func (self *problem) Write(content []byte) (written int, err error) {
	return len(content), nil // no-op
}

func NewProblemReporter(out *Printer) *problem {
	self := new(problem)
	self.out = out
	self.prepareForNextStory()
	return self
}

func NewSilentProblemReporter(out *Printer) *problem {
	self := NewProblemReporter(out)
	self.silent = true
	return self
}

func (self *problem) prepareForNextStory() {
	self.errors = []*AssertionResult{}
	self.failures = []*AssertionResult{}
}
