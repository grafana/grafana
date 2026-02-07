// Package archive provides helper functions for dealing with archive files.
package archive

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/bzip2"
	"compress/gzip"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/containerd/log"
	"github.com/docker/docker/pkg/idtools"
	"github.com/klauspost/compress/zstd"
	"github.com/moby/patternmatcher"
	"github.com/moby/sys/sequential"
)

// ImpliedDirectoryMode represents the mode (Unix permissions) applied to directories that are implied by files in a
// tar, but that do not have their own header entry.
//
// The permissions mask is stored in a constant instead of locally to ensure that magic numbers do not
// proliferate in the codebase. The default value 0755 has been selected based on the default umask of 0022, and
// a convention of mkdir(1) calling mkdir(2) with permissions of 0777, resulting in a final value of 0755.
//
// This value is currently implementation-defined, and not captured in any cross-runtime specification. Thus, it is
// subject to change in Moby at any time -- image authors who require consistent or known directory permissions
// should explicitly control them by ensuring that header entries exist for any applicable path.
const ImpliedDirectoryMode = 0o755

type (
	// Compression is the state represents if compressed or not.
	Compression int
	// WhiteoutFormat is the format of whiteouts unpacked
	WhiteoutFormat int

	// TarOptions wraps the tar options.
	TarOptions struct {
		IncludeFiles     []string
		ExcludePatterns  []string
		Compression      Compression
		NoLchown         bool
		IDMap            idtools.IdentityMapping
		ChownOpts        *idtools.Identity
		IncludeSourceDir bool
		// WhiteoutFormat is the expected on disk format for whiteout files.
		// This format will be converted to the standard format on pack
		// and from the standard format on unpack.
		WhiteoutFormat WhiteoutFormat
		// When unpacking, specifies whether overwriting a directory with a
		// non-directory is allowed and vice versa.
		NoOverwriteDirNonDir bool
		// For each include when creating an archive, the included name will be
		// replaced with the matching name from this map.
		RebaseNames map[string]string
		InUserNS    bool
		// Allow unpacking to succeed in spite of failures to set extended
		// attributes on the unpacked files due to the destination filesystem
		// not supporting them or a lack of permissions. Extended attributes
		// were probably in the archive for a reason, so set this option at
		// your own peril.
		BestEffortXattrs bool
	}
)

// Archiver implements the Archiver interface and allows the reuse of most utility functions of
// this package with a pluggable Untar function. Also, to facilitate the passing of specific id
// mappings for untar, an Archiver can be created with maps which will then be passed to Untar operations.
type Archiver struct {
	Untar     func(io.Reader, string, *TarOptions) error
	IDMapping idtools.IdentityMapping
}

// NewDefaultArchiver returns a new Archiver without any IdentityMapping
func NewDefaultArchiver() *Archiver {
	return &Archiver{Untar: Untar}
}

// breakoutError is used to differentiate errors related to breaking out
// When testing archive breakout in the unit tests, this error is expected
// in order for the test to pass.
type breakoutError error

const (
	Uncompressed Compression = 0 // Uncompressed represents the uncompressed.
	Bzip2        Compression = 1 // Bzip2 is bzip2 compression algorithm.
	Gzip         Compression = 2 // Gzip is gzip compression algorithm.
	Xz           Compression = 3 // Xz is xz compression algorithm.
	Zstd         Compression = 4 // Zstd is zstd compression algorithm.
)

const (
	AUFSWhiteoutFormat    WhiteoutFormat = 0 // AUFSWhiteoutFormat is the default format for whiteouts
	OverlayWhiteoutFormat WhiteoutFormat = 1 // OverlayWhiteoutFormat formats whiteout according to the overlay standard.
)

// IsArchivePath checks if the (possibly compressed) file at the given path
// starts with a tar file header.
func IsArchivePath(path string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	rdr, err := DecompressStream(file)
	if err != nil {
		return false
	}
	defer rdr.Close()
	r := tar.NewReader(rdr)
	_, err = r.Next()
	return err == nil
}

const (
	zstdMagicSkippableStart = 0x184D2A50
	zstdMagicSkippableMask  = 0xFFFFFFF0
)

var (
	bzip2Magic = []byte{0x42, 0x5A, 0x68}
	gzipMagic  = []byte{0x1F, 0x8B, 0x08}
	xzMagic    = []byte{0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00}
	zstdMagic  = []byte{0x28, 0xb5, 0x2f, 0xfd}
)

type matcher = func([]byte) bool

func magicNumberMatcher(m []byte) matcher {
	return func(source []byte) bool {
		return bytes.HasPrefix(source, m)
	}
}

// zstdMatcher detects zstd compression algorithm.
// Zstandard compressed data is made of one or more frames.
// There are two frame formats defined by Zstandard: Zstandard frames and Skippable frames.
// See https://datatracker.ietf.org/doc/html/rfc8878#section-3 for more details.
func zstdMatcher() matcher {
	return func(source []byte) bool {
		if bytes.HasPrefix(source, zstdMagic) {
			// Zstandard frame
			return true
		}
		// skippable frame
		if len(source) < 8 {
			return false
		}
		// magic number from 0x184D2A50 to 0x184D2A5F.
		if binary.LittleEndian.Uint32(source[:4])&zstdMagicSkippableMask == zstdMagicSkippableStart {
			return true
		}
		return false
	}
}

// DetectCompression detects the compression algorithm of the source.
func DetectCompression(source []byte) Compression {
	compressionMap := map[Compression]matcher{
		Bzip2: magicNumberMatcher(bzip2Magic),
		Gzip:  magicNumberMatcher(gzipMagic),
		Xz:    magicNumberMatcher(xzMagic),
		Zstd:  zstdMatcher(),
	}
	for _, compression := range []Compression{Bzip2, Gzip, Xz, Zstd} {
		fn := compressionMap[compression]
		if fn(source) {
			return compression
		}
	}
	return Uncompressed
}

func xzDecompress(ctx context.Context, archive io.Reader) (io.ReadCloser, error) {
	args := []string{"xz", "-d", "-c", "-q"}

	return cmdStream(exec.CommandContext(ctx, args[0], args[1:]...), archive)
}

