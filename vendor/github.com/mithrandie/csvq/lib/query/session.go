package query

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"sync"
	"time"

	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"

	"golang.org/x/crypto/ssh/terminal"
)

var (
	screenFd                = os.Stdin.Fd()
	stdin    io.ReadCloser  = os.Stdin
	stdout   io.WriteCloser = os.Stdout
	stderr   io.WriteCloser = os.Stderr
)

const DefaultScreenWidth = 75

func isNamedPipe(fp *os.File) bool {
	fi, err := fp.Stat()
	if err == nil && (fi.Mode()&os.ModeNamedPipe != 0 || 0 < fi.Size()) {
		return true
	}
	return false
}

type Discard struct {
}

func NewDiscard() *Discard {
	return &Discard{}
}

func (d Discard) Write(p []byte) (int, error) {
	return len(p), nil
}

func (d Discard) Close() error {
	return nil
}

type Input struct {
	reader io.Reader
}

func NewInput(r io.Reader) *Input {
	return &Input{reader: r}
}

func (r *Input) Read(p []byte) (int, error) {
	return r.reader.Read(p)
}

func (r *Input) Close() error {
	if rc, ok := r.reader.(io.ReadCloser); ok {
		return rc.Close()
	}
	return nil
}

type Output struct {
	bytes.Buffer
}

func NewOutput() *Output {
	return &Output{}
}

func (w *Output) Close() error {
	return nil
}

type StdinLocker struct {
	mtx      *sync.Mutex
	locked   bool
	rlockCnt int32
}

func NewStdinLocker() *StdinLocker {
	return &StdinLocker{
		mtx:      &sync.Mutex{},
		locked:   false,
		rlockCnt: 0,
	}
}

func (cl *StdinLocker) Lock() error {
	return cl.LockContext(context.Background())
}

func (cl *StdinLocker) LockContext(ctx context.Context) error {
	return cl.lockContext(ctx, cl.tryLock)
}

func (cl *StdinLocker) Unlock() (err error) {
	cl.mtx.Lock()
	if cl.locked {
		cl.locked = false
	} else {
		err = errors.New("locker is unlocked")
	}
	cl.mtx.Unlock()
	return
}

func (cl *StdinLocker) RLock() error {
	return cl.RLockContext(context.Background())
}

func (cl *StdinLocker) RLockContext(ctx context.Context) error {
	return cl.lockContext(ctx, cl.tryRLock)
}

func (cl *StdinLocker) RUnlock() (err error) {
	cl.mtx.Lock()
	if 0 < cl.rlockCnt {
		cl.rlockCnt--
	} else {
		err = errors.New("locker is unlocked")
	}
	cl.mtx.Unlock()
	return
}

func (cl *StdinLocker) tryLock() bool {
	cl.mtx.Lock()
	if cl.locked || 0 < cl.rlockCnt {
		cl.mtx.Unlock()
		return false
	}
	cl.locked = true
	cl.mtx.Unlock()
	return true
}

func (cl *StdinLocker) tryRLock() bool {
	cl.mtx.Lock()
	if cl.locked {
		cl.mtx.Unlock()
		return false
	}
	cl.rlockCnt++
	cl.mtx.Unlock()
	return true
}

func (cl *StdinLocker) lockContext(ctx context.Context, fn func() bool) error {
	if ctx.Err() != nil {
		return ConvertContextError(ctx.Err())
	}

	for {
		if fn() {
			return nil
		}

		select {
		case <-ctx.Done():
			return NewFileLockTimeoutError(parser.Identifier{Literal: parser.TokenLiteral(parser.STDIN)})
		case <-time.After(file.DefaultRetryDelay):
			// try again
		}
	}
}

type Session struct {
	screenFd uintptr
	stdin    io.ReadCloser
	stdout   io.WriteCloser
	stderr   io.WriteCloser
	outFile  io.Writer
	terminal VirtualTerminal

	CanReadStdin    bool
	CanOutputToPipe bool

	stdinViewMap ViewMap
	stdinLocker  *StdinLocker

	mtx *sync.Mutex
}

func NewSession() *Session {
	canReadStdin := isNamedPipe(os.Stdin)
	canOutputToPipe := isNamedPipe(os.Stdout)

	return &Session{
		screenFd: screenFd,
		stdin:    stdin,
		stdout:   stdout,
		stderr:   stderr,
		outFile:  nil,
		terminal: nil,

		CanReadStdin:    canReadStdin,
		CanOutputToPipe: canOutputToPipe,

		stdinViewMap: NewViewMap(),
		stdinLocker:  NewStdinLocker(),

		mtx: &sync.Mutex{},
	}
}

