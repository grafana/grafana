package query

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mithrandie/csvq/lib/doc"
	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/go-text/color"
	"github.com/mithrandie/go-text/fixedlen"
)

type UrlResource struct {
	MimeType string
	Data     []byte
}

func NewUrlResource(res *http.Response) (*UrlResource, error) {
	contentType := res.Header.Get("Content-Type")
	contentItems := strings.Split(contentType, ";")
	mimeType := contentItems[0]

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, NewSystemError(err.Error())
	}

	return &UrlResource{
		MimeType: mimeType,
		Data:     body,
	}, nil
}

type Transaction struct {
	Session *Session

	Environment *option.Environment
	Palette     *color.Palette
	Flags       *option.Flags

	WaitTimeout   time.Duration
	RetryDelay    time.Duration
	FileContainer *file.Container

	CachedViews      ViewMap
	UncommittedViews UncommittedViews

	UrlCache map[string]*UrlResource

	operationMutex   *sync.Mutex
	viewLoadingMutex *sync.Mutex
	stdinIsLocked    bool

	flagMutex *sync.RWMutex

	PreparedStatements PreparedStatementMap

	SelectedViews []*View
	AffectedRows  int

	AutoCommit bool
}

func NewTransaction(ctx context.Context, defaultWaitTimeout time.Duration, retryDelay time.Duration, session *Session) (*Transaction, error) {
	environment, err := option.NewEnvironment(ctx, defaultWaitTimeout, retryDelay)
	if err != nil {
		return nil, ConvertLoadConfigurationError(err)
	}

	flags, err := option.NewFlags(environment)
	if err != nil {
		return nil, ConvertLoadConfigurationError(err)
	}

	palette, err := option.NewPalette(environment)
	if err != nil {
		return nil, ConvertLoadConfigurationError(err)
	}

	palette.Disable()

	return &Transaction{
		Session:            session,
		Environment:        environment,
		Palette:            palette,
		Flags:              flags,
		WaitTimeout:        file.DefaultWaitTimeout,
		RetryDelay:         file.DefaultRetryDelay,
		FileContainer:      file.NewContainer(),
		CachedViews:        NewViewMap(),
		UncommittedViews:   NewUncommittedViews(),
		UrlCache:           make(map[string]*UrlResource, 5),
		operationMutex:     &sync.Mutex{},
		viewLoadingMutex:   &sync.Mutex{},
		stdinIsLocked:      false,
		flagMutex:          &sync.RWMutex{},
		PreparedStatements: NewPreparedStatementMap(),
		SelectedViews:      nil,
		AffectedRows:       0,
		AutoCommit:         false,
	}, nil
}

func (tx *Transaction) UpdateWaitTimeout(waitTimeout float64, retryDelay time.Duration) {
	d, err := time.ParseDuration(strconv.FormatFloat(waitTimeout, 'f', -1, 64) + "s")
	if err != nil {
		d = file.DefaultWaitTimeout
	}

	tx.WaitTimeout = d
	tx.RetryDelay = retryDelay
	tx.Flags.SetWaitTimeout(waitTimeout)
}

func (tx *Transaction) UseColor(useColor bool) {
	if useColor {
		tx.Palette.Enable()
	} else {
		tx.Palette.Disable()
	}
	tx.Flags.SetColor(useColor)
}