func gzDecompress(ctx context.Context, buf io.Reader) (io.ReadCloser, error) {
	if noPigzEnv := os.Getenv("MOBY_DISABLE_PIGZ"); noPigzEnv != "" {
		noPigz, err := strconv.ParseBool(noPigzEnv)
		if err != nil {
			log.G(ctx).WithError(err).Warn("invalid value in MOBY_DISABLE_PIGZ env var")
		}
		if noPigz {
			log.G(ctx).Debugf("Use of pigz is disabled due to MOBY_DISABLE_PIGZ=%s", noPigzEnv)
			return gzip.NewReader(buf)
		}
	}

	unpigzPath, err := exec.LookPath("unpigz")
	if err != nil {
		log.G(ctx).Debugf("unpigz binary not found, falling back to go gzip library")
		return gzip.NewReader(buf)
	}

	log.G(ctx).Debugf("Using %s to decompress", unpigzPath)

	return cmdStream(exec.CommandContext(ctx, unpigzPath, "-d", "-c"), buf)
}

type readCloserWrapper struct {
	io.Reader
	closer func() error
	closed atomic.Bool
}

func (r *readCloserWrapper) Close() error {
	if !r.closed.CompareAndSwap(false, true) {
		log.G(context.TODO()).Error("subsequent attempt to close readCloserWrapper")
		if log.GetLevel() >= log.DebugLevel {
			log.G(context.TODO()).Errorf("stack trace: %s", string(debug.Stack()))
		}

		return nil
	}
	if r.closer != nil {
		return r.closer()
	}
	return nil
}

var (
	bufioReader32KPool = &sync.Pool{
		New: func() interface{} { return bufio.NewReaderSize(nil, 32*1024) },
	}
)

type bufferedReader struct {
	buf *bufio.Reader
}

func newBufferedReader(r io.Reader) *bufferedReader {
	buf := bufioReader32KPool.Get().(*bufio.Reader)
	buf.Reset(r)
	return &bufferedReader{buf}
}

func (r *bufferedReader) Read(p []byte) (n int, err error) {
	if r.buf == nil {
		return 0, io.EOF
	}
	n, err = r.buf.Read(p)
	if err == io.EOF {
		r.buf.Reset(nil)
		bufioReader32KPool.Put(r.buf)
		r.buf = nil
	}
	return
}

func (r *bufferedReader) Peek(n int) ([]byte, error) {
	if r.buf == nil {
		return nil, io.EOF
	}
	return r.buf.Peek(n)
}

// DecompressStream decompresses the archive and returns a ReaderCloser with the decompressed archive.
func DecompressStream(archive io.Reader) (io.ReadCloser, error) {
	buf := newBufferedReader(archive)
	bs, err := buf.Peek(10)
	if err != nil && err != io.EOF {
		// Note: we'll ignore any io.EOF error because there are some odd
		// cases where the layer.tar file will be empty (zero bytes) and
		// that results in an io.EOF from the Peek() call. So, in those
		// cases we'll just treat it as a non-compressed stream and
		// that means just create an empty layer.
		// See Issue 18170
		return nil, err
	}

	compression := DetectCompression(bs)
	switch compression {
	case Uncompressed:
		return &readCloserWrapper{
			Reader: buf,
		}, nil
	case Gzip:
		ctx, cancel := context.WithCancel(context.Background())

		gzReader, err := gzDecompress(ctx, buf)
		if err != nil {
			cancel()
			return nil, err
		}
		return &readCloserWrapper{
			Reader: gzReader,
			closer: func() error {
				cancel()
				return gzReader.Close()
			},
		}, nil
	case Bzip2:
		bz2Reader := bzip2.NewReader(buf)
		return &readCloserWrapper{
			Reader: bz2Reader,
		}, nil
	case Xz:
		ctx, cancel := context.WithCancel(context.Background())

		xzReader, err := xzDecompress(ctx, buf)
		if err != nil {
			cancel()
			return nil, err
		}

		return &readCloserWrapper{
			Reader: xzReader,
			closer: func() error {
				cancel()
				return xzReader.Close()
			},
		}, nil
	case Zstd:
		zstdReader, err := zstd.NewReader(buf)
		if err != nil {
			return nil, err
		}
		return &readCloserWrapper{
			Reader: zstdReader,
			closer: func() error {
				zstdReader.Close()
				return nil
			},
		}, nil
	default:
		return nil, fmt.Errorf("Unsupported compression format %s", (&compression).Extension())
	}
}

type nopWriteCloser struct {
	io.Writer
}

func (nopWriteCloser) Close() error { return nil }

// CompressStream compresses the dest with specified compression algorithm.
func CompressStream(dest io.Writer, compression Compression) (io.WriteCloser, error) {
	switch compression {
	case Uncompressed:
		return nopWriteCloser{dest}, nil
	case Gzip:
		return gzip.NewWriter(dest), nil
	case Bzip2, Xz:
		// archive/bzip2 does not support writing, and there is no xz support at all
		// However, this is not a problem as docker only currently generates gzipped tars
		return nil, fmt.Errorf("Unsupported compression format %s", (&compression).Extension())
	default:
		return nil, fmt.Errorf("Unsupported compression format %s", (&compression).Extension())
	}
}

// TarModifierFunc is a function that can be passed to ReplaceFileTarWrapper to
// modify the contents or header of an entry in the archive. If the file already
// exists in the archive the TarModifierFunc will be called with the Header and
// a reader which will return the files content. If the file does not exist both
// header and content will be nil.
type TarModifierFunc func(path string, header *tar.Header, content io.Reader) (*tar.Header, []byte, error)

