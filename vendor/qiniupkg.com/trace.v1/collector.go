package trace

import (
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/qiniu/errors"
	glog "github.com/qiniu/log.v1"
	rlog "qiniupkg.com/x/rollog.v1"
)

type Collector interface {
	Collect(*Span) error
	Close() error
}

//--------------------------------------------------------------

type FileCollector struct {
	rl *rlog.Rolloger

	queue chan *Span
	quit  chan bool

	closed bool
	lock   sync.Mutex
}

type FileCollectorConfig struct {
	LogDir    string `json:"logdir"`
	ChunkBits uint   `json:"chunkbits"`
}

const RollChunks = 4

func NewFileCollector(cfg *FileCollectorConfig) (*FileCollector, error) {

	if cfg.ChunkBits == 0 {
		cfg.ChunkBits = 27 // 128MB
	}
	err := os.MkdirAll(cfg.LogDir, 0777)
	if err != nil {
		glog.Error("mkdir failed:", cfg.LogDir, err)
		return nil, err
	}
	rl, err := rlog.Open(cfg.LogDir, cfg.ChunkBits, RollChunks)
	if err != nil {
		glog.Error("largefile.log.Open failed -", errors.Detail(err))
		return nil, err
	}
	fc := &FileCollector{
		rl:    rl,
		queue: make(chan *Span, 2048),
		quit:  make(chan bool),
	}
	go fc.persistLoop()
	return fc, nil
}

func (fc *FileCollector) Collect(span *Span) error {

	if fc.closed {
		return nil
	}
	select {
	case fc.queue <- span:
	default:
	}
	return nil
}

func (fc *FileCollector) Close() error {

	fc.lock.Lock()
	defer fc.lock.Unlock()

	if fc.closed {
		return nil
	}
	fc.quit <- true
	fc.closed = true

	// clear the channel
loop:
	for {
		select {
		case s := <-fc.queue:
			fc.persistOne(s)
		default:
			break loop
		}
	}
	return fc.rl.Close()
}

func (fc *FileCollector) persistLoop() {

	for {
		select {
		case s := <-fc.queue:
			fc.persistOne(s)
		case <-fc.quit:
			return
		}
	}
}

func (fc *FileCollector) persistOne(s *Span) {
	defer func() { recover() }()
	data, err := json.Marshal(s)
	if err != nil {
		return
	}
	if err = fc.rl.SafeLog(data); err != nil {
		glog.Warn("persist fail:", err)
	}
}

//--------------------------------------------------------------

var StdoutCollector = &stdoutCollector{}

type stdoutCollector struct{}

func (sc *stdoutCollector) Collect(span *Span) error {

	data, err := json.Marshal(span)
	if err != nil {
		return err
	}
	fmt.Println(string(data))
	return nil
}

func (sc *stdoutCollector) Close() error {
	return nil
}

//--------------------------------------------------------------

var DummyCollector = &dummyCollector{}

type dummyCollector struct{}

func (dc *dummyCollector) Collect(_ *Span) error { return nil }
func (dc *dummyCollector) Close() error          { return nil }

//--------------------------------------------------------------

// ServiceCollector 是对 FileCollector 的一个简单包装，用于将一个 service 的 trace 日志集中到同一个根目录下：
// 	1. 使用: `<root>/<service_name>.<pid>` 作为每个服务进程使用的收集目录
// 	2. 由于同一个服务可能多次启动，pid 不同会导致不同的日志目录，如果没有日志收集程序在工作，
// 	   那么可能导致磁盘空间无法收回（日志自动滚动只限于单个目录下），因此 ServiceCollector
//	   还负责自动发现需要删除的过期日志内容以减缓磁盘空间的占用
//
type ServiceCollector struct {
	*FileCollector
}

var DefaultCollectRoot = "/home/qboxserver/trace_logs"

func getLogPath(root, service string) string {
	return path.Join(root, service+"."+strconv.Itoa(os.Getpid()))
}

func NewServiceCollector(root, service string) (*ServiceCollector, error) {

	if root == "" {
		root = DefaultCollectRoot
	}
	if service == "" {
		panic("please specify service name")
	}
	tryCleanHistory(root, service)

	fc, err := NewFileCollector(&FileCollectorConfig{
		LogDir: getLogPath(root, service),
	})
	if err != nil {
		return nil, err
	}
	return &ServiceCollector{fc}, nil
}

var historyCleanDuration = 12 * time.Hour

func tryCleanHistory(dir, service string) {
	f, err := os.Open(dir)
	if err != nil {
		glog.Warn("open dir fail:", err)
		return
	}
	list, err := f.Readdir(-1)
	if err != nil {
		glog.Warn("read dir fail:", err)
		return
	}
	f.Close()

	for _, fi := range list {
		if !fi.IsDir() {
			continue
		}
		name := fi.Name()
		if !strings.HasPrefix(name, service) {
			continue
		}
		if time.Now().Sub(fi.ModTime()) < historyCleanDuration {
			continue
		}
		os.RemoveAll(path.Join(dir, name))
	}
}
