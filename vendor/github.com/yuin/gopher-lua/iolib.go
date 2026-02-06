package lua

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"syscall"
)

var ioFuncs = map[string]LGFunction{
	"close":   ioClose,
	"flush":   ioFlush,
	"lines":   ioLines,
	"input":   ioInput,
	"output":  ioOutput,
	"open":    ioOpenFile,
	"popen":   ioPopen,
	"read":    ioRead,
	"type":    ioType,
	"tmpfile": ioTmpFile,
	"write":   ioWrite,
}

const lFileClass = "FILE*"

type lFile struct {
	fp     *os.File
	pp     *exec.Cmd
	writer io.Writer
	reader *bufio.Reader
	stdout io.ReadCloser
	closed bool
}

type lFileType int

const (
	lFileFile lFileType = iota
	lFileProcess
)

const fileDefOutIndex = 1
const fileDefInIndex = 2
const fileDefaultWriteBuffer = 4096
const fileDefaultReadBuffer = 4096

func checkFile(L *LState) *lFile {
	ud := L.CheckUserData(1)
	if file, ok := ud.Value.(*lFile); ok {
		return file
	}
	L.ArgError(1, "file expected")
	return nil
}

func errorIfFileIsClosed(L *LState, file *lFile) {
	if file.closed {
		L.ArgError(1, "file is closed")
	}
}

func newFile(L *LState, file *os.File, path string, flag int, perm os.FileMode, writable, readable bool) (*LUserData, error) {
	ud := L.NewUserData()
	var err error
	if file == nil {
		file, err = os.OpenFile(path, flag, perm)
		if err != nil {
			return nil, err
		}
	}
	lfile := &lFile{fp: file, pp: nil, writer: nil, reader: nil, stdout: nil, closed: false}
	ud.Value = lfile
	if writable {
		lfile.writer = file
	}
	if readable {
		lfile.reader = bufio.NewReaderSize(file, fileDefaultReadBuffer)
	}
	L.SetMetatable(ud, L.GetTypeMetatable(lFileClass))
	return ud, nil
}

func newProcess(L *LState, cmd string, writable, readable bool) (*LUserData, error) {
	ud := L.NewUserData()
	c, args := popenArgs(cmd)
	pp := exec.Command(c, args...)
	lfile := &lFile{fp: nil, pp: pp, writer: nil, reader: nil, stdout: nil, closed: false}
	ud.Value = lfile

	var err error
	if writable {
		lfile.writer, err = pp.StdinPipe()
	}
	if readable {
		lfile.stdout, err = pp.StdoutPipe()
		lfile.reader = bufio.NewReaderSize(lfile.stdout, fileDefaultReadBuffer)
	}
	if err != nil {
		return nil, err
	}
	err = pp.Start()
	if err != nil {
		return nil, err
	}

	L.SetMetatable(ud, L.GetTypeMetatable(lFileClass))
	return ud, nil
}

func (file *lFile) Type() lFileType {
	if file.fp == nil {
		return lFileProcess
	}
	return lFileFile
}

func (file *lFile) Name() string {
	switch file.Type() {
	case lFileFile:
		return fmt.Sprintf("file %s", file.fp.Name())
	case lFileProcess:
		return fmt.Sprintf("process %s", file.pp.Path)
	}
	return ""
}

func (file *lFile) AbandonReadBuffer() error {
	if file.Type() == lFileFile && file.reader != nil {
		_, err := file.fp.Seek(-int64(file.reader.Buffered()), 1)
		if err != nil {
			return err
		}
		file.reader = bufio.NewReaderSize(file.fp, fileDefaultReadBuffer)
	}
	return nil
}

func fileDefOut(L *LState) *LUserData {
	return L.Get(UpvalueIndex(1)).(*LTable).RawGetInt(fileDefOutIndex).(*LUserData)
}

func fileDefIn(L *LState) *LUserData {
	return L.Get(UpvalueIndex(1)).(*LTable).RawGetInt(fileDefInIndex).(*LUserData)
}

func fileIsWritable(L *LState, file *lFile) int {
	if file.writer == nil {
		L.Push(LNil)
		L.Push(LString(fmt.Sprintf("%s is opened for only reading.", file.Name())))
		L.Push(LNumber(1)) // C-Lua compatibility: Original Lua pushes errno to the stack
		return 3
	}
	return 0
}