// ReplaceFileTarWrapper converts inputTarStream to a new tar stream. Files in the
// tar stream are modified if they match any of the keys in mods.
func ReplaceFileTarWrapper(inputTarStream io.ReadCloser, mods map[string]TarModifierFunc) io.ReadCloser {
	pipeReader, pipeWriter := io.Pipe()

	go func() {
		tarReader := tar.NewReader(inputTarStream)
		tarWriter := tar.NewWriter(pipeWriter)
		defer inputTarStream.Close()
		defer tarWriter.Close()

		modify := func(name string, original *tar.Header, modifier TarModifierFunc, tarReader io.Reader) error {
			header, data, err := modifier(name, original, tarReader)
			switch {
			case err != nil:
				return err
			case header == nil:
				return nil
			}

			if header.Name == "" {
				header.Name = name
			}
			header.Size = int64(len(data))
			if err := tarWriter.WriteHeader(header); err != nil {
				return err
			}
			if len(data) != 0 {
				if _, err := tarWriter.Write(data); err != nil {
					return err
				}
			}
			return nil
		}

		var err error
		var originalHeader *tar.Header
		for {
			originalHeader, err = tarReader.Next()
			if err == io.EOF {
				break
			}
			if err != nil {
				pipeWriter.CloseWithError(err)
				return
			}

			modifier, ok := mods[originalHeader.Name]
			if !ok {
				// No modifiers for this file, copy the header and data
				if err := tarWriter.WriteHeader(originalHeader); err != nil {
					pipeWriter.CloseWithError(err)
					return
				}
				if _, err := copyWithBuffer(tarWriter, tarReader); err != nil {
					pipeWriter.CloseWithError(err)
					return
				}
				continue
			}
			delete(mods, originalHeader.Name)

			if err := modify(originalHeader.Name, originalHeader, modifier, tarReader); err != nil {
				pipeWriter.CloseWithError(err)
				return
			}
		}

		// Apply the modifiers that haven't matched any files in the archive
		for name, modifier := range mods {
			if err := modify(name, nil, modifier, nil); err != nil {
				pipeWriter.CloseWithError(err)
				return
			}
		}

		pipeWriter.Close()
	}()
	return pipeReader
}

// Extension returns the extension of a file that uses the specified compression algorithm.
func (compression *Compression) Extension() string {
	switch *compression {
	case Uncompressed:
		return "tar"
	case Bzip2:
		return "tar.bz2"
	case Gzip:
		return "tar.gz"
	case Xz:
		return "tar.xz"
	case Zstd:
		return "tar.zst"
	}
	return ""
}

// assert that we implement [tar.FileInfoNames].
//
// TODO(thaJeztah): disabled to allow compiling on < go1.23. un-comment once we drop support for older versions of go.
// var _ tar.FileInfoNames = (*nosysFileInfo)(nil)

// nosysFileInfo hides the system-dependent info of the wrapped FileInfo to
// prevent tar.FileInfoHeader from introspecting it and potentially calling into
// glibc.
//
// It implements [tar.FileInfoNames] to further prevent [tar.FileInfoHeader]
// from performing any lookups on go1.23 and up. see https://go.dev/issue/50102
type nosysFileInfo struct {
	os.FileInfo
}

// Uname stubs out looking up username. It implements [tar.FileInfoNames]
// to prevent [tar.FileInfoHeader] from loading libraries to perform
// username lookups.
func (fi nosysFileInfo) Uname() (string, error) {
	return "", nil
}

// Gname stubs out looking up group-name. It implements [tar.FileInfoNames]
// to prevent [tar.FileInfoHeader] from loading libraries to perform
// username lookups.
func (fi nosysFileInfo) Gname() (string, error) {
	return "", nil
}

func (fi nosysFileInfo) Sys() interface{} {
	// A Sys value of type *tar.Header is safe as it is system-independent.
	// The tar.FileInfoHeader function copies the fields into the returned
	// header without performing any OS lookups.
	if sys, ok := fi.FileInfo.Sys().(*tar.Header); ok {
		return sys
	}
	return nil
}

// sysStat, if non-nil, populates hdr from system-dependent fields of fi.
var sysStat func(fi os.FileInfo, hdr *tar.Header) error

// FileInfoHeaderNoLookups creates a partially-populated tar.Header from fi.
//
// Compared to the archive/tar.FileInfoHeader function, this function is safe to
// call from a chrooted process as it does not populate fields which would
// require operating system lookups. It behaves identically to
// tar.FileInfoHeader when fi is a FileInfo value returned from
// tar.Header.FileInfo().
//
// When fi is a FileInfo for a native file, such as returned from os.Stat() and
// os.Lstat(), the returned Header value differs from one returned from
// tar.FileInfoHeader in the following ways. The Uname and Gname fields are not
// set as OS lookups would be required to populate them. The AccessTime and
// ChangeTime fields are not currently set (not yet implemented) although that
// is subject to change. Callers which require the AccessTime or ChangeTime
// fields to be zeroed should explicitly zero them out in the returned Header
// value to avoid any compatibility issues in the future.
func FileInfoHeaderNoLookups(fi os.FileInfo, link string) (*tar.Header, error) {
	hdr, err := tar.FileInfoHeader(nosysFileInfo{fi}, link)
	if err != nil {
		return nil, err
	}
	if sysStat != nil {
		return hdr, sysStat(fi, hdr)
	}
	return hdr, nil
}

// FileInfoHeader creates a populated Header from fi.
//
// Compared to the archive/tar package, this function fills in less information
// but is safe to call from a chrooted process. The AccessTime and ChangeTime
// fields are not set in the returned header, ModTime is truncated to one-second
// precision, and the Uname and Gname fields are only set when fi is a FileInfo
// value returned from tar.Header.FileInfo().
func FileInfoHeader(name string, fi os.FileInfo, link string) (*tar.Header, error) {
	hdr, err := FileInfoHeaderNoLookups(fi, link)
	if err != nil {
		return nil, err
	}
	hdr.Format = tar.FormatPAX
	hdr.ModTime = hdr.ModTime.Truncate(time.Second)
	hdr.AccessTime = time.Time{}
	hdr.ChangeTime = time.Time{}
	hdr.Mode = int64(chmodTarEntry(os.FileMode(hdr.Mode)))
	hdr.Name = canonicalTarName(name, fi.IsDir())
	return hdr, nil
}

const paxSchilyXattr = "SCHILY.xattr."

// ReadSecurityXattrToTarHeader reads security.capability xattr from filesystem
// to a tar header
func ReadSecurityXattrToTarHeader(path string, hdr *tar.Header) error {
	const (
		// Values based on linux/include/uapi/linux/capability.h
		xattrCapsSz2    = 20
		versionOffset   = 3
		vfsCapRevision2 = 2
		vfsCapRevision3 = 3
	)
	capability, _ := lgetxattr(path, "security.capability")
	if capability != nil {
		if capability[versionOffset] == vfsCapRevision3 {
			// Convert VFS_CAP_REVISION_3 to VFS_CAP_REVISION_2 as root UID makes no
			// sense outside the user namespace the archive is built in.
			capability[versionOffset] = vfsCapRevision2
			capability = capability[:xattrCapsSz2]
		}
		if hdr.PAXRecords == nil {
			hdr.PAXRecords = make(map[string]string)
		}
		hdr.PAXRecords[paxSchilyXattr+"security.capability"] = string(capability)
	}
	return nil
}

