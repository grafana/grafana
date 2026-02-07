package utils

func JSONTypeExtractor(variation interface{}) (string, error) {
	switch variation.(type) {
	case string:
		return "(string)", nil
	case float64, int:
		return "(number)", nil
	case bool:
		return "(bool)", nil
	case []interface{}:
		return "([]interface{})", nil
	case map[string]interface{}:
		return "(map[string]interface{})", nil
	}
	return "", nil
}
