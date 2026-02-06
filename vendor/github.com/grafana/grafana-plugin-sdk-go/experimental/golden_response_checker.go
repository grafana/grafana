package experimental

import (
	"bufio"
	"errors"

	// ignoring the G505 so that the checksum matches git hash
	// nolint:gosec
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// CheckGoldenFramer calls CheckGoldenDataResponse using a data.Framer instead of a backend.DataResponse.
//
// Deprecated: Use CheckGoldenJSONFramer instead
func CheckGoldenFramer(path string, f data.Framer, updateFile bool) error {
	return CheckGoldenDataResponse(path, backend.FrameResponse(f), updateFile)
}

// CheckGoldenFrame calls CheckGoldenDataResponse using a single frame
//
// Deprecated: Use CheckGoldenJSONFrame instead
func CheckGoldenFrame(path string, f *data.Frame, updateFile bool) error {
	dr := backend.DataResponse{}
	dr.Frames = data.Frames{f}
	return CheckGoldenDataResponse(path, &dr, updateFile)
}

// CheckGoldenDataResponse will verify that the stored file matches the given data.DataResponse
// when the updateFile flag is set, this will both add errors to the response and update the saved file
//
// Deprecated: Use CheckGoldenJSONResponse instead
func CheckGoldenDataResponse(path string, dr *backend.DataResponse, updateFile bool) error {
	saved, err := readGoldenFile(path)

	if err != nil {
		return errorAfterUpdate(fmt.Errorf("error reading golden file:  %s\n%s", path, err.Error()), path, dr, updateFile)
	}

	if diff := cmp.Diff(saved.Error, dr.Error); diff != "" {
		return errorAfterUpdate(fmt.Errorf("errors mismatch %s (-want +got):\n%s", path, diff), path, dr, updateFile)
	}

	// When the frame count is different, you can check manually
	if diff := cmp.Diff(len(saved.Frames), len(dr.Frames)); diff != "" {
		return errorAfterUpdate(fmt.Errorf("frame count mismatch (-want +got):\n%s", diff), path, dr, updateFile)
	}

	errorString := ""

	// Check each frame
	for idx, frame := range dr.Frames {
		expectedFrame := saved.Frames[idx]
		if diff := cmp.Diff(expectedFrame, frame, data.FrameTestCompareOptions()...); diff != "" {
			errorString += fmt.Sprintf("frame[%d] mismatch (-want +got):\n%s\n", idx, diff)
		}
	}

	if len(errorString) > 0 {
		return errorAfterUpdate(errors.New(errorString), path, dr, updateFile)
	}

	return nil // OK
}

func errorAfterUpdate(err error, path string, dr *backend.DataResponse, updateFile bool) error {
	if updateFile {
		_ = writeGoldenFile(path, dr)
		log.Printf("golden file updated: %s\n", path)
	}
	return err
}

const binaryDataSection = "====== TEST DATA RESPONSE (arrow base64) ======"

func readGoldenFile(path string) (*backend.DataResponse, error) {
	file, err := os.Open(path) // #nosec G304
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()

	dr := &backend.DataResponse{}

	foundDataSection := false
	scanner := bufio.NewScanner(file)
	fi, err := file.Stat()
	if err != nil {
		return nil, err
	}
	fsize := fi.Size()
	buf := make([]byte, 0, bufio.MaxScanTokenSize)
	scanner.Buffer(buf, int(fsize))
	for scanner.Scan() {
		line := scanner.Text()
		if foundDataSection {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) != 2 {
				continue // skip lines without KEY=VALUE
			}

			key := parts[0]
			val := parts[1]

			switch key {
			case "ERROR":
				return nil, fmt.Errorf("error matching not yet supported: %s", line)
			case "FRAME":
				bytes, err := base64.StdEncoding.DecodeString(val)
				if err != nil {
					return nil, err
				}
				frame, err := data.UnmarshalArrowFrame(bytes)
				if err != nil {
					return nil, err
				}
				dr.Frames = append(dr.Frames, frame)
			default:
				return nil, fmt.Errorf("unknown saved key: %s", key)
			}
		} else if strings.HasPrefix(line, binaryDataSection) {
			foundDataSection = true
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err // error reading file
	}

	if !foundDataSection {
		return nil, fmt.Errorf("no saved result found in: %s", path)
	}

	return dr, nil
}

// The golden file has a text description at the top and a binary response at the bottom
// The text part is not used for testing, but aims to give a legible response format
func writeGoldenFile(path string, dr *backend.DataResponse) error {
	str := generateHeaderString(dr)

	// Add the binary section flag
	str += binaryDataSection

	if dr.Error != nil {
		str += "\nERROR=" + dr.Error.Error()
	}
	for _, frame := range dr.Frames {
		bytes, _ := frame.MarshalArrow()
		encoded := base64.StdEncoding.EncodeToString(bytes)
		str += "\nFRAME=" + encoded
	}
	str += "\n"

	return os.WriteFile(path, []byte(str), 0600)
}

const machineStr = "🌟 This was machine generated.  Do not edit. 🌟\n"

func generateHeaderString(dr *backend.DataResponse) string {
	str := machineStr
	if dr.Error != nil {
		str = fmt.Sprintf("\nERROR: %+v", dr.Error)
	}

	if dr.Frames != nil {
		for idx, frame := range dr.Frames {
			str += fmt.Sprintf("\nFrame[%d] ", idx)
			if frame.Meta != nil {
				meta, _ := json.MarshalIndent(frame.Meta, "", "    ")
				str += string(meta)
			}

			table, _ := frame.StringTable(100, 10)
			str += "\n" + table + "\n\n"
		}
	}
	return str
}

// CheckGoldenJSONFramer calls CheckGoldenJSONResponse using a data.Framer instead of a backend.DataResponse.
func CheckGoldenJSONFramer(t *testing.T, dir string, name string, f data.Framer, updateFile bool) {
	t.Helper()
	CheckGoldenJSONResponse(t, dir, name, backend.FrameResponse(f), updateFile)
}

// CheckGoldenJSONFrame calls CheckGoldenJSONResponse using a single frame.
func CheckGoldenJSONFrame(t *testing.T, dir string, name string, f *data.Frame, updateFile bool) {
	t.Helper()
	dr := backend.DataResponse{}
	dr.Frames = data.Frames{f}
	CheckGoldenJSONResponse(t, dir, name, &dr, updateFile)
}

// CheckGoldenJSONResponse will verify that the stored JSON file matches the given backend.DataResponse.
func CheckGoldenJSONResponse(t *testing.T, dir string, name string, dr *backend.DataResponse, updateFile bool) {
	t.Helper()
	fpath := path.Join(dir, name+".jsonc")

	expected, err := readGoldenJSONFile(fpath)
	if err != nil {
		if updateFile {
			err = writeGoldenJSONFile(fpath, dr)
			require.NoError(t, err)
			return
		}
		require.Fail(t, "Error reading golden JSON file")
	}

	actual, err := json.Marshal(dr)
	require.NoError(t, err)

	assert.JSONEq(t, expected, string(actual))

	if updateFile {
		err = writeGoldenJSONFile(fpath, dr)
		assert.NoError(t, err)
	}
}

func readGoldenJSONFile(fpath string) (string, error) {
	raw, err := os.ReadFile(fpath) // #nosec G304
	if err != nil {
		return "", err
	}
	if len(raw) == 0 {
		return "", fmt.Errorf("empty file found: %s", fpath)
	}
	chunks := strings.Split(string(raw), "//  "+machineStr)
	if len(chunks) < 3 {
		// ignoring the G401 so that the checksum matches git hash
		// nolint:gosec
		hash := sha1.Sum(raw)
		return "", fmt.Errorf("no golden data found in: %s (%d bytes, sha1: %s)", fpath, len(raw), hex.EncodeToString(hash[:]))
	}
	return chunks[2], nil
}

func writeGoldenJSONFile(fpath string, dr *backend.DataResponse) error {
	header := strings.Split(generateHeaderString(dr), "\n")
	str := "//  " + strings.Join(header, "\n//  ") + machineStr
	raw, err := json.MarshalIndent(dr, "", "  ")
	if err != nil {
		return err
	}
	str += string(raw)
	return os.WriteFile(fpath, []byte(str), 0600)
}
