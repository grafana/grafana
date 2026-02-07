package query

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/mithrandie/csvq/lib/file"
	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"

	"github.com/mithrandie/go-text"
	"github.com/mithrandie/go-text/fixedlen"
	"github.com/mithrandie/go-text/json"
)

const (
	TableDelimiter          = "DELIMITER"
	TableDelimiterPositions = "DELIMITER_POSITIONS"
	TableFormat             = "FORMAT"
	TableEncoding           = "ENCODING"
	TableLineBreak          = "LINE_BREAK"
	TableHeader             = "HEADER"
	TableEncloseAll         = "ENCLOSE_ALL"
	TableJsonEscape         = "JSON_ESCAPE"
	TablePrettyPrint        = "PRETTY_PRINT"
)

type ViewType int

const (
	ViewTypeFile ViewType = iota
	ViewTypeTemporaryTable
	ViewTypeStdin
	ViewTypeRemoteObject
	ViewTypeStringObject
	ViewTypeInlineTable
)

var FileAttributeList = []string{
	TableDelimiter,
	TableDelimiterPositions,
	TableFormat,
	TableEncoding,
	TableLineBreak,
	TableHeader,
	TableEncloseAll,
	TableJsonEscape,
	TablePrettyPrint,
}

type TableAttributeUnchangedError struct {
	Path    string
	Message string
}

func NewTableAttributeUnchangedError(fpath string) error {
	return &TableAttributeUnchangedError{
		Path:    fpath,
		Message: "table attributes of %s remain unchanged",
	}
}

func (e TableAttributeUnchangedError) Error() string {
	return fmt.Sprintf(e.Message, e.Path)
}

type FileInfo struct {
	Path        string
	ArchivePath string

	Format             option.Format
	Delimiter          rune
	DelimiterPositions fixedlen.DelimiterPositions
	JsonQuery          string
	Encoding           text.Encoding
	LineBreak          text.LineBreak
	NoHeader           bool
	EncloseAll         bool
	JsonEscape         json.EscapeType
	PrettyPrint        bool

	SingleLine bool

	Handler *file.Handler

	ForUpdate bool
	ViewType  ViewType

	restorePointHeader    Header
	restorePointRecordSet RecordSet
}

func NewFileInfo(
	filename parser.Identifier,
	repository string,
	options option.ImportOptions,
	defaultFormat option.Format,
) (*FileInfo, error) {
	fpath, format, err := SearchFilePath(filename, repository, options, defaultFormat)
	if err != nil {
		return nil, err
	}

	delimiter := options.Delimiter
	encoding := options.Encoding
	switch format {
	case option.TSV:
		delimiter = '\t'
	case option.JSON, option.JSONL:
		encoding = text.UTF8
	}

	return &FileInfo{
		Path:      fpath,
		Format:    format,
		Delimiter: delimiter,
		Encoding:  encoding,
		ViewType:  ViewTypeFile,
	}, nil
}

func NewTemporaryTableFileInfo(name string) *FileInfo {
	return &FileInfo{
		Path:     name,
		ViewType: ViewTypeTemporaryTable,
	}
}

func NewStdinFileInfo(filePath string, importOptions option.ImportOptions, exportOptions option.ExportOptions) *FileInfo {
	f := &FileInfo{
		Path:     filePath,
		ViewType: ViewTypeStdin,
	}
	f.SetAllDefaultFileInfoAttributes(importOptions, exportOptions)
	return f
}

func NewInlineFileInfo(filePath string, importOptions option.ImportOptions, exportOptions option.ExportOptions) *FileInfo {
	f := &FileInfo{
		Path:     filePath,
		ViewType: ViewTypeInlineTable,
	}
	f.SetAllDefaultFileInfoAttributes(importOptions, exportOptions)
	return f
}

func (f *FileInfo) SetAllDefaultFileInfoAttributes(importOptions option.ImportOptions, exportOptions option.ExportOptions) {
	f.Format = importOptions.Format
	f.Delimiter = importOptions.Delimiter
	f.Encoding = importOptions.Encoding

	switch f.Format {
	case option.TSV:
		f.Delimiter = '\t'
	case option.JSON, option.JSONL:
		f.Encoding = text.UTF8
	}

	f.SetDefaultFileInfoAttributes(importOptions, exportOptions)
}

func (f *FileInfo) SetDefaultFileInfoAttributes(importOptions option.ImportOptions, exportOptions option.ExportOptions) {
	f.DelimiterPositions = importOptions.DelimiterPositions
	f.SingleLine = importOptions.SingleLine
	f.JsonQuery = option.TrimSpace(importOptions.JsonQuery)
	f.LineBreak = exportOptions.LineBreak
	f.NoHeader = importOptions.NoHeader
	f.EncloseAll = exportOptions.EncloseAll
	f.JsonEscape = exportOptions.JsonEscape
}

func (f *FileInfo) IsUpdatable() bool {
	return f.IsFile() || f.IsInMemoryTable()
}

