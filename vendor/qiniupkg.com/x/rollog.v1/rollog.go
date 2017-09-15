package rollog

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"
	"syscall"

	"github.com/qiniu/errors"
)

const DefaultChunkBits = 26

type file struct {
	*os.File
	fno int32
	ref int32

	onClose func()
}

func (r *file) Release() {

	ref := atomic.AddInt32(&r.ref, -1)
	if ref <= 0 {
		r.File.Close()
		if r.onClose != nil {
			r.onClose()
		}
	}
}

func (r *file) Acquire() {
	atomic.AddInt32(&r.ref, 1)
}

type Rolloger struct {
	file  *file
	off   int64
	mutex sync.Mutex

	keepn     uint
	chunkBits uint
	base      string
}

func Open(name string, chunkBits, keepn uint) (r *Rolloger, err error) {

	err = syscall.Mkdir(name, 0777)
	if err != nil {
		if err != syscall.EEXIST {
			err = errors.Info(err, "rollog.Open failed", name).Detail(err)
			return
		}
		err = nil
	}

	if chunkBits > 32 {
		err = errors.Info(syscall.EINVAL, "rollog.Open failed: invalid argument")
		return
	} else if chunkBits == 0 {
		chunkBits = DefaultChunkBits
	}
	if keepn == 0 {
		err = errors.Info(syscall.EINVAL, "rollog.Open failed: invalid argument")
		return
	}
	r = &Rolloger{
		keepn:     keepn,
		chunkBits: chunkBits,
		base:      name + "/",
	}

	if err = r.getCurrent(); err != nil {
		return nil, err
	}
	r.clean()
	return
}

func (r *Rolloger) getCurrent() error {

	list, err := listSortFile(r.base)
	if err != nil {
		err = errors.Info(err, "rollog.readDir failed:", err)
		return err
	}
	fname, fidx, off := "0", int64(0), int64(0)
	for _, f := range list {
		idx, err := strconv.ParseInt(f.Name(), 36, 64)
		if err != nil {
			continue
		}
		fname, fidx, off = f.Name(), idx, f.Size()
		break
	}

	fp, err := os.OpenFile(r.base+fname, os.O_RDWR|os.O_CREATE, 0666)
	if err != nil {
		return err
	}
	r.file, r.off = &file{fp, int32(fidx), 1, r.clean}, off
	return nil
}

func (r *Rolloger) clean() {

	r.mutex.Lock()
	cur := r.file.fno
	r.mutex.Unlock()

	fis, err := listSortFile(r.base)
	if err != nil {
		return
	}
	for _, fi := range fis {
		idx, err := strconv.ParseInt(fi.Name(), 36, 64)
		if err != nil || idx <= int64(cur-int32(r.keepn)) {
			syscall.Unlink(r.base + fi.Name())
		}
	}
}

func (r *Rolloger) rotate() (err error) {

	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.off < 1<<r.chunkBits {
		return nil
	}
	old := r.file
	idx := r.file.fno + 1
	fp, err := os.OpenFile(r.base+strconv.FormatInt(int64(idx), 36), os.O_RDWR|os.O_CREATE, 0666)
	if err != nil {
		return err
	}
	r.file, r.off = &file{fp, idx, 1, r.clean}, 0

	if old != nil {
		old.Release()
	}
	return nil
}

func (r *Rolloger) Log(b []byte) (err error) {

	b = append(b, '\n')

	r.mutex.Lock()
	f, from, to := r.file, r.off, r.off+int64(len(b))
	r.off = to
	f.Acquire()
	r.mutex.Unlock()

	if to >= 1<<r.chunkBits {
		r.rotate()
	}
	defer f.Release()
	_, err = f.WriteAt(b, from)
	return
}

func (r *Rolloger) SafeLog(b []byte) (err error) {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("[WARN]rolloger is panicing:", r)
		}
	}()
	return r.Log(b)
}

func (r *Rolloger) Close() error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.file != nil {
		return r.file.Close()
	}
	return nil
}

func listSortFile(dirname string) ([]os.FileInfo, error) {

	f, err := os.Open(dirname)
	if err != nil {
		return nil, err
	}
	list, err := f.Readdir(-1)
	f.Close()

	sort.Sort(FileInfoList(list))
	return list, err
}

type FileInfoList []os.FileInfo

func (fis FileInfoList) Swap(i, j int) { fis[i], fis[j] = fis[j], fis[i] }

func (fis FileInfoList) Len() int { return len(fis) }

func (fis FileInfoList) Less(i, j int) bool {
	ino, _ := strconv.ParseInt(fis[i].Name(), 36, 64)
	jno, _ := strconv.ParseInt(fis[j].Name(), 36, 64)
	return ino > jno
}
