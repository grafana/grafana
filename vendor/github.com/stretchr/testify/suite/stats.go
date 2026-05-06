package suite

import "time"

// SuiteInformation stats stores stats for the whole suite execution.
type SuiteInformation struct {
	Start, End time.Time
	TestStats  map[string]*TestInformation
}

// TestInformation stores information about the execution of each test.
type TestInformation struct {
	TestName   string
	Start, End time.Time
	Passed     bool
}

func newSuiteInformation() *SuiteInformation {
	return &SuiteInformation{
		TestStats: make(map[string]*TestInformation),
	}
}

func (s *SuiteInformation) start(testName string) {
	if s == nil {
		return
	}
	s.TestStats[testName] = &TestInformation{
		TestName: testName,
		Start:    time.Now(),
	}
}

func (s *SuiteInformation) end(testName string, passed bool) {
	if s == nil {
		return
	}
	s.TestStats[testName].End = time.Now()
	s.TestStats[testName].Passed = passed
}

func (s *SuiteInformation) Passed() bool {
	for _, stats := range s.TestStats {
		if !stats.Passed {
			return false
		}
	}

	return true
}
