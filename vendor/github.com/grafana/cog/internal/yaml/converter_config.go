package yaml

import (
	"os"

	"gopkg.in/yaml.v3"
)

type ConverterConfig struct {
	Runtime []Runtime `yaml:"runtime"`
}

type Runtime struct {
	Package            string `yaml:"package"`
	Name               string `yaml:"name"`
	NameFunc           string `yaml:"name_func"`
	DiscriminatorField string `yaml:"discriminator_field"`
}

type ConverterConfigReader struct{}

func NewConverterConfigReader() *ConverterConfigReader {
	return &ConverterConfigReader{}
}

func (c ConverterConfigReader) ReadConverterConfig(filename string) (ConverterConfig, error) {
	if filename == "" {
		return ConverterConfig{}, nil
	}

	f, err := os.Open(filename)
	if err != nil {
		return ConverterConfig{}, err
	}

	defer f.Close()

	decoder := yaml.NewDecoder(f)
	decoder.KnownFields(true)

	var config ConverterConfig
	if err = decoder.Decode(&config); err != nil {
		return config, err
	}

	return config, nil
}