type tarWhiteoutConverter interface {
	ConvertWrite(*tar.Header, string, os.FileInfo) (*tar.Header, error)
	ConvertRead(*tar.Header, string) (bool, error)
}

type tarAppender struct {
	TarWriter *tar.Writer

	// for hardlink mapping
	SeenFiles       map[uint64]string
	IdentityMapping idtools.IdentityMapping
	ChownOpts       *idtools.Identity

	// For packing and unpacking whiteout files in the
	// non standard format. The whiteout files defined
	// by the AUFS standard are used as the tar whiteout
	// standard.
	WhiteoutConverter tarWhiteoutConverter
}

func newTarAppender(idMapping idtools.IdentityMapping, writer io.Writer, chownOpts *idtools.Identity) *tarAppender {
	return &tarAppender{
		SeenFiles:       make(map[uint64]string),
		TarWriter:       tar.NewWriter(writer),
		IdentityMapping: idMapping,
		ChownOpts:       chownOpts,
	}
}

// canonicalTarName provides a platform-independent and consistent POSIX-style
// path for files and directories to be archived regardless of the platform.
func canonicalTarName(name string, isDir bool) string {
	name = filepath.ToSlash(name)

	// suffix with '/' for directories
	if isDir && !strings.HasSuffix(name, "/") {
		name += "/"
	}
	return name
}

// addTarFile adds to the tar archive a file from `path` as `name`
func (ta *tarAppender) addTarFile(path, name string) error {
	fi, err := os.Lstat(path)
	if err != nil {
		return err
	}

	var link string
	if fi.Mode()&os.ModeSymlink != 0 {
		var err error
		link, err = os.Readlink(path)
		if err != nil {
			return err
		}
	}

	hdr, err := FileInfoHeader(name, fi, link)
	if err != nil {
		return err
	}
	if err := ReadSecurityXattrToTarHeader(path, hdr); err != nil {
		return err
	}

	// if it's not a directory and has more than 1 link,
	// it's hard linked, so set the type flag accordingly
	if !fi.IsDir() && hasHardlinks(fi) {
		inode, err := getInodeFromStat(fi.Sys())
		if err != nil {
			return err
		}
		// a link should have a name that it links too
		// and that linked name should be first in the tar archive
		if oldpath, ok := ta.SeenFiles[inode]; ok {
			hdr.Typeflag = tar.TypeLink
			hdr.Linkname = oldpath
			hdr.Size = 0 // This Must be here for the writer math to add up!
		} else {
			ta.SeenFiles[inode] = name
		}
	}

	// check whether the file is overlayfs whiteout
	// if yes, skip re-mapping container ID mappings.
	isOverlayWhiteout := fi.Mode()&os.ModeCharDevice != 0 && hdr.Devmajor == 0 && hdr.Devminor == 0

	// handle re-mapping container ID mappings back to host ID mappings before
	// writing tar headers/files. We skip whiteout files because they were written
	// by the kernel and already have proper ownership relative to the host
	if !isOverlayWhiteout && !strings.HasPrefix(filepath.Base(hdr.Name), WhiteoutPrefix) && !ta.IdentityMapping.Empty() {
		fileIDPair, err := getFileUIDGID(fi.Sys())
		if err != nil {
			return err
		}
		hdr.Uid, hdr.Gid, err = ta.IdentityMapping.ToContainer(fileIDPair)
		if err != nil {
			return err
		}
	}

	// explicitly override with ChownOpts
	if ta.ChownOpts != nil {
		hdr.Uid = ta.ChownOpts.UID
		hdr.Gid = ta.ChownOpts.GID
	}

	if ta.WhiteoutConverter != nil {
		wo, err := ta.WhiteoutConverter.ConvertWrite(hdr, path, fi)
		if err != nil {
			return err
		}

		// If a new whiteout file exists, write original hdr, then
		// replace hdr with wo to be written after. Whiteouts should
		// always be written after the original. Note the original
		// hdr may have been updated to be a whiteout with returning
		// a whiteout header
		if wo != nil {
			if err := ta.TarWriter.WriteHeader(hdr); err != nil {
				return err
			}
			if hdr.Typeflag == tar.TypeReg && hdr.Size > 0 {
				return fmt.Errorf("tar: cannot use whiteout for non-empty file")
			}
			hdr = wo
		}
	}

	if err := ta.TarWriter.WriteHeader(hdr); err != nil {
		return err
	}

	if hdr.Typeflag == tar.TypeReg && hdr.Size > 0 {
		// We use sequential file access to avoid depleting the standby list on
		// Windows. On Linux, this equates to a regular os.Open.
		file, err := sequential.Open(path)
		if err != nil {
			return err
		}

		_, err = copyWithBuffer(ta.TarWriter, file)
		file.Close()
		if err != nil {
			return err
		}
	}

	return nil
}

