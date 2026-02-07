package ajson

import (
	"strconv"
)

// Marshal returns slice of bytes, marshaled from current value
func Marshal(node *Node) (result []byte, err error) {
	result = make([]byte, 0)
	var (
		sValue string
		bValue bool
		nValue float64
		oValue []byte
	)

	if node == nil {
		return nil, errorUnparsed()
	} else if node.dirty {
		switch node._type {
		case Null:
			result = append(result, _null...)
		case Numeric:
			nValue, err = node.GetNumeric()
			if err != nil {
				return nil, err
			}
			result = append(result, strconv.FormatFloat(nValue, 'g', -1, 64)...)
		case String:
			sValue, err = node.GetString()
			if err != nil {
				return nil, err
			}
			result = append(result, quotes)
			result = append(result, quoteString(sValue, true)...)
			result = append(result, quotes)
		case Bool:
			bValue, err = node.GetBool()
			if err != nil {
				return nil, err
			} else if bValue {
				result = append(result, _true...)
			} else {
				result = append(result, _false...)
			}
		case Array:
			result = append(result, bracketL)
			for i := 0; i < len(node.children); i++ {
				if i != 0 {
					result = append(result, coma)
				}
				child, ok := node.children[strconv.Itoa(i)]
				if !ok {
					return nil, errorRequest("wrong length of array")
				}
				oValue, err = Marshal(child)
				if err != nil {
					return nil, err
				}
				result = append(result, oValue...)
			}
			result = append(result, bracketR)
		case Object:
			result = append(result, bracesL)
			bValue = false
			for key, child := range node.children {
				if bValue {
					result = append(result, coma)
				} else {
					bValue = true
				}
				result = append(result, quotes)
				result = append(result, quoteString(key, true)...)
				result = append(result, quotes, colon)
				oValue, err = Marshal(child)
				if err != nil {
					return nil, err
				}
				result = append(result, oValue...)
			}
			result = append(result, bracesR)
		}
	} else if node.ready() {
		result = append(result, node.Source()...)
	} else {
		return nil, errorUnparsed()
	}

	return
}
