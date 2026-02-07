//go:build !linux && !darwin && !freebsd && !netbsd

package archive

func lgetxattr(path string, attr string) ([]byte, error) {
	return nil, nil
}

func lsetxattr(path string, attr string, data []byte, flags int) error {
	return nil
}
