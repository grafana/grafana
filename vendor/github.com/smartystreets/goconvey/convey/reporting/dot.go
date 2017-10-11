package reporting

import "fmt"

type dot struct{ out *Printer }

func (self *dot) BeginStory(story *StoryReport) {}

func (self *dot) Enter(scope *ScopeReport) {}

func (self *dot) Report(report *AssertionResult) {
	if report.Error != nil {
		fmt.Print(redColor)
		self.out.Insert(dotError)
	} else if report.Failure != "" {
		fmt.Print(yellowColor)
		self.out.Insert(dotFailure)
	} else if report.Skipped {
		fmt.Print(yellowColor)
		self.out.Insert(dotSkip)
	} else {
		fmt.Print(greenColor)
		self.out.Insert(dotSuccess)
	}
	fmt.Print(resetColor)
}

func (self *dot) Exit() {}

func (self *dot) EndStory() {}

func (self *dot) Write(content []byte) (written int, err error) {
	return len(content), nil // no-op
}

func NewDotReporter(out *Printer) *dot {
	self := new(dot)
	self.out = out
	return self
}