func createTarFile(path, extractDir string, hdr *tar.Header, reader io.Reader, opts *TarOptions) error {
	var (
		Lchown                     = true
		inUserns, bestEffortXattrs bool
		chownOpts                  *idtools.Identity
	)

	// TODO(thaJeztah): make opts a required argument.
	if opts != nil {
		Lchown = !opts.NoLchown
		inUserns = opts.InUserNS // TODO(thaJeztah): consider deprecating opts.InUserNS and detect locally.
		chownOpts = opts.ChownOpts
		bestEffortXattrs = opts.BestEffortXattrs
	}

	// hdr.Mode is in linux format, which we can use for sycalls,
	// but for os.Foo() calls we need the mode converted to os.FileMode,
	// so use hdrInfo.Mode() (they differ for e.g. setuid bits)
	hdrInfo := hdr.FileInfo()

	switch hdr.Typeflag {
	case tar.TypeDir:
		// Create directory unless it exists as a directory already.
		// In that case we just want to merge the two
		if fi, err := os.Lstat(path); !(err == nil && fi.IsDir()) {
			if err := os.Mkdir(path, hdrInfo.Mode()); err != nil {
				return err
			}
		}

	case tar.TypeReg:
		// Source is regular file. We use sequential file access to avoid depleting
		// the standby list on Windows. On Linux, this equates to a regular os.OpenFile.
		file, err := sequential.OpenFile(path, os.O_CREATE|os.O_WRONLY, hdrInfo.Mode())
		if err != nil {
			return err
		}
		if _, err := copyWithBuffer(file, reader); err != nil {
			file.Close()
			return err
		}
		file.Close()

	case tar.TypeBlock, tar.TypeChar:
		if inUserns { // cannot create devices in a userns
			log.G(context.TODO()).WithFields(log.Fields{"path": path, "type": hdr.Typeflag}).Debug("skipping device nodes in a userns")
			return nil
		}
		// Handle this is an OS-specific way
		if err := handleTarTypeBlockCharFifo(hdr, path); err != nil {
			return err
		}

	case tar.TypeFifo:
		// Handle this is an OS-specific way
		if err := handleTarTypeBlockCharFifo(hdr, path); err != nil {
			if inUserns && errors.Is(err, syscall.EPERM) {
				// In most cases, cannot create a fifo if running in user namespace
				log.G(context.TODO()).WithFields(log.Fields{"error": err, "path": path, "type": hdr.Typeflag}).Debug("creating fifo node in a userns")
				return nil
			}
			return err
		}

	case tar.TypeLink:
		// #nosec G305 -- The target path is checked for path traversal.
		targetPath := filepath.Join(extractDir, hdr.Linkname)
		// check for hardlink breakout
		if !strings.HasPrefix(targetPath, extractDir) {
			return breakoutError(fmt.Errorf("invalid hardlink %q -> %q", targetPath, hdr.Linkname))
		}
		if err := os.Link(targetPath, path); err != nil {
			return err
		}

	case tar.TypeSymlink:
		// 	path 				-> hdr.Linkname = targetPath
		// e.g. /extractDir/path/to/symlink 	-> ../2/file	= /extractDir/path/2/file
		targetPath := filepath.Join(filepath.Dir(path), hdr.Linkname) // #nosec G305 -- The target path is checked for path traversal.

		// the reason we don't need to check symlinks in the path (with FollowSymlinkInScope) is because
		// that symlink would first have to be created, which would be caught earlier, at this very check:
		if !strings.HasPrefix(targetPath, extractDir) {
			return breakoutError(fmt.Errorf("invalid symlink %q -> %q", path, hdr.Linkname))
		}
		if err := os.Symlink(hdr.Linkname, path); err != nil {
			return err
		}

	case tar.TypeXGlobalHeader:
		log.G(context.TODO()).Debug("PAX Global Extended Headers found and ignored")
		return nil

	default:
		return fmt.Errorf("unhandled tar header type %d", hdr.Typeflag)
	}

	// Lchown is not supported on Windows.
	if Lchown && runtime.GOOS != "windows" {
		if chownOpts == nil {
			chownOpts = &idtools.Identity{UID: hdr.Uid, GID: hdr.Gid}
		}
		if err := os.Lchown(path, chownOpts.UID, chownOpts.GID); err != nil {
			var msg string
			if inUserns && errors.Is(err, syscall.EINVAL) {
				msg = " (try increasing the number of subordinate IDs in /etc/subuid and /etc/subgid)"
			}
			return fmt.Errorf("failed to Lchown %q for UID %d, GID %d%s: %w", path, hdr.Uid, hdr.Gid, msg, err)
		}
	}

	var xattrErrs []string
	for key, value := range hdr.PAXRecords {
		xattr, ok := strings.CutPrefix(key, paxSchilyXattr)
		if !ok {
			continue
		}
		if err := lsetxattr(path, xattr, []byte(value), 0); err != nil {
			if bestEffortXattrs && errors.Is(err, syscall.ENOTSUP) || errors.Is(err, syscall.EPERM) {
				// EPERM occurs if modifying xattrs is not allowed. This can
				// happen when running in userns with restrictions (ChromeOS).
				xattrErrs = append(xattrErrs, err.Error())
				continue
			}
			return err
		}
	}

	if len(xattrErrs) > 0 {
		log.G(context.TODO()).WithFields(log.Fields{
			"errors": xattrErrs,
		}).Warn("ignored xattrs in archive: underlying filesystem doesn't support them")
	}

	// There is no LChmod, so ignore mode for symlink. Also, this
	// must happen after chown, as that can modify the file mode
	if err := handleLChmod(hdr, path, hdrInfo); err != nil {
		return err
	}

	aTime := boundTime(latestTime(hdr.AccessTime, hdr.ModTime))
	mTime := boundTime(hdr.ModTime)

	// chtimes doesn't support a NOFOLLOW flag atm
	if hdr.Typeflag == tar.TypeLink {
		if fi, err := os.Lstat(hdr.Linkname); err == nil && (fi.Mode()&os.ModeSymlink == 0) {
			if err := chtimes(path, aTime, mTime); err != nil {
				return err
			}
		}
	} else if hdr.Typeflag != tar.TypeSymlink {
		if err := chtimes(path, aTime, mTime); err != nil {
			return err
		}
	} else {
		if err := lchtimes(path, aTime, mTime); err != nil {
			return err
		}
	}
	return nil
}

// Tar creates an archive from the directory at `path`, and returns it as a
// stream of bytes.
func Tar(path string, compression Compression) (io.ReadCloser, error) {
	return TarWithOptions(path, &TarOptions{Compression: compression})
}

// TarWithOptions creates an archive from the directory at `path`, only including files whose relative
// paths are included in `options.IncludeFiles` (if non-nil) or not in `options.ExcludePatterns`.
func TarWithOptions(srcPath string, options *TarOptions) (io.ReadCloser, error) {
	tb, err := NewTarballer(srcPath, options)
	if err != nil {
		return nil, err
	}
	go tb.Do()
	return tb.Reader(), nil
}