func fileIsReadable(L *LState, file *lFile) int {
	if file.reader == nil {
		L.Push(LNil)
		L.Push(LString(fmt.Sprintf("%s is opened for only writing.", file.Name())))
		L.Push(LNumber(1)) // C-Lua compatibility: Original Lua pushes errno to the stack
		return 3
	}
	return 0
}

var stdFiles = []struct {
	name     string
	file     *os.File
	writable bool
	readable bool
}{
	{"stdout", os.Stdout, true, false},
	{"stdin", os.Stdin, false, true},
	{"stderr", os.Stderr, true, false},
}

func OpenIo(L *LState) int {
	mod := L.RegisterModule(IoLibName, map[string]LGFunction{}).(*LTable)
	mt := L.NewTypeMetatable(lFileClass)
	mt.RawSetString("__index", mt)
	L.SetFuncs(mt, fileMethods)
	mt.RawSetString("lines", L.NewClosure(fileLines, L.NewFunction(fileLinesIter)))

	for _, finfo := range stdFiles {
		file, _ := newFile(L, finfo.file, "", 0, os.FileMode(0), finfo.writable, finfo.readable)
		mod.RawSetString(finfo.name, file)
	}
	uv := L.CreateTable(2, 0)
	uv.RawSetInt(fileDefOutIndex, mod.RawGetString("stdout"))
	uv.RawSetInt(fileDefInIndex, mod.RawGetString("stdin"))
	for name, fn := range ioFuncs {
		mod.RawSetString(name, L.NewClosure(fn, uv))
	}
	mod.RawSetString("lines", L.NewClosure(ioLines, uv, L.NewClosure(ioLinesIter, uv)))
	// Modifications are being made in-place rather than returned?
	L.Push(mod)
	return 1
}

var fileMethods = map[string]LGFunction{
	"__tostring": fileToString,
	"write":      fileWrite,
	"close":      fileClose,
	"flush":      fileFlush,
	"lines":      fileLines,
	"read":       fileRead,
	"seek":       fileSeek,
	"setvbuf":    fileSetVBuf,
}

func fileToString(L *LState) int {
	file := checkFile(L)
	if file.Type() == lFileFile {
		if file.closed {
			L.Push(LString("file (closed)"))
		} else {
			L.Push(LString("file"))
		}
	} else {
		if file.closed {
			L.Push(LString("process (closed)"))
		} else {
			L.Push(LString("process"))
		}
	}
	return 1
}

func fileWriteAux(L *LState, file *lFile, idx int) int {
	if n := fileIsWritable(L, file); n != 0 {
		return n
	}
	errorIfFileIsClosed(L, file)
	top := L.GetTop()
	out := file.writer
	var err error
	for i := idx; i <= top; i++ {
		L.CheckTypes(i, LTNumber, LTString)
		s := LVAsString(L.Get(i))
		if _, err = out.Write(unsafeFastStringToReadOnlyBytes(s)); err != nil {
			goto errreturn
		}
	}

	file.AbandonReadBuffer()
	L.Push(LTrue)
	return 1
errreturn:

	file.AbandonReadBuffer()
	L.Push(LNil)
	L.Push(LString(err.Error()))
	L.Push(LNumber(1)) // C-Lua compatibility: Original Lua pushes errno to the stack
	return 3
}

func fileCloseAux(L *LState, file *lFile) int {
	file.closed = true
	var err error
	if file.writer != nil {
		if bwriter, ok := file.writer.(*bufio.Writer); ok {
			if err = bwriter.Flush(); err != nil {
				goto errreturn
			}
		}
	}
	file.AbandonReadBuffer()

	switch file.Type() {
	case lFileFile:
		if err = file.fp.Close(); err != nil {
			goto errreturn
		}
		L.Push(LTrue)
		return 1
	case lFileProcess:
		if file.stdout != nil {
			file.stdout.Close() // ignore errors
		}
		err = file.pp.Wait()
		var exitStatus int // Initialised to zero value = 0
		if err != nil {
			if e2, ok := err.(*exec.ExitError); ok {
				if s, ok := e2.Sys().(syscall.WaitStatus); ok {
					exitStatus = s.ExitStatus()
				} else {
					err = errors.New("Unimplemented for system where exec.ExitError.Sys() is not syscall.WaitStatus.")
				}
			}
		} else {
			exitStatus = 0
		}
		L.Push(LNumber(exitStatus))
		return 1
	}

errreturn:
	L.RaiseError(err.Error())
	return 0
}