func (f *FileInfo) SetDelimiter(s string) error {
	delimiter, err := option.ParseDelimiter(s)
	if err != nil {
		return err
	}

	var format option.Format
	if delimiter == '\t' {
		format = option.TSV
	} else {
		format = option.CSV
	}

	if f.Delimiter == delimiter && f.Format == format {
		return NewTableAttributeUnchangedError(f.Path)
	}

	f.Delimiter = delimiter
	f.Format = format
	return nil
}

func (f *FileInfo) SetDelimiterPositions(s string) error {
	pos, singleLine, err := option.ParseDelimiterPositions(s)
	if err != nil {
		return err
	}
	delimiterPositions := fixedlen.DelimiterPositions(pos)
	format := option.FIXED

	if reflect.DeepEqual(f.DelimiterPositions, delimiterPositions) &&
		f.SingleLine == singleLine &&
		f.Format == format {
		return NewTableAttributeUnchangedError(f.Path)
	}

	f.Format = format
	f.DelimiterPositions = delimiterPositions
	f.SingleLine = singleLine

	return nil
}

func (f *FileInfo) SetFormat(s string) error {
	format, escapeType, err := option.ParseFormat(s, f.JsonEscape)
	if err != nil {
		return err
	}

	if f.Format == format &&
		f.JsonEscape == escapeType {
		return NewTableAttributeUnchangedError(f.Path)
	}

	delimiter := f.Delimiter
	encoding := f.Encoding

	switch format {
	case option.TSV:
		delimiter = '\t'
	case option.JSON, option.JSONL:
		encoding = text.UTF8
	}

	f.Format = format
	f.JsonEscape = escapeType
	f.Delimiter = delimiter
	f.Encoding = encoding
	return nil
}

func (f *FileInfo) SetEncoding(s string) error {
	encoding, err := option.ParseEncoding(s)
	if err != nil || encoding == text.AUTO {
		return errors.New("encoding must be one of UTF8|UTF8M|UTF16|UTF16BE|UTF16LE|UTF16BEM|UTF16LEM|SJIS")
	}

	switch f.Format {
	case option.JSON, option.JSONL:
		if encoding != text.UTF8 {
			return errors.New("json format is supported only UTF8")
		}
	}

	if f.Encoding == encoding {
		return NewTableAttributeUnchangedError(f.Path)
	}

	f.Encoding = encoding
	return nil
}

func (f *FileInfo) SetLineBreak(s string) error {
	lb, err := option.ParseLineBreak(s)
	if err != nil {
		return err
	}

	if f.LineBreak == lb {
		return NewTableAttributeUnchangedError(f.Path)
	}

	f.LineBreak = lb
	return nil
}

func (f *FileInfo) SetNoHeader(b bool) error {
	if b == f.NoHeader {
		return NewTableAttributeUnchangedError(f.Path)
	}
	f.NoHeader = b
	return nil
}

func (f *FileInfo) SetEncloseAll(b bool) error {
	if b == f.EncloseAll {
		return NewTableAttributeUnchangedError(f.Path)
	}
	f.EncloseAll = b
	return nil
}

func (f *FileInfo) SetJsonEscape(s string) error {
	escape, err := option.ParseJsonEscapeType(s)
	if err != nil {
		return err
	}

	if escape == f.JsonEscape {
		return NewTableAttributeUnchangedError(f.Path)
	}

	f.JsonEscape = escape
	return nil
}

func (f *FileInfo) SetPrettyPrint(b bool) error {
	if b == f.PrettyPrint {
		return NewTableAttributeUnchangedError(f.Path)
	}
	f.PrettyPrint = b
	return nil
}

func (f *FileInfo) IsFile() bool {
	return f.ViewType == ViewTypeFile
}

func (f *FileInfo) IsTemporaryTable() bool {
	return f.ViewType == ViewTypeTemporaryTable
}

func (f *FileInfo) IsStdin() bool {
	return f.ViewType == ViewTypeStdin
}

func (f *FileInfo) IsInMemoryTable() bool {
	return f.ViewType == ViewTypeStdin || f.ViewType == ViewTypeTemporaryTable
}

func (f *FileInfo) IsRemoteObject() bool {
	return f.ViewType == ViewTypeRemoteObject
}

func (f *FileInfo) IsStringObject() bool {
	return f.ViewType == ViewTypeStringObject
}

func (f *FileInfo) IsInlineTable() bool {
	return f.ViewType == ViewTypeInlineTable
}

func (f *FileInfo) IdentifiedPath() string {
	s := strings.ToUpper(f.Path)
	if 0 < len(f.ArchivePath) {
		s = s + " IN " + strings.ToUpper(f.ArchivePath)
	}
	return s
}

func (f *FileInfo) ExportOptions(tx *Transaction) option.ExportOptions {
	ops := tx.Flags.ExportOptions.Copy()
	ops.Format = f.Format
	ops.Delimiter = f.Delimiter
	ops.DelimiterPositions = f.DelimiterPositions
	ops.SingleLine = f.SingleLine
	ops.Encoding = f.Encoding
	ops.LineBreak = f.LineBreak
	ops.WithoutHeader = f.NoHeader
	ops.EncloseAll = f.EncloseAll
	ops.JsonEscape = f.JsonEscape
	ops.PrettyPrint = f.PrettyPrint
	return ops
}

