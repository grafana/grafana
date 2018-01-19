package executor

import (
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/smartystreets/goconvey/web/server/contract"
)

type concurrentCoordinator struct {
	batchSize int
	queue     chan *contract.Package
	folders   []*contract.Package
	shell     contract.Shell
	waiter    sync.WaitGroup
}

func (self *concurrentCoordinator) ExecuteConcurrently() {
	self.enlistWorkers()
	self.scheduleTasks()
	self.awaitCompletion()
}

func (self *concurrentCoordinator) enlistWorkers() {
	for i := 0; i < self.batchSize; i++ {
		self.waiter.Add(1)
		go self.worker(i)
	}
}
func (self *concurrentCoordinator) worker(id int) {
	for folder := range self.queue {
		packageName := strings.Replace(folder.Name, "\\", "/", -1)
		if !folder.Active() {
			log.Printf("Skipping concurrent execution: %s\n", packageName)
			continue
		}

		if folder.HasImportCycle {
			message := fmt.Sprintf("can't load package: import cycle not allowed\npackage %s\n\timports %s", packageName, packageName)
			log.Println(message)
			folder.Output, folder.Error = message, errors.New(message)
		} else {
			log.Printf("Executing concurrent tests: %s\n", packageName)
			folder.Output, folder.Error = self.shell.GoTest(folder.Path, packageName, folder.BuildTags, folder.TestArguments)
		}
	}
	self.waiter.Done()
}

func (self *concurrentCoordinator) scheduleTasks() {
	for _, folder := range self.folders {
		self.queue <- folder
	}
}

func (self *concurrentCoordinator) awaitCompletion() {
	close(self.queue)
	self.waiter.Wait()
}

func newConcurrentCoordinator(folders []*contract.Package, batchSize int, shell contract.Shell) *concurrentCoordinator {
	self := new(concurrentCoordinator)
	self.queue = make(chan *contract.Package)
	self.folders = folders
	self.batchSize = batchSize
	self.shell = shell
	return self
}
