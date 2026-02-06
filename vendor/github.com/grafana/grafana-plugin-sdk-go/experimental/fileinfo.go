package experimental

import (
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func GetDirectoryFrame(p string, details bool) (*data.Frame, error) {
	// Name() string       // base name of the file
	// Size() int64        // length in bytes for regular files; system-dependent for others
	// Mode() FileMode     // file mode bits
	// ModTime() time.Time // modification time
	// IsDir() bool        // abbreviation for Mode().IsDir()

	files, err := os.ReadDir(p)
	if err != nil {
		return nil, err
	}
	count := len(files)
	names := data.NewFieldFromFieldType(data.FieldTypeString, count)
	mtype := data.NewFieldFromFieldType(data.FieldTypeString, count)
	size := data.NewFieldFromFieldType(data.FieldTypeInt64, count)
	modified := data.NewFieldFromFieldType(data.FieldTypeTime, count)

	names.Name = "name"
	mtype.Name = "media-type"
	size.Name = "size"
	size.Config = &data.FieldConfig{
		Unit: "bytes",
	}
	modified.Name = "modified"

	for i, file := range files {
		names.Set(i, file.Name())

		mediaType := ""
		if file.IsDir() {
			mediaType = "directory"
		} // TODO guess from extension?

		mtype.Set(i, mediaType)
		if details {
			stat, err := os.Stat(file.Name())
			if err == nil {
				size.Set(i, stat.Size())
				modified.Set(i, stat.ModTime())
			}
		}
	}

	frame := data.NewFrame("", names, mtype)
	frame.SetMeta(&data.FrameMeta{
		PathSeparator: string(os.PathSeparator),
		Type:          data.FrameTypeDirectoryListing,
	})
	if details {
		frame.Fields = append(frame.Fields, size)
		frame.Fields = append(frame.Fields, modified)
	}
	return frame, nil
}