func SearchFilePath(filename parser.Identifier, repository string, options option.ImportOptions, defaultFormat option.Format) (string, option.Format, error) {
	var fpath string
	var err error

	format := options.Format

	switch format {
	case option.CSV, option.TSV:
		fpath, err = SearchCSVFilePath(filename, repository)
	case option.JSON:
		fpath, err = SearchJsonFilePath(filename, repository)
	case option.JSONL:
		fpath, err = SearchJsonlFilePath(filename, repository)
	case option.FIXED:
		fpath, err = SearchFixedLengthFilePath(filename, repository)
	case option.LTSV:
		fpath, err = SearchLTSVFilePath(filename, repository)
	default: // AutoSelect
		if fpath, err = SearchFilePathFromAllTypes(filename, repository); err == nil {
			switch strings.ToLower(filepath.Ext(fpath)) {
			case option.CsvExt:
				format = option.CSV
			case option.TsvExt:
				format = option.TSV
			case option.JsonExt:
				format = option.JSON
			case option.JsonlExt:
				format = option.JSONL
			case option.LtsvExt:
				format = option.LTSV
			default:
				format = defaultFormat
			}
		}
	}

	return fpath, format, err
}

func SearchCSVFilePath(filename parser.Identifier, repository string) (string, error) {
	return SearchFilePathWithExtType(filename, repository, []string{option.CsvExt, option.TsvExt, option.TextExt})
}

func SearchJsonFilePath(filename parser.Identifier, repository string) (string, error) {
	return SearchFilePathWithExtType(filename, repository, []string{option.JsonExt})
}

func SearchJsonlFilePath(filename parser.Identifier, repository string) (string, error) {
	return SearchFilePathWithExtType(filename, repository, []string{option.JsonlExt})
}

func SearchFixedLengthFilePath(filename parser.Identifier, repository string) (string, error) {
	return SearchFilePathWithExtType(filename, repository, []string{option.TextExt})
}

func SearchLTSVFilePath(filename parser.Identifier, repository string) (string, error) {
	return SearchFilePathWithExtType(filename, repository, []string{option.LtsvExt, option.TextExt})
}

func SearchFilePathFromAllTypes(filename parser.Identifier, repository string) (string, error) {
	return SearchFilePathWithExtType(filename, repository, []string{option.CsvExt, option.TsvExt, option.JsonExt, option.JsonlExt, option.LtsvExt, option.TextExt})
}

func SearchFilePathWithExtType(filename parser.Identifier, repository string, extTypes []string) (string, error) {
	fpath := filename.Literal
	if !filepath.IsAbs(fpath) {
		if len(repository) < 1 {
			repository, _ = os.Getwd()
		}
		fpath = filepath.Join(repository, fpath)
	}

	var info os.FileInfo
	var err error

	if info, err = os.Stat(fpath); err != nil {
		pathes := make([]string, 0, len(extTypes))
		infoList := make([]os.FileInfo, 0, len(extTypes))
		for _, ext := range extTypes {
			if i, err := os.Stat(fpath + ext); err == nil {
				pathes = append(pathes, fpath+ext)
				infoList = append(infoList, i)
			}
		}
		switch {
		case len(pathes) < 1:
			return fpath, NewFileNotExistError(filename)
		case 1 < len(pathes):
			return fpath, NewFileNameAmbiguousError(filename)
		}
		fpath = pathes[0]
		info = infoList[0]
	}

	fpath, err = filepath.Abs(fpath)
	if err != nil {
		return fpath, NewFileNotExistError(filename)
	}

	if info.IsDir() {
		return fpath, NewFileUnableToReadError(filename)
	}

	return fpath, nil
}

func NewFileInfoForCreate(filename parser.Identifier, repository string, delimiter rune, encoding text.Encoding) (*FileInfo, error) {
	fpath, err := CreateFilePath(filename, repository)
	if err != nil {
		return nil, NewIOError(filename, err.Error())
	}

	var format option.Format
	switch strings.ToLower(filepath.Ext(fpath)) {
	case option.TsvExt:
		delimiter = '\t'
		format = option.TSV
	case option.JsonExt:
		encoding = text.UTF8
		format = option.JSON
	case option.JsonlExt:
		encoding = text.UTF8
		format = option.JSONL
	case option.LtsvExt:
		format = option.LTSV
	case option.GfmExt:
		format = option.GFM
	case option.OrgExt:
		format = option.ORG
	default:
		format = option.CSV
	}

	return &FileInfo{
		Path:      fpath,
		Delimiter: delimiter,
		Format:    format,
		Encoding:  encoding,
		ViewType:  ViewTypeFile,
	}, nil
}

func CreateFilePath(filename parser.Identifier, repository string) (string, error) {
	fpath := filename.Literal
	if !filepath.IsAbs(fpath) {
		if len(repository) < 1 {
			repository, _ = os.Getwd()
		}
		fpath = filepath.Join(repository, fpath)
	}
	return filepath.Abs(fpath)
}
