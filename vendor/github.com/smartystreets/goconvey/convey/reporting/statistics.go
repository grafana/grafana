package reporting

import (
	"fmt"
	"sync"
)

func (self *statistics) BeginStory(story *StoryReport) {}

func (self *statistics) Enter(scope *ScopeReport) {}

func (self *statistics) Report(report *AssertionResult) {
	self.Lock()
	defer self.Unlock()

	if !self.failing && report.Failure != "" {
		self.failing = true
	}
	if !self.erroring && report.Error != nil {
		self.erroring = true
	}
	if report.Skipped {
		self.skipped += 1
	} else {
		self.total++
	}
}

func (self *statistics) Exit() {}

func (self *statistics) EndStory() {
	self.Lock()
	defer self.Unlock()

	if !self.suppressed {
		self.printSummaryLocked()
	}
}

func (self *statistics) Suppress() {
	self.Lock()
	defer self.Unlock()
	self.suppressed = true
}

func (self *statistics) PrintSummary() {
	self.Lock()
	defer self.Unlock()
	self.printSummaryLocked()
}

func (self *statistics) printSummaryLocked() {
	self.reportAssertionsLocked()
	self.reportSkippedSectionsLocked()
	self.completeReportLocked()
}
func (self *statistics) reportAssertionsLocked() {
	self.decideColorLocked()
	self.out.Print("\n%d total %s", self.total, plural("assertion", self.total))
}
func (self *statistics) decideColorLocked() {
	if self.failing && !self.erroring {
		fmt.Print(yellowColor)
	} else if self.erroring {
		fmt.Print(redColor)
	} else {
		fmt.Print(greenColor)
	}
}
func (self *statistics) reportSkippedSectionsLocked() {
	if self.skipped > 0 {
		fmt.Print(yellowColor)
		self.out.Print(" (one or more sections skipped)")
	}
}
func (self *statistics) completeReportLocked() {
	fmt.Print(resetColor)
	self.out.Print("\n")
	self.out.Print("\n")
}

func (self *statistics) Write(content []byte) (written int, err error) {
	return len(content), nil // no-op
}

func NewStatisticsReporter(out *Printer) *statistics {
	self := statistics{}
	self.out = out
	return &self
}

type statistics struct {
	sync.Mutex

	out        *Printer
	total      int
	failing    bool
	erroring   bool
	skipped    int
	suppressed bool
}

func plural(word string, count int) string {
	if count == 1 {
		return word
	}
	return word + "s"
}
