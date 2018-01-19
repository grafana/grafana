package contract

import (
	"path/filepath"
	"strings"

	"go/build"

	"github.com/smartystreets/goconvey/convey/reporting"
	"github.com/smartystreets/goconvey/web/server/messaging"
)

type Package struct {
	Path          string
	Name          string
	Ignored       bool
	Disabled      bool
	BuildTags     []string
	TestArguments []string
	Error         error
	Output        string
	Result        *PackageResult

	HasImportCycle bool
}

func NewPackage(folder *messaging.Folder, hasImportCycle bool) *Package {
	self := new(Package)
	self.Path = folder.Path
	self.Name = resolvePackageName(self.Path)
	self.Result = NewPackageResult(self.Name)
	self.Ignored = folder.Ignored
	self.Disabled = folder.Disabled
	self.BuildTags = folder.BuildTags
	self.TestArguments = folder.TestArguments
	self.HasImportCycle = hasImportCycle
	return self
}

func (self *Package) Active() bool {
	return !self.Disabled && !self.Ignored
}

func (self *Package) HasUsableResult() bool {
	return self.Active() && (self.Error == nil || (self.Output != ""))
}

type CompleteOutput struct {
	Packages []*PackageResult
	Revision string
	Paused   bool
}

var ( // PackageResult.Outcome values:
	Ignored         = "ignored"
	Disabled        = "disabled"
	Passed          = "passed"
	Failed          = "failed"
	Panicked        = "panicked"
	BuildFailure    = "build failure"
	NoTestFiles     = "no test files"
	NoTestFunctions = "no test functions"
	NoGoFiles       = "no go code"

	TestRunAbortedUnexpectedly = "test run aborted unexpectedly"
)

type PackageResult struct {
	PackageName string
	Elapsed     float64
	Coverage    float64
	Outcome     string
	BuildOutput string
	TestResults []TestResult
}

func NewPackageResult(packageName string) *PackageResult {
	self := new(PackageResult)
	self.PackageName = packageName
	self.TestResults = []TestResult{}
	self.Coverage = -1
	return self
}

type TestResult struct {
	TestName string
	Elapsed  float64
	Passed   bool
	Skipped  bool
	File     string
	Line     int
	Message  string
	Error    string
	Stories  []reporting.ScopeResult

	RawLines []string `json:",omitempty"`
}

func NewTestResult(testName string) *TestResult {
	self := new(TestResult)
	self.Stories = []reporting.ScopeResult{}
	self.RawLines = []string{}
	self.TestName = testName
	return self
}

func resolvePackageName(path string) string {
	pkg, err := build.ImportDir(path, build.FindOnly)
	if err == nil {
		return pkg.ImportPath
	}

	nameArr := strings.Split(path, endGoPath)
	return nameArr[len(nameArr)-1]
}

const (
	separator = string(filepath.Separator)
	endGoPath = separator + "src" + separator
)
