package schema

import (
	"errors"
	"fmt"
)

func ValidateTypeSchema(schema IntegrationTypeSchema) error {
	if schema.Type == "" {
		return errors.New("type is required")
	}
	if schema.Name == "" {
		return errors.New("name is required")
	}
	if schema.CurrentVersion == "" {
		return errors.New("current version is required")
	}
	if len(schema.Versions) == 0 {
		return errors.New("at least one version is required")
	}
	seen := map[Version]struct{}{}
	for i := range schema.Versions {
		if _, ok := seen[schema.Versions[i].Version]; ok {
			return fmt.Errorf("duplicate version: %s", schema.Versions[i].Version)
		}
		seen[schema.Versions[i].Version] = struct{}{}
		if err := ValidateSchemaVersion(schema.Versions[i]); err != nil {
			return fmt.Errorf("invalid version [%d]: %w", i, err)
		}
	}
	if _, ok := seen[schema.CurrentVersion]; !ok {
		return errors.New("current version not found")
	}
	return nil
}

func ValidateSchemaVersion(version IntegrationSchemaVersion) error {
	if version.Version == "" {
		return errors.New("version is required")
	} else if !IsValidVersion(version.Version) {
		return errors.New("invalid version")
	}
	if version.Version != V1 && version.CanCreate {
		return errors.New("canCreate is only supported for version 1")
	}
	if len(version.Options) == 0 {
		return errors.New("at least one option is required")
	}
	if version.typeSchema == nil {
		return errors.New("type schema is not assigned")
	}
	for idx, o := range version.Options {
		if err := ValidateField(o); err != nil {
			return fmt.Errorf("invalid option [%d] %s: %w", idx, o.PropertyName, err)
		}
	}
	return nil
}

func ValidateField(field Field) error {
	if field.PropertyName == "" {
		return errors.New("property name is required")
	}
	if field.Secure && len(field.SubformOptions) > 0 {
		return fmt.Errorf("secure field cannot have subform options: %s", field.PropertyName)
	}
	for _, option := range field.SubformOptions {
		if err := ValidateField(option); err != nil {
			return fmt.Errorf("invalid subform option: %w", err)
		}
	}
	return nil
}
