package envutil

import (
	"fmt"
	"os"
	"strconv"
)

func Get(key string) (string, error) {
	if strValue := os.Getenv(key); strValue == "" {
		return "", fmt.Errorf("environment variable '%s' is not set", key)
	} else {
		return strValue, nil
	}
}

func GetOrDefault(key string, defaultValue string) string {
	if strValue := os.Getenv(key); strValue == "" {
		return defaultValue
	} else {
		return strValue
	}
}

func GetBool(key string) (bool, error) {
	if strValue := os.Getenv(key); strValue == "" {
		return false, fmt.Errorf("environment variable '%s' is not set", key)
	} else if value, err := strconv.ParseBool(strValue); err != nil {
		return false, fmt.Errorf("environment variable '%s' is invalid bool value '%s'", key, strValue)
	} else {
		return value, nil
	}
}

func GetBoolOrDefault(key string, defaultValue bool) (bool, error) {
	if strValue := os.Getenv(key); strValue == "" {
		return defaultValue, nil
	} else if value, err := strconv.ParseBool(strValue); err != nil {
		return false, fmt.Errorf("environment variable '%s' is invalid bool value '%s'", key, strValue)
	} else {
		return value, nil
	}
}

// GetOrFallback to be removed with release of Grafana 9.x
func GetOrFallback(key string, fallbackKey string, defaultValue string) string {
	if strValue := os.Getenv(key); strValue == "" {
		return GetOrDefault(fallbackKey, defaultValue)
	} else {
		return strValue
	}
}

// GetBoolOrFallback to be removed with release of Grafana 9.x
func GetBoolOrFallback(key string, fallbackKey string, defaultValue bool) (bool, error) {
	if strValue := os.Getenv(key); strValue == "" {
		return GetBoolOrDefault(fallbackKey, defaultValue)
	} else if value, err := strconv.ParseBool(strValue); err != nil {
		return false, fmt.Errorf("environment variable '%s' is invalid bool value '%s'", key, strValue)
	} else {
		return value, nil
	}
}