func fileFlushAux(L *LState, file *lFile) int {
	if n := fileIsWritable(L, file); n != 0 {
		return n
	}
	errorIfFileIsClosed(L, file)

	if bwriter, ok := file.writer.(*bufio.Writer); ok {
		if err := bwriter.Flush(); err != nil {
			L.Push(LNil)
			L.Push(LString(err.Error()))
			return 2
		}
	}
	L.Push(LTrue)
	return 1
}

func fileReadAux(L *LState, file *lFile, idx int) int {
	if n := fileIsReadable(L, file); n != 0 {
		return n
	}
	errorIfFileIsClosed(L, file)
	if L.GetTop() == idx-1 {
		L.Push(LString("*l"))
	}
	var err error
	top := L.GetTop()
	for i := idx; i <= top; i++ {
		switch lv := L.Get(i).(type) {
		case LNumber:
			size := int64(lv)
			if size == 0 {
				_, err = file.reader.ReadByte()
				if err == io.EOF {
					L.Push(LNil)
					goto normalreturn
				}
				file.reader.UnreadByte()
			}
			var buf []byte
			var iseof bool
			buf, err, iseof = readBufioSize(file.reader, size)
			if iseof {
				L.Push(LNil)
				goto normalreturn
			}
			if err != nil {
				goto errreturn
			}
			L.Push(LString(string(buf)))
		case LString:
			options := L.CheckString(i)
			if len(options) > 0 && options[0] != '*' {
				L.ArgError(2, "invalid options:"+options)
			}
			for _, opt := range options[1:] {
				switch opt {
				case 'n':
					var v LNumber
					_, err = fmt.Fscanf(file.reader, LNumberScanFormat, &v)
					if err == io.EOF {
						L.Push(LNil)
						goto normalreturn
					}
					if err != nil {
						goto errreturn
					}
					L.Push(v)
				case 'a':
					var buf []byte
					buf, err = ioutil.ReadAll(file.reader)
					if err == io.EOF {
						L.Push(emptyLString)
						goto normalreturn
					}
					if err != nil {
						goto errreturn
					}
					L.Push(LString(string(buf)))
				case 'l':
					var buf []byte
					var iseof bool
					buf, err, iseof = readBufioLine(file.reader)
					if iseof {
						L.Push(LNil)
						goto normalreturn
					}
					if err != nil {
						goto errreturn
					}
					L.Push(LString(string(buf)))
				default:
					L.ArgError(2, "invalid options:"+string(opt))
				}
			}
		}
	}
normalreturn:
	return L.GetTop() - top

errreturn:
	L.RaiseError(err.Error())
	//L.Push(LNil)
	//L.Push(LString(err.Error()))
	return 2
}

var fileSeekOptions = []string{"set", "cur", "end"}

func fileSeek(L *LState) int {
	file := checkFile(L)
	if file.Type() != lFileFile {
		L.Push(LNil)
		L.Push(LString("can not seek a process."))
		return 2
	}

	top := L.GetTop()
	if top == 1 {
		L.Push(LString("cur"))
		L.Push(LNumber(0))
	} else if top == 2 {
		L.Push(LNumber(0))
	}

	var pos int64
	var err error

	err = file.AbandonReadBuffer()
	if err != nil {
		goto errreturn
	}

	pos, err = file.fp.Seek(L.CheckInt64(3), L.CheckOption(2, fileSeekOptions))
	if err != nil {
		goto errreturn
	}

	L.Push(LNumber(pos))
	return 1

errreturn:
	L.Push(LNil)
	L.Push(LString(err.Error()))
	return 2
}

func fileWrite(L *LState) int {
	return fileWriteAux(L, checkFile(L), 2)
}

func fileClose(L *LState) int {
	return fileCloseAux(L, checkFile(L))
}

func fileFlush(L *LState) int {
	return fileFlushAux(L, checkFile(L))
}