func (sess *Session) ScreenFd() uintptr {
	return sess.screenFd
}

func (sess *Session) Stdin() io.ReadCloser {
	return sess.stdin
}

func (sess *Session) Stdout() io.WriteCloser {
	return sess.stdout
}

func (sess *Session) Stderr() io.WriteCloser {
	return sess.stderr
}

func (sess *Session) OutFile() io.Writer {
	return sess.outFile
}

func (sess *Session) Terminal() VirtualTerminal {
	return sess.terminal
}

func (sess *Session) ScreenWidth() int {
	width := DefaultScreenWidth
	if sess.Terminal() != nil {
		if termw, _, err := sess.Terminal().GetSize(); err == nil {
			width = termw
		}
	} else {
		if w, _, err := terminal.GetSize(int(sess.ScreenFd())); err == nil {
			width = w
		}
	}
	return width
}

func (sess *Session) SetStdin(r io.ReadCloser) error {
	return sess.SetStdinContext(context.Background(), r)
}

func (sess *Session) SetStdinContext(ctx context.Context, r io.ReadCloser) error {
	if err := sess.stdinLocker.LockContext(ctx); err != nil {
		return err
	}

	sess.CanReadStdin = false
	if r != nil {
		if fp, ok := r.(*os.File); !ok || (ok && isNamedPipe(fp)) {
			sess.CanReadStdin = true
		}
	}

	sess.stdin = r
	_ = sess.stdinViewMap.Clean(nil)
	return sess.stdinLocker.Unlock()
}

func (sess *Session) SetStdout(w io.WriteCloser) {
	sess.mtx.Lock()
	sess.stdout = w
	sess.mtx.Unlock()
}

func (sess *Session) SetStderr(w io.WriteCloser) {
	sess.mtx.Lock()
	sess.stderr = w
	sess.mtx.Unlock()
}

func (sess *Session) SetOutFile(w io.Writer) {
	sess.mtx.Lock()
	sess.outFile = w
	sess.mtx.Unlock()
}

func (sess *Session) SetTerminal(t VirtualTerminal) {
	sess.mtx.Lock()
	sess.terminal = t
	sess.mtx.Unlock()
}

func (sess *Session) GetStdinView(ctx context.Context, flags *option.Flags, fileInfo *FileInfo, expr parser.Stdin) (*View, error) {
	if !sess.stdinViewMap.Exists(expr.String()) {
		if !sess.CanReadStdin {
			return nil, NewStdinEmptyError(expr)
		}

		view, err := loadViewFromFile(ctx, flags, sess.stdin, fileInfo, flags.ImportOptions, expr)
		if err != nil {
			if _, ok := err.(Error); !ok {
				err = NewDataParsingError(expr, fileInfo.Path, err.Error())
			}
			return nil, err
		}
		sess.stdinViewMap.Store(view.FileInfo.IdentifiedPath(), view)
	}
	view, err := sess.stdinViewMap.Get(expr.String())
	if err != nil {
		err = NewTableNotLoadedError(parser.Identifier{BaseExpr: expr.BaseExpr, Literal: expr.String()})
	}
	return view, err
}

func (sess *Session) updateStdinView(view *View) {
	sess.stdinViewMap.Store(view.FileInfo.IdentifiedPath(), view)
}

func (sess *Session) WriteToStdout(s string) (err error) {
	sess.mtx.Lock()
	if sess.terminal != nil {
		err = sess.terminal.Write(s)
	} else if sess.stdout != nil {
		_, err = sess.stdout.Write([]byte(s))
	}
	sess.mtx.Unlock()
	return
}

func (sess *Session) WriteToStdoutWithLineBreak(s string) error {
	if 0 < len(s) && s[len(s)-1] != '\n' {
		s = s + "\n"
	}
	return sess.WriteToStdout(s)
}

func (sess *Session) WriteToStderr(s string) (err error) {
	sess.mtx.Lock()
	if sess.terminal != nil {
		err = sess.terminal.WriteError(s)
	} else if sess.stderr != nil {
		_, err = sess.stderr.Write([]byte(s))
	}
	sess.mtx.Unlock()
	return
}

func (sess *Session) WriteToStderrWithLineBreak(s string) error {
	if 0 < len(s) && s[len(s)-1] != '\n' {
		s = s + "\n"
	}
	return sess.WriteToStderr(s)
}
