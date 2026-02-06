package ajson

import (
	. "github.com/spyzhov/ajson/internal"
)

// List of action codes.
// Copy from `internal/state.go:144`
const (
	cl States = -2 /* colon           */
	cm States = -3 /* comma           */
	//qt States = -4 /* quote           */
	bo States = -5 /* bracket open    */
	co States = -6 /* curly br. open  */
	bc States = -7 /* bracket close   */
	cc States = -8 /* curly br. close */
	ec States = -9 /* curly br. empty */
)

// Unmarshal parses the JSON-encoded data and return the root node of struct.
//
// Doesn't calculate values, just type of stored value. It will store link to the data, on all life long.
func Unmarshal(data []byte) (root *Node, err error) {
	buf := newBuffer(data)
	var (
		state   States
		key     *string
		current *Node
		useKey  = func() **string {
			tmp := cptrs(key)
			key = nil
			return &tmp
		}
	)

	_, err = buf.first()
	if err != nil {
		return nil, buf.errorEOF()
	}

	for {
		state = buf.getState()
		if state == __ {
			return nil, buf.errorSymbol()
		}

		if state >= GO {
			// region Change State
			switch buf.state {
			case ST:
				if current != nil && current.IsObject() && key == nil {
					// Detected: Key
					key, err = getString(buf)
					buf.state = CO
				} else {
					// Detected: String
					current, err = newNode(current, buf, String, useKey())
					if err != nil {
						break
					}
					err = buf.string(quotes, false)
					current.borders[1] = buf.index + 1
					buf.state = OK
					if current.parent != nil {
						current = current.parent
					}
				}
			case MI, ZE, IN:
				current, err = newNode(current, buf, Numeric, useKey())
				if err != nil {
					break
				}
				err = buf.numeric(false)
				current.borders[1] = buf.index
				buf.index -= 1
				buf.state = OK
				if current.parent != nil {
					current = current.parent
				}
			case T1, F1:
				current, err = newNode(current, buf, Bool, useKey())
				if err != nil {
					break
				}
				if buf.state == T1 {
					err = buf.true()
				} else {
					err = buf.false()
				}
				current.borders[1] = buf.index + 1
				buf.state = OK
				if current.parent != nil {
					current = current.parent
				}
			case N1:
				current, err = newNode(current, buf, Null, useKey())
				if err != nil {
					break
				}
				err = buf.null()
				current.borders[1] = buf.index + 1
				buf.state = OK
				if current.parent != nil {
					current = current.parent
				}
			}
			// endregion Change State
		} else {
			// region Action
			switch state {
			case ec: /* empty } */
				if key != nil {
					err = buf.errorSymbol()
				}
				fallthrough
			case cc: /* } */
				if current != nil && current.IsObject() && !current.ready() {
					current.borders[1] = buf.index + 1
					if current.parent != nil {
						current = current.parent
					}
				} else {
					err = buf.errorSymbol()
				}
				buf.state = OK
			case bc: /* ] */
				if current != nil && current.IsArray() && !current.ready() {
					current.borders[1] = buf.index + 1
					if current.parent != nil {
						current = current.parent
					}
				} else {
					err = buf.errorSymbol()
				}
				buf.state = OK
			case co: /* { */
				current, err = newNode(current, buf, Object, useKey())
				buf.state = OB
			case bo: /* [ */
				current, err = newNode(current, buf, Array, useKey())
				buf.state = AR
			case cm: /* , */
				if current == nil {
					return nil, buf.errorSymbol()
				}
				if current.IsObject() {
					buf.state = KE
				} else if current.IsArray() {
					buf.state = VA
				} else {
					err = buf.errorSymbol()
				}
			case cl: /* : */
				if current == nil || !current.IsObject() || key == nil {
					err = buf.errorSymbol()
				} else {
					buf.state = VA
				}
			default: /* syntax error */
				err = buf.errorSymbol()
			}
			// endregion Action
		}
		if err != nil {
			return
		}
		if buf.step() != nil {
			break
		}
		if _, err = buf.first(); err != nil {
			err = nil
			break
		}
	}

	if current == nil || buf.state != OK {
		err = buf.errorEOF()
	} else {
		root = current.root()
		if !root.ready() {
			err = buf.errorEOF()
			root = nil
		}
	}

	return
}

// UnmarshalSafe do the same thing as Unmarshal, but copy data to the local variable, to make it editable.
func UnmarshalSafe(data []byte) (root *Node, err error) {
	var safe []byte
	safe = append(safe, data...)
	return Unmarshal(safe)
}

// Must returns a Node if there was no error. Else - panic with error as the value.
func Must(root *Node, err error) *Node {
	if err != nil {
		panic(err)
	}
	return root
}

func getString(b *buffer) (*string, error) {
	start := b.index
	err := b.string(quotes, false)
	if err != nil {
		return nil, err
	}
	value, ok := unquote(b.data[start:b.index+1], quotes)
	if !ok {
		return nil, errorSymbol(b)
	}
	return &value, nil
}

func cptrs(cpy *string) *string {
	if cpy == nil {
		return nil
	}
	val := *cpy
	return &val
}

func cptri(cpy *int) *int {
	if cpy == nil {
		return nil
	}
	val := *cpy
	return &val
}