func fileLinesIter(L *LState) int {
	var file *lFile
	if ud, ok := L.Get(1).(*LUserData); ok {
		file = ud.Value.(*lFile)
	} else {
		file = L.Get(UpvalueIndex(2)).(*LUserData).Value.(*lFile)
	}
	buf, _, err := file.reader.ReadLine()
	if err != nil {
		if err == io.EOF {
			L.Push(LNil)
			return 1
		}
		L.RaiseError(err.Error())
	}
	L.Push(LString(string(buf)))
	return 1
}

func fileLines(L *LState) int {
	file := checkFile(L)
	ud := L.CheckUserData(1)
	if n := fileIsReadable(L, file); n != 0 {
		return 0
	}
	L.Push(L.NewClosure(fileLinesIter, L.Get(UpvalueIndex(1)), ud))
	return 1
}

func fileRead(L *LState) int {
	return fileReadAux(L, checkFile(L), 2)
}

var filebufOptions = []string{"no", "full"}

func fileSetVBuf(L *LState) int {
	var err error
	var writer io.Writer
	file := checkFile(L)
	if n := fileIsWritable(L, file); n != 0 {
		return n
	}
	switch filebufOptions[L.CheckOption(2, filebufOptions)] {
	case "no":
		switch file.Type() {
		case lFileFile:
			file.writer = file.fp
		case lFileProcess:
			file.writer, err = file.pp.StdinPipe()
			if err != nil {
				goto errreturn
			}
		}
	case "full", "line": // TODO line buffer not supported
		bufsize := L.OptInt(3, fileDefaultWriteBuffer)
		switch file.Type() {
		case lFileFile:
			file.writer = bufio.NewWriterSize(file.fp, bufsize)
		case lFileProcess:
			writer, err = file.pp.StdinPipe()
			if err != nil {
				goto errreturn
			}
			file.writer = bufio.NewWriterSize(writer, bufsize)
		}
	}
	L.Push(LTrue)
	return 1
errreturn:
	L.Push(LNil)
	L.Push(LString(err.Error()))
	return 2
}

func ioInput(L *LState) int {
	if L.GetTop() == 0 {
		L.Push(fileDefIn(L))
		return 1
	}
	switch lv := L.Get(1).(type) {
	case LString:
		file, err := newFile(L, nil, string(lv), os.O_RDONLY, 0600, false, true)
		if err != nil {
			L.RaiseError(err.Error())
		}
		L.Get(UpvalueIndex(1)).(*LTable).RawSetInt(fileDefInIndex, file)
		L.Push(file)
		return 1
	case *LUserData:
		if _, ok := lv.Value.(*lFile); ok {
			L.Get(UpvalueIndex(1)).(*LTable).RawSetInt(fileDefInIndex, lv)
			L.Push(lv)
			return 1
		}

	}
	L.ArgError(1, "string or file expedted, but got "+L.Get(1).Type().String())
	return 0
}

func ioClose(L *LState) int {
	if L.GetTop() == 0 {
		return fileCloseAux(L, fileDefOut(L).Value.(*lFile))
	}
	return fileClose(L)
}

func ioFlush(L *LState) int {
	return fileFlushAux(L, fileDefOut(L).Value.(*lFile))
}

func ioLinesIter(L *LState) int {
	var file *lFile
	toclose := false
	if ud, ok := L.Get(1).(*LUserData); ok {
		file = ud.Value.(*lFile)
	} else {
		file = L.Get(UpvalueIndex(2)).(*LUserData).Value.(*lFile)
		toclose = true
	}
	buf, _, err := file.reader.ReadLine()
	if err != nil {
		if err == io.EOF {
			if toclose {
				fileCloseAux(L, file)
			}
			L.Push(LNil)
			return 1
		}
		L.RaiseError(err.Error())
	}
	L.Push(LString(string(buf)))
	return 1
}

func ioLines(L *LState) int {
	if L.GetTop() == 0 {
		L.Push(L.Get(UpvalueIndex(2)))
		L.Push(fileDefIn(L))
		return 2
	}

	path := L.CheckString(1)
	ud, err := newFile(L, nil, path, os.O_RDONLY, os.FileMode(0600), false, true)
	if err != nil {
		return 0
	}
	L.Push(L.NewClosure(ioLinesIter, L.Get(UpvalueIndex(1)), ud))
	return 1
}