// Tarballer is a lower-level interface to TarWithOptions which gives the caller
// control over which goroutine the archiving operation executes on.
type Tarballer struct {
	srcPath           string
	options           *TarOptions
	pm                *patternmatcher.PatternMatcher
	pipeReader        *io.PipeReader
	pipeWriter        *io.PipeWriter
	compressWriter    io.WriteCloser
	whiteoutConverter tarWhiteoutConverter
}

// NewTarballer constructs a new tarballer. The arguments are the same as for
// TarWithOptions.
func NewTarballer(srcPath string, options *TarOptions) (*Tarballer, error) {
	pm, err := patternmatcher.New(options.ExcludePatterns)
	if err != nil {
		return nil, err
	}

	pipeReader, pipeWriter := io.Pipe()

	compressWriter, err := CompressStream(pipeWriter, options.Compression)
	if err != nil {
		return nil, err
	}

	return &Tarballer{
		// Fix the source path to work with long path names. This is a no-op
		// on platforms other than Windows.
		srcPath:           addLongPathPrefix(srcPath),
		options:           options,
		pm:                pm,
		pipeReader:        pipeReader,
		pipeWriter:        pipeWriter,
		compressWriter:    compressWriter,
		whiteoutConverter: getWhiteoutConverter(options.WhiteoutFormat),
	}, nil
}

// Reader returns the reader for the created archive.
func (t *Tarballer) Reader() io.ReadCloser {
	return t.pipeReader
}

// Do performs the archiving operation in the background. The resulting archive
// can be read from t.Reader(). Do should only be called once on each Tarballer
// instance.
func (t *Tarballer) Do() {
	ta := newTarAppender(
		t.options.IDMap,
		t.compressWriter,
		t.options.ChownOpts,
	)
	ta.WhiteoutConverter = t.whiteoutConverter

	defer func() {
		// Make sure to check the error on Close.
		if err := ta.TarWriter.Close(); err != nil {
			log.G(context.TODO()).Errorf("Can't close tar writer: %s", err)
		}
		if err := t.compressWriter.Close(); err != nil {
			log.G(context.TODO()).Errorf("Can't close compress writer: %s", err)
		}
		if err := t.pipeWriter.Close(); err != nil {
			log.G(context.TODO()).Errorf("Can't close pipe writer: %s", err)
		}
	}()

	// In general we log errors here but ignore them because
	// during e.g. a diff operation the container can continue
	// mutating the filesystem and we can see transient errors
	// from this

	stat, err := os.Lstat(t.srcPath)
	if err != nil {
		return
	}

	if !stat.IsDir() {
		// We can't later join a non-dir with any includes because the
		// 'walk' will error if "file/." is stat-ed and "file" is not a
		// directory. So, we must split the source path and use the
		// basename as the include.
		if len(t.options.IncludeFiles) > 0 {
			log.G(context.TODO()).Warn("Tar: Can't archive a file with includes")
		}

		dir, base := SplitPathDirEntry(t.srcPath)
		t.srcPath = dir
		t.options.IncludeFiles = []string{base}
	}

	if len(t.options.IncludeFiles) == 0 {
		t.options.IncludeFiles = []string{"."}
	}

	seen := make(map[string]bool)

	for _, include := range t.options.IncludeFiles {
		rebaseName := t.options.RebaseNames[include]

		var (
			parentMatchInfo []patternmatcher.MatchInfo
			parentDirs      []string
		)

		walkRoot := getWalkRoot(t.srcPath, include)
		filepath.WalkDir(walkRoot, func(filePath string, f os.DirEntry, err error) error {
			if err != nil {
				log.G(context.TODO()).Errorf("Tar: Can't stat file %s to tar: %s", t.srcPath, err)
				return nil
			}

			relFilePath, err := filepath.Rel(t.srcPath, filePath)
			if err != nil || (!t.options.IncludeSourceDir && relFilePath == "." && f.IsDir()) {
				// Error getting relative path OR we are looking
				// at the source directory path. Skip in both situations.
				return nil
			}

			if t.options.IncludeSourceDir && include == "." && relFilePath != "." {
				relFilePath = strings.Join([]string{".", relFilePath}, string(filepath.Separator))
			}

			skip := false

			// If "include" is an exact match for the current file
			// then even if there's an "excludePatterns" pattern that
			// matches it, don't skip it. IOW, assume an explicit 'include'
			// is asking for that file no matter what - which is true
			// for some files, like .dockerignore and Dockerfile (sometimes)
			if include != relFilePath {
				for len(parentDirs) != 0 {
					lastParentDir := parentDirs[len(parentDirs)-1]
					if strings.HasPrefix(relFilePath, lastParentDir+string(os.PathSeparator)) {
						break
					}
					parentDirs = parentDirs[:len(parentDirs)-1]
					parentMatchInfo = parentMatchInfo[:len(parentMatchInfo)-1]
				}

				var matchInfo patternmatcher.MatchInfo
				if len(parentMatchInfo) != 0 {
					skip, matchInfo, err = t.pm.MatchesUsingParentResults(relFilePath, parentMatchInfo[len(parentMatchInfo)-1])
				} else {
					skip, matchInfo, err = t.pm.MatchesUsingParentResults(relFilePath, patternmatcher.MatchInfo{})
				}
				if err != nil {
					log.G(context.TODO()).Errorf("Error matching %s: %v", relFilePath, err)
					return err
				}

				if f.IsDir() {
					parentDirs = append(parentDirs, relFilePath)
					parentMatchInfo = append(parentMatchInfo, matchInfo)
				}
			}

			if skip {
				// If we want to skip this file and its a directory
				// then we should first check to see if there's an
				// excludes pattern (e.g. !dir/file) that starts with this
				// dir. If so then we can't skip this dir.

				// Its not a dir then so we can just return/skip.
				if !f.IsDir() {
					return nil
				}

				// No exceptions (!...) in patterns so just skip dir
				if !t.pm.Exclusions() {
					return filepath.SkipDir
				}

				dirSlash := relFilePath + string(filepath.Separator)

				for _, pat := range t.pm.Patterns() {
					if !pat.Exclusion() {
						continue
					}
					if strings.HasPrefix(pat.String()+string(filepath.Separator), dirSlash) {
						// found a match - so can't skip this dir
						return nil
					}
				}

				// No matching exclusion dir so just skip dir
				return filepath.SkipDir
			}

			if seen[relFilePath] {
				return nil
			}
			seen[relFilePath] = true

			// Rename the base resource.
			if rebaseName != "" {
				var replacement string
				if rebaseName != string(filepath.Separator) {
					// Special case the root directory to replace with an
					// empty string instead so that we don't end up with
					// double slashes in the paths.
					replacement = rebaseName
				}

				relFilePath = strings.Replace(relFilePath, include, replacement, 1)
			}

			if err := ta.addTarFile(filePath, relFilePath); err != nil {
				log.G(context.TODO()).Errorf("Can't add file %s to tar: %s", filePath, err)
				// if pipe is broken, stop writing tar stream to it
				if err == io.ErrClosedPipe {
					return err
				}
			}
			return nil
		})
	}
}

