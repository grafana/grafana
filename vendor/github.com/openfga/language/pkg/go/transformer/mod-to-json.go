package transformer

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/hashicorp/go-multierror"
	"gopkg.in/yaml.v3"
)

type ModFileStringProperty struct {
	Value  string `json:"value"`
	Line   int    `json:"line"`
	Column int    `json:"column"`
}

type ModFileArrayProperty struct {
	Value  []ModFileStringProperty `json:"value"`
	Line   int                     `json:"line"`
	Column int                     `json:"column"`
}

type ModFile struct {
	Schema   ModFileStringProperty `json:"schema"`
	Contents ModFileArrayProperty  `json:"contents"`
}

type YAMLModFile struct {
	Schema   yaml.Node `yaml:"schema"`
	Contents yaml.Node `yaml:"contents"`
}

type ModFileValidationErrorMetadata struct{}

// ModFileValidationError is an error occurred during validation of the mod.fga file. Line and
// column number provided are one based.
type ModFileValidationError struct {
	Line, Column int
	Msg          string
}

func (e *ModFileValidationError) Error() string {
	return fmt.Sprintf("validation error at line=%d, column=%d: %s", e.Line, e.Column, e.Msg)
}

type ModFileValidationMultipleError multierror.Error

func (e *ModFileValidationMultipleError) Error() string {
	errors := e.Errors

	pluralS := ""
	if len(errors) > 1 {
		pluralS = "s"
	}

	errorsString := []string{}
	for _, item := range errors {
		errorsString = append(errorsString, item.Error())
	}

	return fmt.Sprintf("%d error%s occurred:\n\t* %s\n\n", len(errors), pluralS, strings.Join(errorsString, "\n\t* "))
}

const (
	stringNode = "!!str"
	seqNode    = "!!seq"
)

// TransformModFile transforms a mod.fga and validates the fields are correct.
func TransformModFile(data string) (*ModFile, error) { //nolint:cyclop
	yamlModFile := &YAMLModFile{}

	err := yaml.Unmarshal([]byte(data), yamlModFile)
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	modFile := &ModFile{}
	errors := &multierror.Error{}

	switch {
	case yamlModFile.Schema.IsZero():
		errors = multierror.Append(errors, &ModFileValidationError{
			Msg:    "missing schema field",
			Line:   0,
			Column: 0,
		})
	case yamlModFile.Schema.Tag != stringNode:
		errors = multierror.Append(errors, &ModFileValidationError{
			Msg:    "unexpected schema type, expected string got value " + yamlModFile.Schema.Value,
			Line:   yamlModFile.Schema.Line - 1,
			Column: yamlModFile.Schema.Column - 1,
		})
	case yamlModFile.Schema.Value != "1.2":
		errors = multierror.Append(errors, &ModFileValidationError{
			Msg:    "unsupported schema version, fga.mod only supported in version `1.2`",
			Line:   yamlModFile.Schema.Line - 1,
			Column: yamlModFile.Schema.Column - 1,
		})
	default:
		modFile.Schema = ModFileStringProperty{
			Value:  yamlModFile.Schema.Value,
			Line:   yamlModFile.Schema.Line - 1,
			Column: yamlModFile.Schema.Column - 1,
		}
	}

	switch {
	case yamlModFile.Contents.IsZero():
		errors = multierror.Append(errors, &ModFileValidationError{
			Msg:    "missing contents field",
			Line:   0,
			Column: 0,
		})
	case yamlModFile.Contents.Tag != seqNode:
		errors = multierror.Append(errors, &ModFileValidationError{
			Msg:    "unexpected contents type, expected list of strings got value " + yamlModFile.Contents.Value,
			Line:   yamlModFile.Contents.Line - 1,
			Column: yamlModFile.Contents.Column - 1,
		})
	default:
		contents := []ModFileStringProperty{}

		for _, file := range yamlModFile.Contents.Content {
			if file.Tag != stringNode {
				errors = multierror.Append(errors, &ModFileValidationError{
					Msg:    "unexpected contents item type, expected string got value " + file.Value,
					Line:   file.Line - 1,
					Column: file.Column - 1,
				})

				continue
			}
			// Decode URI components
			decodedValue, err := url.QueryUnescape(file.Value)
			if err != nil {
				errors = multierror.Append(errors, &ModFileValidationError{
					Msg:    "failed to decode path: " + file.Value,
					Line:   file.Line - 1,
					Column: file.Column - 1,
				})

				continue
			}

			// Normalize path separators (Windows -> Unix)
			normalizedPath := strings.ReplaceAll(decodedValue, "\\", "/")

			// Check for directory traversal patterns or absolute paths
			if strings.Contains(normalizedPath, "../") || strings.HasPrefix(normalizedPath, "/") {
				errors = multierror.Append(errors, &ModFileValidationError{
					Msg:    "invalid contents item " + file.Value,
					Line:   file.Line - 1,
					Column: file.Column - 1,
				})

				continue
			}

			if !strings.HasSuffix(normalizedPath, ".fga") {
				errors = multierror.Append(errors, &ModFileValidationError{
					Msg:    "contents items should use fga file extension, got " + file.Value,
					Line:   file.Line - 1,
					Column: file.Column - 1,
				})

				continue
			}

			contents = append(contents, ModFileStringProperty{
				Value:  normalizedPath,
				Line:   file.Line - 1,
				Column: file.Column - 1,
			})
		}

		modFile.Contents = ModFileArrayProperty{
			Value:  contents,
			Line:   yamlModFile.Contents.Line - 1,
			Column: yamlModFile.Contents.Column - 1,
		}
	}

	if len(errors.Errors) != 0 {
		return nil, &ModFileValidationMultipleError{
			Errors: errors.Errors,
		}
	}

	return modFile, nil
}
