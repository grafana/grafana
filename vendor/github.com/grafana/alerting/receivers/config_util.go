package receivers

import (
	"encoding/json"
	"strings"

	"gopkg.in/yaml.v3"
)

type DecryptFunc func(key string, fallback string) string

type CommaSeparatedStrings []string

func (r *CommaSeparatedStrings) UnmarshalJSON(b []byte) error {
	var str string
	if err := json.Unmarshal(b, &str); err != nil {
		return err
	}
	if len(str) > 0 {
		res := CommaSeparatedStrings(splitCommaDelimitedString(str))
		*r = res
	}
	return nil
}

func (r *CommaSeparatedStrings) MarshalJSON() ([]byte, error) {
	if r == nil {
		return nil, nil
	}
	str := strings.Join(*r, ",")
	return json.Marshal(str)
}

func (r *CommaSeparatedStrings) UnmarshalYAML(b []byte) error {
	var str string
	if err := yaml.Unmarshal(b, &str); err != nil {
		return err
	}
	if len(str) > 0 {
		res := CommaSeparatedStrings(splitCommaDelimitedString(str))
		*r = res
	}
	return nil
}

func (r *CommaSeparatedStrings) MarshalYAML() ([]byte, error) {
	if r == nil {
		return nil, nil
	}
	str := strings.Join(*r, ",")
	return yaml.Marshal(str)
}

func splitCommaDelimitedString(str string) []string {
	split := strings.Split(str, ",")
	res := make([]string, 0, len(split))
	for _, s := range split {
		if tr := strings.TrimSpace(s); tr != "" {
			res = append(res, tr)
		}
	}
	return res
}
