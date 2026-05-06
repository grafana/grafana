package ajson

import (
	"strconv"
	"sync/atomic"
)

// IsDirty is the flag that shows, was node changed or not
func (n *Node) IsDirty() bool {
	return n.dirty
}

// Set updates current node value with the value of any type
func (n *Node) Set(value interface{}) error {
	if value == nil {
		return n.SetNull()
	}
	switch result := value.(type) {
	case float64, float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		if tValue, err := numeric2float64(value); err != nil {
			return err
		} else {
			return n.SetNumeric(tValue)
		}
	case string:
		return n.SetString(result)
	case bool:
		return n.SetBool(result)
	case []*Node:
		return n.SetArray(result)
	case map[string]*Node:
		return n.SetObject(result)
	case *Node:
		return n.SetNode(result)
	default:
		return unsupportedType(value)
	}
}

// SetNull updates current node value with Null value
func (n *Node) SetNull() error {
	return n.update(Null, nil)
}

// SetNumeric updates current node value with Numeric value
func (n *Node) SetNumeric(value float64) error {
	return n.update(Numeric, value)
}

// SetString updates current node value with String value
func (n *Node) SetString(value string) error {
	return n.update(String, value)
}

// SetBool updates current node value with Bool value
func (n *Node) SetBool(value bool) error {
	return n.update(Bool, value)
}

// SetArray updates current node value with Array value
func (n *Node) SetArray(value []*Node) error {
	return n.update(Array, value)
}

// SetObject updates current node value with Object value
func (n *Node) SetObject(value map[string]*Node) error {
	return n.update(Object, value)
}

// SetNode updates current node value with the clone of the given Node value
// NB! The result will be the clone of the given Node!
func (n *Node) SetNode(value *Node) error {
	if n == value {
		// Attempt to set current node as the value: node.SetNode(node)
		return nil
	}
	if n.isParentOrSelfNode(value) {
		return errorRequest("attempt to create infinite loop")
	}

	node := value.Clone()
	node.setReference(n.parent, n.key, n.index)
	n.setReference(nil, nil, nil)
	*n = *node
	if n.parent != nil {
		n.parent.mark()
	}
	return nil
}

// AppendArray appends current Array node values with Node values
func (n *Node) AppendArray(value ...*Node) error {
	if !n.IsArray() {
		return errorType()
	}
	for _, val := range value {
		if err := n.appendNode(nil, val); err != nil {
			return err
		}
	}
	n.mark()
	return nil
}

// AppendObject appends current Object node value with key:value
func (n *Node) AppendObject(key string, value *Node) error {
	if !n.IsObject() {
		return errorType()
	}
	err := n.appendNode(&key, value)
	if err != nil {
		return err
	}
	n.mark()
	return nil
}

// DeleteNode removes element child
func (n *Node) DeleteNode(value *Node) error {
	return n.remove(value)
}

// DeleteKey removes element from Object, by it's key
func (n *Node) DeleteKey(key string) error {
	node, err := n.GetKey(key)
	if err != nil {
		return err
	}
	return n.remove(node)
}

// PopKey removes element from Object, by it's key and return it
func (n *Node) PopKey(key string) (node *Node, err error) {
	node, err = n.GetKey(key)
	if err != nil {
		return
	}
	return node, n.remove(node)
}

// DeleteIndex removes element from Array, by it's index
func (n *Node) DeleteIndex(index int) error {
	node, err := n.GetIndex(index)
	if err != nil {
		return err
	}
	return n.remove(node)
}

// PopIndex removes element from Array, by it's index and return it
func (n *Node) PopIndex(index int) (node *Node, err error) {
	node, err = n.GetIndex(index)
	if err != nil {
		return
	}
	return node, n.remove(node)
}

// Delete removes element from parent. For root - do nothing.
func (n *Node) Delete() error {
	if n.parent == nil {
		return nil
	}
	return n.parent.remove(n)
}

// Clone creates full copy of current Node. With all child, but without link to the parent.
func (n *Node) Clone() *Node {
	node := n.clone()
	node.setReference(nil, nil, nil)
	return node
}

func (n *Node) clone() *Node {
	node := &Node{
		parent:   n.parent,
		children: make(map[string]*Node, len(n.children)),
		key:      cptrs(n.key),
		index:    cptri(n.index),
		_type:    n._type,
		data:     n.data,
		borders:  n.borders,
		value:    n.value,
		dirty:    n.dirty,
	}
	for key, value := range n.children {
		clone := value.clone()
		clone.parent = node
		node.children[key] = clone
	}
	return node
}

