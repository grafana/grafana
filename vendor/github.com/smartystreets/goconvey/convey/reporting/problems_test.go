package reporting

import (
	"strings"
	"testing"
)

func TestNoopProblemReporterActions(t *testing.T) {
	file, reporter := setup()
	reporter.BeginStory(nil)
	reporter.Enter(nil)
	reporter.Exit()
	expected := ""
	actual := file.String()
	if expected != actual {
		t.Errorf("Expected: '(blank)'\nActual:  '%s'", actual)
	}
}

func TestReporterPrintsFailuresAndErrorsAtTheEndOfTheStory(t *testing.T) {
	file, reporter := setup()
	reporter.Report(NewFailureReport("failed"))
	reporter.Report(NewErrorReport("error"))
	reporter.Report(NewSuccessReport())
	reporter.EndStory()

	result := file.String()
	if !strings.Contains(result, "Errors:\n") {
		t.Errorf("Expected errors, found none.")
	}
	if !strings.Contains(result, "Failures:\n") {
		t.Errorf("Expected failures, found none.")
	}

	// Each stack trace looks like: `* /path/to/file.go`, so look for `* `.
	// With go 1.4+ there is a line in some stack traces that looks like this:
	//   `testing.(*M).Run(0x2082d60a0, 0x25b7c0)`
	// So we can't just look for "*" anymore.
	problemCount := strings.Count(result, "* ")
	if problemCount != 2 {
		t.Errorf("Expected one failure and one error (total of 2 '*' characters). Got %d", problemCount)
	}
}

func setup() (file *memoryFile, reporter *problem) {
	monochrome()
	file = newMemoryFile()
	printer := NewPrinter(file)
	reporter = NewProblemReporter(printer)
	return
}