// Unpack unpacks the decompressedArchive to dest with options.
func Unpack(decompressedArchive io.Reader, dest string, options *TarOptions) error {
	tr := tar.NewReader(decompressedArchive)

	var dirs []*tar.Header
	whiteoutConverter := getWhiteoutConverter(options.WhiteoutFormat)

	// Iterate through the files in the archive.
loop:
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			// end of tar archive
			break
		}
		if err != nil {
			return err
		}

		// ignore XGlobalHeader early to avoid creating parent directories for them
		if hdr.Typeflag == tar.TypeXGlobalHeader {
			log.G(context.TODO()).Debugf("PAX Global Extended Headers found for %s and ignored", hdr.Name)
			continue
		}

		// Normalize name, for safety and for a simple is-root check
		// This keeps "../" as-is, but normalizes "/../" to "/". Or Windows:
		// This keeps "..\" as-is, but normalizes "\..\" to "\".
		hdr.Name = filepath.Clean(hdr.Name)

		for _, exclude := range options.ExcludePatterns {
			if strings.HasPrefix(hdr.Name, exclude) {
				continue loop
			}
		}

		// Ensure that the parent directory exists.
		err = createImpliedDirectories(dest, hdr, options)
		if err != nil {
			return err
		}

		// #nosec G305 -- The joined path is checked for path traversal.
		path := filepath.Join(dest, hdr.Name)
		rel, err := filepath.Rel(dest, path)
		if err != nil {
			return err
		}
		if strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
			return breakoutError(fmt.Errorf("%q is outside of %q", hdr.Name, dest))
		}

		// If path exits we almost always just want to remove and replace it
		// The only exception is when it is a directory *and* the file from
		// the layer is also a directory. Then we want to merge them (i.e.
		// just apply the metadata from the layer).
		if fi, err := os.Lstat(path); err == nil {
			if options.NoOverwriteDirNonDir && fi.IsDir() && hdr.Typeflag != tar.TypeDir {
				// If NoOverwriteDirNonDir is true then we cannot replace
				// an existing directory with a non-directory from the archive.
				return fmt.Errorf("cannot overwrite directory %q with non-directory %q", path, dest)
			}

			if options.NoOverwriteDirNonDir && !fi.IsDir() && hdr.Typeflag == tar.TypeDir {
				// If NoOverwriteDirNonDir is true then we cannot replace
				// an existing non-directory with a directory from the archive.
				return fmt.Errorf("cannot overwrite non-directory %q with directory %q", path, dest)
			}

			if fi.IsDir() && hdr.Name == "." {
				continue
			}

			if !(fi.IsDir() && hdr.Typeflag == tar.TypeDir) {
				if err := os.RemoveAll(path); err != nil {
					return err
				}
			}
		}

		if err := remapIDs(options.IDMap, hdr); err != nil {
			return err
		}

		if whiteoutConverter != nil {
			writeFile, err := whiteoutConverter.ConvertRead(hdr, path)
			if err != nil {
				return err
			}
			if !writeFile {
				continue
			}
		}

		if err := createTarFile(path, dest, hdr, tr, options); err != nil {
			return err
		}

		// Directory mtimes must be handled at the end to avoid further
		// file creation in them to modify the directory mtime
		if hdr.Typeflag == tar.TypeDir {
			dirs = append(dirs, hdr)
		}
	}

	for _, hdr := range dirs {
		// #nosec G305 -- The header was checked for path traversal before it was appended to the dirs slice.
		path := filepath.Join(dest, hdr.Name)

		if err := chtimes(path, boundTime(latestTime(hdr.AccessTime, hdr.ModTime)), boundTime(hdr.ModTime)); err != nil {
			return err
		}
	}
	return nil
}