// update method updates stored value, with validations
func (n *Node) update(_type NodeType, value interface{}) error {
	// validate
	err := n.validate(_type, value)
	if err != nil {
		return err
	}
	// update
	n.mark()
	n.clear()

	atomic.StoreInt32((*int32)(&n._type), int32(_type))
	n.value = atomic.Value{}
	if value != nil {
		switch _type {
		case Array:
			nodes := value.([]*Node)
			n.children = make(map[string]*Node, len(nodes))
			for _, node := range nodes {
				tnode := node
				if err = n.appendNode(nil, tnode); err != nil {
					return err
				}
			}
		case Object:
			nodes := value.(map[string]*Node)
			n.children = make(map[string]*Node, len(nodes))
			for key, node := range nodes {
				tkey := key
				tnode := node
				if err = n.appendNode(&tkey, tnode); err != nil {
					return err
				}
			}
		}
		n.value.Store(value)
	}
	return nil
}

// validate method validates stored value, before update
func (n *Node) validate(_type NodeType, value interface{}) error {
	if n == nil {
		return errorUnparsed()
	}
	switch _type {
	case Null:
		if value != nil {
			return errorType()
		}
	case Numeric:
		if _, ok := value.(float64); !ok {
			return errorType()
		}
	case String:
		if _, ok := value.(string); !ok {
			return errorType()
		}
	case Bool:
		if _, ok := value.(bool); !ok {
			return errorType()
		}
	case Array:
		if value != nil {
			if _, ok := value.([]*Node); !ok {
				return errorType()
			}
		}
	case Object:
		if value != nil {
			if _, ok := value.(map[string]*Node); !ok {
				return errorType()
			}
		}
	}
	return nil
}

// remove method removes value from current container
func (n *Node) remove(value *Node) error {
	if !n.isContainer() {
		return errorType()
	}
	if value.parent != n {
		return errorRequest("wrong parent")
	}
	n.mark()
	if n.IsArray() {
		delete(n.children, strconv.Itoa(*value.index))
		n.dropindex(*value.index)
	} else {
		delete(n.children, *value.key)
	}
	value.parent = nil
	return nil
}

// dropindex: internal method to reindexing current array value
func (n *Node) dropindex(index int) {
	for i := index + 1; i <= len(n.children); i++ {
		previous := i - 1
		if current, ok := n.children[strconv.Itoa(i)]; ok {
			current.index = &previous
			n.children[strconv.Itoa(previous)] = current
		}
		delete(n.children, strconv.Itoa(i))
	}
}

// appendNode appends current Node node value with new Node value, by key or index
func (n *Node) appendNode(key *string, value *Node) error {
	if n.isParentOrSelfNode(value) {
		return errorRequest("attempt to create infinite loop")
	}
	if value.parent != nil {
		if err := value.parent.remove(value); err != nil {
			return err
		}
	}
	value.parent = n
	value.key = key
	if key != nil {
		if old, ok := n.children[*key]; ok {
			if old != value {
				if err := n.remove(old); err != nil {
					return err
				}
			}
		}
		n.children[*key] = value
	} else {
		index := len(n.children)
		value.index = &index
		n.children[strconv.Itoa(index)] = value
	}
	return nil
}

// mark node as dirty, with all parents (up the tree)
func (n *Node) mark() {
	node := n
	for node != nil && !node.dirty {
		node.dirty = true
		node = node.parent
	}
}

// clear current value of node
func (n *Node) clear() {
	n.data = nil
	n.borders[1] = 0
	for key := range n.children {
		n.children[key].parent = nil
	}
	n.children = nil
}

// isParentOrSelfNode check if current node is the same as given one of parents
func (n *Node) isParentOrSelfNode(node *Node) bool {
	return n == node || n.isParentNode(node)
}

// isParentNode check if current node is one of the parents
func (n *Node) isParentNode(node *Node) bool {
	if n != nil {
		for current := n.parent; current != nil; current = current.parent {
			if current == node {
				return true
			}
		}
	}
	return false
}

// setReference updates references of current node
func (n *Node) setReference(parent *Node, key *string, index *int) {
	n.parent = parent
	if key == nil {
		n.key = nil
	} else {
		temp := *key
		n.key = &temp
	}
	n.index = cptri(index)
}
