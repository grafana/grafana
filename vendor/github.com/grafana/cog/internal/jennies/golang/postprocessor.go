package golang

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/grafana/codejen"
	"golang.org/x/tools/imports"
)

func formatGoFiles(file codejen.File) (codejen.File, error) {
	if !strings.HasSuffix(file.RelativePath, ".go") {
		return file, nil
	}

	output, err := imports.Process(filepath.Base(file.RelativePath), file.Data, &imports.Options{
		FormatOnly: true,
		Comments:   true,
	})
	if err != nil {
		return codejen.File{}, fmt.Errorf("goimports processing of generated file failed: %w", err)
	}

	return codejen.File{
		RelativePath: file.RelativePath,
		Data:         output,
		From:         file.From,
	}, nil
}
