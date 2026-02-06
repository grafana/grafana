//go:build !windows
// +build !windows

package manager

func defaultDownloadBufferProvider() WriterReadFromProvider {
	return nil
}