var ioOpenOpions = []string{"r", "rb", "w", "wb", "a", "ab", "r+", "rb+", "w+", "wb+", "a+", "ab+"}

func ioOpenFile(L *LState) int {
	path := L.CheckString(1)
	if L.GetTop() == 1 {
		L.Push(LString("r"))
	}
	mode := os.O_RDONLY
	perm := 0600
	writable := true
	readable := true
	switch ioOpenOpions[L.CheckOption(2, ioOpenOpions)] {
	case "r", "rb":
		mode = os.O_RDONLY
		writable = false
	case "w", "wb":
		mode = os.O_WRONLY | os.O_TRUNC | os.O_CREATE
		readable = false
	case "a", "ab":
		mode = os.O_WRONLY | os.O_APPEND | os.O_CREATE
	case "r+", "rb+":
		mode = os.O_RDWR
	case "w+", "wb+":
		mode = os.O_RDWR | os.O_TRUNC | os.O_CREATE
	case "a+", "ab+":
		mode = os.O_APPEND | os.O_RDWR | os.O_CREATE
	}
	file, err := newFile(L, nil, path, mode, os.FileMode(perm), writable, readable)
	if err != nil {
		L.Push(LNil)
		L.Push(LString(err.Error()))
		L.Push(LNumber(1)) // C-Lua compatibility: Original Lua pushes errno to the stack
		return 3
	}
	L.Push(file)
	return 1

}

var ioPopenOptions = []string{"r", "w"}

func ioPopen(L *LState) int {
	cmd := L.CheckString(1)
	if L.GetTop() == 1 {
		L.Push(LString("r"))
	} else if L.GetTop() > 1 && (L.Get(2)).Type() == LTNil {
		L.SetTop(1)
		L.Push(LString("r"))
	}
	var file *LUserData
	var err error

	switch ioPopenOptions[L.CheckOption(2, ioPopenOptions)] {
	case "r":
		file, err = newProcess(L, cmd, false, true)
	case "w":
		file, err = newProcess(L, cmd, true, false)
	}
	if err != nil {
		L.Push(LNil)
		L.Push(LString(err.Error()))
		return 2
	}
	L.Push(file)
	return 1
}

func ioRead(L *LState) int {
	return fileReadAux(L, fileDefIn(L).Value.(*lFile), 1)
}

func ioType(L *LState) int {
	ud, udok := L.Get(1).(*LUserData)
	if !udok {
		L.Push(LNil)
		return 1
	}
	file, ok := ud.Value.(*lFile)
	if !ok {
		L.Push(LNil)
		return 1
	}
	if file.closed {
		L.Push(LString("closed file"))
		return 1
	}
	L.Push(LString("file"))
	return 1
}

func ioTmpFile(L *LState) int {
	file, err := ioutil.TempFile("", "")
	if err != nil {
		L.Push(LNil)
		L.Push(LString(err.Error()))
		return 2
	}
	L.G.tempFiles = append(L.G.tempFiles, file)
	ud, _ := newFile(L, file, "", 0, os.FileMode(0), true, true)
	L.Push(ud)
	return 1
}

func ioOutput(L *LState) int {
	if L.GetTop() == 0 {
		L.Push(fileDefOut(L))
		return 1
	}
	switch lv := L.Get(1).(type) {
	case LString:
		file, err := newFile(L, nil, string(lv), os.O_WRONLY|os.O_CREATE, 0600, true, false)
		if err != nil {
			L.RaiseError(err.Error())
		}
		L.Get(UpvalueIndex(1)).(*LTable).RawSetInt(fileDefOutIndex, file)
		L.Push(file)
		return 1
	case *LUserData:
		if _, ok := lv.Value.(*lFile); ok {
			L.Get(UpvalueIndex(1)).(*LTable).RawSetInt(fileDefOutIndex, lv)
			L.Push(lv)
			return 1
		}

	}
	L.ArgError(1, "string or file expedted, but got "+L.Get(1).Type().String())
	return 0
}

func ioWrite(L *LState) int {
	return fileWriteAux(L, fileDefOut(L).Value.(*lFile), 1)
}

//
