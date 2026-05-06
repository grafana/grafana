package json

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
)

// DiscardUnknownField discards unknown fields from a decoder body.
// This function is useful while deserializing a JSON body with additional
// unknown information that should be discarded.
func DiscardUnknownField(decoder *json.Decoder) error {
	// This deliberately does not share logic with CollectUnknownField, even
	// though it could, because if we were to delegate to that then we'd incur
	// extra allocations and general memory usage.
	v, err := decoder.Token()
	if err == io.EOF {
		return nil
	}
	if err != nil {
		return err
	}

	if _, ok := v.(json.Delim); ok {
		for decoder.More() {
			err = DiscardUnknownField(decoder)
		}
		endToken, err := decoder.Token()
		if err != nil {
			return err
		}
		if _, ok := endToken.(json.Delim); !ok {
			return fmt.Errorf("invalid JSON : expected json delimiter, found %T %v",
				endToken, endToken)
		}
	}

	return nil
}

// CollectUnknownField grabs the contents of unknown fields from the decoder body
// and returns them as a byte slice. This is useful for skipping unknown fields without
// completely discarding them.
func CollectUnknownField(decoder *json.Decoder) ([]byte, error) {
	result, err := collectUnknownField(decoder)
	if err != nil {
		return nil, err
	}

	buff := bytes.NewBuffer(nil)
	encoder := json.NewEncoder(buff)

	if err := encoder.Encode(result); err != nil {
		return nil, err
	}

	return buff.Bytes(), nil
}

func collectUnknownField(decoder *json.Decoder) (interface{}, error) {
	// Grab the initial value. This could either be a concrete value like a string or a a
	// delimiter.
	token, err := decoder.Token()
	if err == io.EOF {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	// If it's an array or object, we'll need to recurse.
	delim, ok := token.(json.Delim)
	if ok {
		var result interface{}
		if delim == '{' {
			result, err = collectUnknownObject(decoder)
			if err != nil {
				return nil, err
			}
		} else {
			result, err = collectUnknownArray(decoder)
			if err != nil {
				return nil, err
			}
		}

		// Discard the closing token. decoder.Token handles checking for matching delimiters
		if _, err := decoder.Token(); err != nil {
			return nil, err
		}
		return result, nil
	}

	return token, nil
}

func collectUnknownArray(decoder *json.Decoder) ([]interface{}, error) {
	// We need to create an empty array here instead of a nil array, since by getting
	// into this function at all we necessarily have seen a non-nil list.
	array := []interface{}{}

	for decoder.More() {
		value, err := collectUnknownField(decoder)
		if err != nil {
			return nil, err
		}
		array = append(array, value)
	}

	return array, nil
}

func collectUnknownObject(decoder *json.Decoder) (map[string]interface{}, error) {
	object := make(map[string]interface{})

	for decoder.More() {
		key, err := collectUnknownField(decoder)
		if err != nil {
			return nil, err
		}

		// Keys have to be strings, which is particularly important as the encoder
		// won't except a map with interface{} keys
		stringKey, ok := key.(string)
		if !ok {
			return nil, fmt.Errorf("expected string key, found %T", key)
		}

		value, err := collectUnknownField(decoder)
		if err != nil {
			return nil, err
		}

		object[stringKey] = value
	}

	return object, nil
}