func (tx *Transaction) Commit(ctx context.Context, scope *ReferenceScope, expr parser.Expression) error {
	tx.operationMutex.Lock()
	defer tx.operationMutex.Unlock()

	createdFiles, updatedFiles := tx.UncommittedViews.UncommittedFiles()

	createFileInfo := make([]*FileInfo, 0, len(createdFiles))
	updateFileInfo := make([]*FileInfo, 0, len(updatedFiles))

	if 0 < len(createdFiles) {
		for _, fileInfo := range createdFiles {
			view, _ := tx.CachedViews.Get(fileInfo.IdentifiedPath())

			fp, _ := view.FileInfo.Handler.FileForUpdate()
			if err := fp.Truncate(0); err != nil {
				return NewSystemError(err.Error())
			}
			if _, err := fp.Seek(0, io.SeekStart); err != nil {
				return NewSystemError(err.Error())
			}

			if _, err := EncodeView(ctx, fp, view, fileInfo.ExportOptions(tx), tx.Palette); err != nil {
				return NewCommitError(expr, err.Error())
			}

			if !tx.Flags.ExportOptions.StripEndingLineBreak && !(fileInfo.Format == option.FIXED && fileInfo.SingleLine) {
				if _, err := fp.Write([]byte(tx.Flags.ExportOptions.LineBreak.Value())); err != nil {
					return NewCommitError(expr, err.Error())
				}
			}

			createFileInfo = append(createFileInfo, view.FileInfo)
		}
	}

	if 0 < len(updatedFiles) {
		for _, fileInfo := range updatedFiles {
			view, _ := tx.CachedViews.Get(fileInfo.IdentifiedPath())

			fp, _ := view.FileInfo.Handler.FileForUpdate()
			if err := fp.Truncate(0); err != nil {
				return NewSystemError(err.Error())
			}
			if _, err := fp.Seek(0, io.SeekStart); err != nil {
				return NewSystemError(err.Error())
			}

			if _, err := EncodeView(ctx, fp, view, fileInfo.ExportOptions(tx), tx.Palette); err != nil {
				return NewCommitError(expr, err.Error())
			}

			if !tx.Flags.ExportOptions.StripEndingLineBreak && !(fileInfo.Format == option.FIXED && fileInfo.SingleLine) {
				if _, err := fp.Write([]byte(tx.Flags.ExportOptions.LineBreak.Value())); err != nil {
					return NewCommitError(expr, err.Error())
				}
			}

			updateFileInfo = append(updateFileInfo, view.FileInfo)
		}
	}

	for _, f := range createFileInfo {
		if err := tx.FileContainer.Commit(f.Handler); err != nil {
			return NewCommitError(expr, err.Error())
		}
		tx.UncommittedViews.Unset(f)
		tx.LogNotice(fmt.Sprintf("Commit: file %q is created.", f.Path), tx.Flags.Quiet)
	}
	for _, f := range updateFileInfo {
		if err := tx.FileContainer.Commit(f.Handler); err != nil {
			return NewCommitError(expr, err.Error())
		}
		tx.UncommittedViews.Unset(f)
		tx.LogNotice(fmt.Sprintf("Commit: file %q is updated.", f.Path), tx.Flags.Quiet)
	}

	msglist := scope.StoreTemporaryTable(tx.Session, tx.UncommittedViews.UncommittedTempViews())
	if 0 < len(msglist) {
		tx.LogNotice(strings.Join(msglist, "\n"), tx.quietForTemporaryViews(expr))
	}
	tx.UncommittedViews.Clean()
	tx.UnlockStdin()
	if err := tx.ReleaseResources(); err != nil {
		return NewCommitError(expr, err.Error())
	}
	return nil
}

func (tx *Transaction) Rollback(scope *ReferenceScope, expr parser.Expression) error {
	tx.operationMutex.Lock()
	defer tx.operationMutex.Unlock()

	createdFiles, updatedFiles := tx.UncommittedViews.UncommittedFiles()

	if 0 < len(createdFiles) {
		for _, fileinfo := range createdFiles {
			tx.LogNotice(fmt.Sprintf("Rollback: file %q is deleted.", fileinfo.Path), tx.Flags.Quiet)
		}
	}

	if 0 < len(updatedFiles) {
		for _, fileinfo := range updatedFiles {
			tx.LogNotice(fmt.Sprintf("Rollback: file %q is restored.", fileinfo.Path), tx.Flags.Quiet)
		}
	}

	if scope != nil {
		msglist := scope.RestoreTemporaryTable(tx.UncommittedViews.UncommittedTempViews())
		if 0 < len(msglist) {
			tx.LogNotice(strings.Join(msglist, "\n"), tx.quietForTemporaryViews(expr))
		}
	}
	tx.UncommittedViews.Clean()
	tx.UnlockStdin()
	if err := tx.ReleaseResources(); err != nil {
		return NewRollbackError(expr, err.Error())
	}
	return nil
}

func (tx *Transaction) quietForTemporaryViews(expr parser.Expression) bool {
	return tx.Flags.Quiet || expr == nil
}

func (tx *Transaction) ReleaseResources() error {
	if err := tx.CachedViews.Clean(tx.FileContainer); err != nil {
		return err
	}
	if err := tx.FileContainer.CloseAll(); err != nil {
		return err
	}
	tx.UnlockStdin()
	tx.ClearUrlCache()
	return nil
}

func (tx *Transaction) ReleaseResourcesWithErrors() error {
	var errs []error
	if err := tx.CachedViews.CleanWithErrors(tx.FileContainer); err != nil {
		errs = append(errs, err.(*file.ForcedUnlockError).Errors...)
	}
	if err := tx.FileContainer.CloseAllWithErrors(); err != nil {
		errs = append(errs, err.(*file.ForcedUnlockError).Errors...)
	}
	tx.UnlockStdin()
	tx.ClearUrlCache()
	return file.NewForcedUnlockError(errs)
}

func (tx *Transaction) LockStdinContext(ctx context.Context) error {
	tctx, cancel := file.GetTimeoutContext(ctx, tx.WaitTimeout)
	defer cancel()

	err := tx.Session.stdinLocker.LockContext(tctx)
	if err == nil {
		tx.stdinIsLocked = true
	}
	return err
}

