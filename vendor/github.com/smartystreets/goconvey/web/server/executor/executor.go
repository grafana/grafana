package executor

import (
	"log"
	"time"

	"github.com/smartystreets/goconvey/web/server/contract"
)

const (
	Idle      = "idle"
	Executing = "executing"
)

type Executor struct {
	tester     Tester
	parser     Parser
	status     string
	statusChan chan chan string
	statusFlag bool
}

func (self *Executor) Status() string {
	return self.status
}

func (self *Executor) ClearStatusFlag() bool {
	hasNewStatus := self.statusFlag
	self.statusFlag = false
	return hasNewStatus
}

func (self *Executor) ExecuteTests(folders []*contract.Package) *contract.CompleteOutput {
	defer func() { self.setStatus(Idle) }()
	self.execute(folders)
	result := self.parse(folders)
	return result
}

func (self *Executor) execute(folders []*contract.Package) {
	self.setStatus(Executing)
	self.tester.TestAll(folders)
}

func (self *Executor) parse(folders []*contract.Package) *contract.CompleteOutput {
	result := &contract.CompleteOutput{Revision: now().String()}
	self.parser.Parse(folders)
	for _, folder := range folders {
		result.Packages = append(result.Packages, folder.Result)
	}
	return result
}

func (self *Executor) setStatus(status string) {
	self.status = status
	self.statusFlag = true

Loop:
	for {
		select {
		case c := <-self.statusChan:
			self.statusFlag = false
			c <- status
		default:
			break Loop
		}
	}

	log.Printf("Executor status: '%s'\n", self.status)
}

func NewExecutor(tester Tester, parser Parser, ch chan chan string) *Executor {
	return &Executor{
		tester:     tester,
		parser:     parser,
		status:     Idle,
		statusChan: ch,
		statusFlag: false,
	}
}

var now = func() time.Time {
	return time.Now()
}
