package watch

import (
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/smartystreets/goconvey/web/server/messaging"
)

type Watcher struct {
	nap             time.Duration
	rootFolder      string
	folderDepth     int
	ignoredFolders  map[string]struct{}
	fileSystemState int64
	paused          bool
	stopped         bool
	watchSuffixes   []string
	excludedDirs    []string

	input  chan messaging.WatcherCommand
	output chan messaging.Folders

	lock sync.RWMutex
}

func NewWatcher(rootFolder string, folderDepth int, nap time.Duration,
	input chan messaging.WatcherCommand, output chan messaging.Folders, watchSuffixes string, excludedDirs []string) *Watcher {

	return &Watcher{
		nap:           nap,
		rootFolder:    rootFolder,
		folderDepth:   folderDepth,
		input:         input,
		output:        output,
		watchSuffixes: strings.Split(watchSuffixes, ","),
		excludedDirs:  excludedDirs,

		ignoredFolders: make(map[string]struct{}),
	}
}

func (this *Watcher) Listen() {
	for {
		if this.stopped {
			return
		}

		select {

		case command := <-this.input:
			this.respond(command)

		default:
			if !this.paused {
				this.scan()
			}
			time.Sleep(nap)
		}
	}
}

func (this *Watcher) respond(command messaging.WatcherCommand) {
	switch command.Instruction {

	case messaging.WatcherAdjustRoot:
		log.Println("Adjusting root...")
		this.rootFolder = command.Details
		this.execute()

	case messaging.WatcherIgnore:
		log.Println("Ignoring specified folders")
		this.ignore(command.Details)
		// Prevent a filesystem change due to the number of active folders changing
		_, checksum := this.gather()
		this.set(checksum)

	case messaging.WatcherReinstate:
		log.Println("Reinstating specified folders")
		this.reinstate(command.Details)
		// Prevent a filesystem change due to the number of active folders changing
		_, checksum := this.gather()
		this.set(checksum)

	case messaging.WatcherPause:
		log.Println("Pausing watcher...")
		this.paused = true

	case messaging.WatcherResume:
		log.Println("Resuming watcher...")
		this.paused = false

	case messaging.WatcherExecute:
		log.Println("Gathering folders for immediate execution...")
		this.execute()

	case messaging.WatcherStop:
		log.Println("Stopping the watcher...")
		close(this.output)
		this.stopped = true

	default:
		log.Println("Unrecognized command from server:", command.Instruction)
	}
}

func (this *Watcher) execute() {
	folders, _ := this.gather()
	this.sendToExecutor(folders)
}

func (this *Watcher) scan() {
	folders, checksum := this.gather()

	if checksum == this.fileSystemState {
		return
	}

	log.Println("File system state modified, publishing current folders...", this.fileSystemState, checksum)

	defer this.set(checksum)
	this.sendToExecutor(folders)
}

func (this *Watcher) gather() (folders messaging.Folders, checksum int64) {
	items := YieldFileSystemItems(this.rootFolder, this.excludedDirs)
	folderItems, profileItems, goFileItems := Categorize(items, this.rootFolder, this.watchSuffixes)

	for _, item := range profileItems {
		// TODO: don't even bother if the item's size is over a few hundred bytes...
		contents := ReadContents(item.Path)
		item.ProfileDisabled, item.ProfileTags, item.ProfileArguments = ParseProfile(contents)
	}

	folders = CreateFolders(folderItems)
	LimitDepth(folders, this.folderDepth)
	AttachProfiles(folders, profileItems)
	this.protectedRead(func() { MarkIgnored(folders, this.ignoredFolders) })

	active := ActiveFolders(folders)
	checksum = int64(len(active))
	checksum += Sum(active, profileItems)
	checksum += Sum(active, goFileItems)

	return folders, checksum
}

func (this *Watcher) set(state int64) {
	this.fileSystemState = state
}

func (this *Watcher) sendToExecutor(folders messaging.Folders) {
	this.output <- folders
}

func (this *Watcher) ignore(paths string) {
	this.protectedWrite(func() {
		for _, folder := range strings.Split(paths, string(os.PathListSeparator)) {
			this.ignoredFolders[folder] = struct{}{}
			log.Println("Currently ignored folders:", this.ignoredFolders)
		}
	})
}
func (this *Watcher) reinstate(paths string) {
	this.protectedWrite(func() {
		for _, folder := range strings.Split(paths, string(os.PathListSeparator)) {
			delete(this.ignoredFolders, folder)
		}
	})
}
func (this *Watcher) protectedWrite(protected func()) {
	this.lock.Lock()
	defer this.lock.Unlock()
	protected()
}
func (this *Watcher) protectedRead(protected func()) {
	this.lock.RLock()
	defer this.lock.RUnlock()
	protected()
}

const nap = time.Millisecond * 250
