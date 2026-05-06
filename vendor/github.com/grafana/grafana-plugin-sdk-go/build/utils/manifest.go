package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func GenerateManifest() (string, error) {
	var manifest strings.Builder
	err := filepath.WalkDir(".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(path, ".go") {
			hash, err := hashFileContent(path)
			if err != nil {
				return err
			}
			// manifest = manifest + hash + ":" + path + "\n"
			manifest.WriteString(hash + ":" + filepath.ToSlash(path) + "\n")
		}
		return nil
	})

	return manifest.String(), err
}

// hashFileContent returns the sha256 hash of the file content.
func hashFileContent(path string) (string, error) {
	// Handle hashing big files.
	// Source: https://stackoverflow.com/q/60328216/1722542

	f, err := os.Open(path)
	if err != nil {
		return "", err
	}

	defer func() {
		err = f.Close()
		if err != nil {
			fmt.Printf("error closing file for hashing: %v", err)
		}
	}()

	buf := make([]byte, 1024*1024)
	h := sha256.New()

	for {
		bytesRead, err := f.Read(buf)
		if err != nil {
			if !errors.Is(err, io.EOF) {
				return "", err
			}
			_, err = h.Write(buf[:bytesRead])
			if err != nil {
				return "", err
			}
			break
		}
		_, err = h.Write(buf[:bytesRead])
		if err != nil {
			return "", err
		}
	}

	fileHash := hex.EncodeToString(h.Sum(nil))
	return fileHash, nil
}