func (tx *Transaction) UnlockStdin() {
	if tx.stdinIsLocked {
		tx.stdinIsLocked = false
		_ = tx.Session.stdinLocker.Unlock()
	}
}

func (tx *Transaction) RLockStdinContext(ctx context.Context) error {
	tctx, cancel := file.GetTimeoutContext(ctx, tx.WaitTimeout)
	defer cancel()

	return tx.Session.stdinLocker.RLockContext(tctx)
}

func (tx *Transaction) RUnlockStdin() {
	_ = tx.Session.stdinLocker.RUnlock()
}

func (tx *Transaction) ClearUrlCache() {
	for k := range tx.UrlCache {
		delete(tx.UrlCache, k)
	}
}

func (tx *Transaction) CreateDocumentWriter() *doc.Writer {
	return doc.NewWriter(tx.Session.ScreenWidth(), tx.Flags, tx.Palette)
}

func (tx *Transaction) Error(s string) string {
	if tx.Palette != nil {
		return tx.Palette.Render(option.ErrorEffect, s)
	}
	return s
}

func (tx *Transaction) Warn(s string) string {
	if tx.Palette != nil {
		return tx.Palette.Render(option.WarnEffect, s)
	}
	return s
}

func (tx *Transaction) Notice(s string) string {
	if tx.Palette != nil {
		return tx.Palette.Render(option.NoticeEffect, s)
	}
	return s
}

func (tx *Transaction) Log(log string, quiet bool) {
	if !quiet {
		if err := tx.Session.WriteToStdoutWithLineBreak(log); err != nil {
			println(err.Error())
		}
	}
}

func (tx *Transaction) LogNotice(log string, quiet bool) {
	if !quiet {
		if err := tx.Session.WriteToStdoutWithLineBreak(tx.Notice(log)); err != nil {
			println(err.Error())
		}
	}
}

func (tx *Transaction) LogWarn(log string, quiet bool) {
	if !quiet {
		if err := tx.Session.WriteToStdoutWithLineBreak(tx.Warn(log)); err != nil {
			println(err.Error())
		}
	}
}

func (tx *Transaction) LogError(log string) {
	if err := tx.Session.WriteToStderrWithLineBreak(tx.Error(log)); err != nil {
		println(err.Error())
	}
}

var errNotAllowdFlagFormat = errors.New("not allowed flag format")
var errInvalidFlagName = errors.New("invalid flag name")

func (tx *Transaction) SetFormatFlag(value interface{}, outFile string) error {
	return tx.setFlag(option.FormatFlag, value, outFile)
}

func (tx *Transaction) SetFlag(key string, value interface{}) error {
	return tx.setFlag(key, value, "")
}