// createImpliedDirectories will create all parent directories of the current path with default permissions, if they do
// not already exist. This is possible as the tar format supports 'implicit' directories, where their existence is
// defined by the paths of files in the tar, but there are no header entries for the directories themselves, and thus
// we most both create them and choose metadata like permissions.
//
// The caller should have performed filepath.Clean(hdr.Name), so hdr.Name will now be in the filepath format for the OS
// on which the daemon is running. This precondition is required because this function assumes a OS-specific path
// separator when checking that a path is not the root.
func createImpliedDirectories(dest string, hdr *tar.Header, options *TarOptions) error {
	// Not the root directory, ensure that the parent directory exists
	if !strings.HasSuffix(hdr.Name, string(os.PathSeparator)) {
		parent := filepath.Dir(hdr.Name)
		parentPath := filepath.Join(dest, parent)
		if _, err := os.Lstat(parentPath); err != nil && os.IsNotExist(err) {
			// RootPair() is confined inside this loop as most cases will not require a call, so we can spend some
			// unneeded function calls in the uncommon case to encapsulate logic -- implied directories are a niche
			// usage that reduces the portability of an image.
			rootIDs := options.IDMap.RootPair()

			err = idtools.MkdirAllAndChownNew(parentPath, ImpliedDirectoryMode, rootIDs)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

// Untar reads a stream of bytes from `archive`, parses it as a tar archive,
// and unpacks it into the directory at `dest`.
// The archive may be compressed with one of the following algorithms:
// identity (uncompressed), gzip, bzip2, xz.
//
// FIXME: specify behavior when target path exists vs. doesn't exist.
func Untar(tarArchive io.Reader, dest string, options *TarOptions) error {
	return untarHandler(tarArchive, dest, options, true)
}

// UntarUncompressed reads a stream of bytes from `archive`, parses it as a tar archive,
// and unpacks it into the directory at `dest`.
// The archive must be an uncompressed stream.
func UntarUncompressed(tarArchive io.Reader, dest string, options *TarOptions) error {
	return untarHandler(tarArchive, dest, options, false)
}

// Handler for teasing out the automatic decompression
func untarHandler(tarArchive io.Reader, dest string, options *TarOptions, decompress bool) error {
	if tarArchive == nil {
		return fmt.Errorf("Empty archive")
	}
	dest = filepath.Clean(dest)
	if options == nil {
		options = &TarOptions{}
	}
	if options.ExcludePatterns == nil {
		options.ExcludePatterns = []string{}
	}

	r := tarArchive
	if decompress {
		decompressedArchive, err := DecompressStream(tarArchive)
		if err != nil {
			return err
		}
		defer decompressedArchive.Close()
		r = decompressedArchive
	}

	return Unpack(r, dest, options)
}

// TarUntar is a convenience function which calls Tar and Untar, with the output of one piped into the other.
// If either Tar or Untar fails, TarUntar aborts and returns the error.
func (archiver *Archiver) TarUntar(src, dst string) error {
	archive, err := TarWithOptions(src, &TarOptions{Compression: Uncompressed})
	if err != nil {
		return err
	}
	defer archive.Close()
	options := &TarOptions{
		IDMap: archiver.IDMapping,
	}
	return archiver.Untar(archive, dst, options)
}

// UntarPath untar a file from path to a destination, src is the source tar file path.
func (archiver *Archiver) UntarPath(src, dst string) error {
	archive, err := os.Open(src)
	if err != nil {
		return err
	}
	defer archive.Close()
	options := &TarOptions{
		IDMap: archiver.IDMapping,
	}
	return archiver.Untar(archive, dst, options)
}

// CopyWithTar creates a tar archive of filesystem path `src`, and
// unpacks it at filesystem path `dst`.
// The archive is streamed directly with fixed buffering and no
// intermediary disk IO.
func (archiver *Archiver) CopyWithTar(src, dst string) error {
	srcSt, err := os.Stat(src)
	if err != nil {
		return err
	}
	if !srcSt.IsDir() {
		return archiver.CopyFileWithTar(src, dst)
	}

	// if this Archiver is set up with ID mapping we need to create
	// the new destination directory with the remapped root UID/GID pair
	// as owner
	rootIDs := archiver.IDMapping.RootPair()
	// Create dst, copy src's content into it
	if err := idtools.MkdirAllAndChownNew(dst, 0o755, rootIDs); err != nil {
		return err
	}
	return archiver.TarUntar(src, dst)
}

// CopyFileWithTar emulates the behavior of the 'cp' command-line
// for a single file. It copies a regular file from path `src` to
// path `dst`, and preserves all its metadata.
func (archiver *Archiver) CopyFileWithTar(src, dst string) (err error) {
	srcSt, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcSt.IsDir() {
		return fmt.Errorf("Can't copy a directory")
	}

	// Clean up the trailing slash. This must be done in an operating
	// system specific manner.
	if dst[len(dst)-1] == os.PathSeparator {
		dst = filepath.Join(dst, filepath.Base(src))
	}
	// Create the holding directory if necessary
	if err := os.MkdirAll(filepath.Dir(dst), 0o700); err != nil {
		return err
	}

	r, w := io.Pipe()
	errC := make(chan error, 1)

	go func() {
		defer close(errC)

		errC <- func() error {
			defer w.Close()

			srcF, err := os.Open(src)
			if err != nil {
				return err
			}
			defer srcF.Close()

			hdr, err := FileInfoHeaderNoLookups(srcSt, "")
			if err != nil {
				return err
			}
			hdr.Format = tar.FormatPAX
			hdr.ModTime = hdr.ModTime.Truncate(time.Second)
			hdr.AccessTime = time.Time{}
			hdr.ChangeTime = time.Time{}
			hdr.Name = filepath.Base(dst)
			hdr.Mode = int64(chmodTarEntry(os.FileMode(hdr.Mode)))

			if err := remapIDs(archiver.IDMapping, hdr); err != nil {
				return err
			}

			tw := tar.NewWriter(w)
			defer tw.Close()
			if err := tw.WriteHeader(hdr); err != nil {
				return err
			}
			if _, err := copyWithBuffer(tw, srcF); err != nil {
				return err
			}
			return nil
		}()
	}()
	defer func() {
		if er := <-errC; err == nil && er != nil {
			err = er
		}
	}()

	err = archiver.Untar(r, filepath.Dir(dst), nil)
	if err != nil {
		r.CloseWithError(err)
	}
	return err
}

// IdentityMapping returns the IdentityMapping of the archiver.
func (archiver *Archiver) IdentityMapping() idtools.IdentityMapping {
	return archiver.IDMapping
}

func remapIDs(idMapping idtools.IdentityMapping, hdr *tar.Header) error {
	ids, err := idMapping.ToHost(idtools.Identity{UID: hdr.Uid, GID: hdr.Gid})
	hdr.Uid, hdr.Gid = ids.UID, ids.GID
	return err
}

// cmdStream executes a command, and returns its stdout as a stream.
// If the command fails to run or doesn't complete successfully, an error
// will be returned, including anything written on stderr.
func cmdStream(cmd *exec.Cmd, input io.Reader) (io.ReadCloser, error) {
	cmd.Stdin = input
	pipeR, pipeW := io.Pipe()
	cmd.Stdout = pipeW
	var errBuf bytes.Buffer
	cmd.Stderr = &errBuf

	// Run the command and return the pipe
	if err := cmd.Start(); err != nil {
		return nil, err
	}

	// Ensure the command has exited before we clean anything up
	done := make(chan struct{})

	// Copy stdout to the returned pipe
	go func() {
		if err := cmd.Wait(); err != nil {
			pipeW.CloseWithError(fmt.Errorf("%s: %s", err, errBuf.String()))
		} else {
			pipeW.Close()
		}
		close(done)
	}()

	return &readCloserWrapper{
		Reader: pipeR,
		closer: func() error {
			// Close pipeR, and then wait for the command to complete before returning. We have to close pipeR first, as
			// cmd.Wait waits for any non-file stdout/stderr/stdin to close.
			err := pipeR.Close()
			<-done
			return err
		},
	}, nil
}