func (tx *Transaction) setFlag(key string, value interface{}, outFile string) error {
	tx.flagMutex.Lock()
	defer tx.flagMutex.Unlock()

	var err error

	switch strings.ToUpper(key) {
	case option.RepositoryFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetRepository(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.TimezoneFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetLocation(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.DatetimeFormatFlag:
		if s, ok := value.(string); ok {
			tx.Flags.SetDatetimeFormat(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.AnsiQuotesFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetAnsiQuotes(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.StrictEqualFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetStrictEqual(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.WaitTimeoutFlag:
		if f, ok := value.(float64); ok {
			tx.UpdateWaitTimeout(f, file.DefaultRetryDelay)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.ImportFormatFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetImportFormat(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.DelimiterFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetDelimiter(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.AllowUnevenFieldsFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetAllowUnevenFields(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.DelimiterPositionsFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetDelimiterPositions(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.JsonQueryFlag:
		if s, ok := value.(string); ok {
			tx.Flags.SetJsonQuery(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.EncodingFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetEncoding(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.NoHeaderFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetNoHeader(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.WithoutNullFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetWithoutNull(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.FormatFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetFormat(s, outFile, tx.Session.CanOutputToPipe)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.ExportEncodingFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetWriteEncoding(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.ExportDelimiterFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetWriteDelimiter(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.ExportDelimiterPositionsFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetWriteDelimiterPositions(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.WithoutHeaderFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetWithoutHeader(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.LineBreakFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetLineBreak(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.EncloseAllFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetEncloseAll(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.JsonEscapeFlag:
		if s, ok := value.(string); ok {
			err = tx.Flags.SetJsonEscape(s)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.PrettyPrintFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetPrettyPrint(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.ScientificNotationFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetScientificNotation(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.StripEndingLineBreakFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetStripEndingLineBreak(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.EastAsianEncodingFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetEastAsianEncoding(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.CountDiacriticalSignFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetCountDiacriticalSign(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.CountFormatCodeFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetCountFormatCode(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.ColorFlag:
		if b, ok := value.(bool); ok {
			tx.UseColor(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.QuietFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetQuiet(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.LimitRecursion:
		if i, ok := value.(int64); ok {
			tx.Flags.SetLimitRecursion(i)
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.CPUFlag:
		if i, ok := value.(int64); ok {
			tx.Flags.SetCPU(int(i))
		} else {
			err = errNotAllowdFlagFormat
		}
	case option.StatsFlag:
		if b, ok := value.(bool); ok {
			tx.Flags.SetStats(b)
		} else {
			err = errNotAllowdFlagFormat
		}
	default:
		err = errInvalidFlagName
	}

	return err
}

func (tx *Transaction) GetFlag(key string) (value.Primary, bool) {
	tx.flagMutex.RLock()
	defer tx.flagMutex.RUnlock()

	var val value.Primary
	var ok = true

	switch strings.ToUpper(key) {
	case option.RepositoryFlag:
		val = value.NewString(tx.Flags.Repository)
	case option.TimezoneFlag:
		val = value.NewString(tx.Flags.Location)
	case option.DatetimeFormatFlag:
		s := ""
		if 0 < len(tx.Flags.DatetimeFormat) {
			list := make([]string, 0, len(tx.Flags.DatetimeFormat))
			for _, f := range tx.Flags.DatetimeFormat {
				list = append(list, "\""+f+"\"")
			}
			s = "[" + strings.Join(list, ", ") + "]"
		}
		val = value.NewString(s)
	case option.AnsiQuotesFlag:
		val = value.NewBoolean(tx.Flags.AnsiQuotes)
	case option.StrictEqualFlag:
		val = value.NewBoolean(tx.Flags.StrictEqual)
	case option.WaitTimeoutFlag:
		val = value.NewFloat(tx.Flags.WaitTimeout)
	case option.ImportFormatFlag:
		val = value.NewString(tx.Flags.ImportOptions.Format.String())
	case option.DelimiterFlag:
		val = value.NewString(string(tx.Flags.ImportOptions.Delimiter))
	case option.AllowUnevenFieldsFlag:
		val = value.NewBoolean(tx.Flags.ImportOptions.AllowUnevenFields)
	case option.DelimiterPositionsFlag:
		s := fixedlen.DelimiterPositions(tx.Flags.ImportOptions.DelimiterPositions).String()
		if tx.Flags.ImportOptions.SingleLine {
			s = "S" + s
		}
		val = value.NewString(s)
	case option.JsonQueryFlag:
		val = value.NewString(tx.Flags.ImportOptions.JsonQuery)
	case option.EncodingFlag:
		val = value.NewString(tx.Flags.ImportOptions.Encoding.String())
	case option.NoHeaderFlag:
		val = value.NewBoolean(tx.Flags.ImportOptions.NoHeader)
	case option.WithoutNullFlag:
		val = value.NewBoolean(tx.Flags.ImportOptions.WithoutNull)
	case option.FormatFlag:
		val = value.NewString(tx.Flags.ExportOptions.Format.String())
	case option.ExportEncodingFlag:
		val = value.NewString(tx.Flags.ExportOptions.Encoding.String())
	case option.ExportDelimiterFlag:
		val = value.NewString(string(tx.Flags.ExportOptions.Delimiter))
	case option.ExportDelimiterPositionsFlag:
		s := fixedlen.DelimiterPositions(tx.Flags.ExportOptions.DelimiterPositions).String()
		if tx.Flags.ExportOptions.SingleLine {
			s = "S" + s
		}
		val = value.NewString(s)
	case option.WithoutHeaderFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.WithoutHeader)
	case option.LineBreakFlag:
		val = value.NewString(tx.Flags.ExportOptions.LineBreak.String())
	case option.EncloseAllFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.EncloseAll)
	case option.JsonEscapeFlag:
		val = value.NewString(option.JsonEscapeTypeToString(tx.Flags.ExportOptions.JsonEscape))
	case option.PrettyPrintFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.PrettyPrint)
	case option.ScientificNotationFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.ScientificNotation)
	case option.StripEndingLineBreakFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.StripEndingLineBreak)
	case option.EastAsianEncodingFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.EastAsianEncoding)
	case option.CountDiacriticalSignFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.CountDiacriticalSign)
	case option.CountFormatCodeFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.CountFormatCode)
	case option.ColorFlag:
		val = value.NewBoolean(tx.Flags.ExportOptions.Color)
	case option.QuietFlag:
		val = value.NewBoolean(tx.Flags.Quiet)
	case option.LimitRecursion:
		val = value.NewInteger(tx.Flags.LimitRecursion)
	case option.CPUFlag:
		val = value.NewInteger(int64(tx.Flags.CPU))
	case option.StatsFlag:
		val = value.NewBoolean(tx.Flags.Stats)
	default:
		ok = false
	}
	return val, ok
}
