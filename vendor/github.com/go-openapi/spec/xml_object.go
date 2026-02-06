// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

// XMLObject a metadata object that allows for more fine-tuned XML model definitions.
//
// For more information: http://goo.gl/8us55a#xmlObject
type XMLObject struct {
	Name      string `json:"name,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Prefix    string `json:"prefix,omitempty"`
	Attribute bool   `json:"attribute,omitempty"`
	Wrapped   bool   `json:"wrapped,omitempty"`
}

// WithName sets the xml name for the object
func (x *XMLObject) WithName(name string) *XMLObject {
	x.Name = name
	return x
}

// WithNamespace sets the xml namespace for the object
func (x *XMLObject) WithNamespace(namespace string) *XMLObject {
	x.Namespace = namespace
	return x
}

// WithPrefix sets the xml prefix for the object
func (x *XMLObject) WithPrefix(prefix string) *XMLObject {
	x.Prefix = prefix
	return x
}

// AsAttribute flags this object as xml attribute
func (x *XMLObject) AsAttribute() *XMLObject {
	x.Attribute = true
	return x
}

// AsElement flags this object as an xml node
func (x *XMLObject) AsElement() *XMLObject {
	x.Attribute = false
	return x
}

// AsWrapped flags this object as wrapped, this is mostly useful for array types
func (x *XMLObject) AsWrapped() *XMLObject {
	x.Wrapped = true
	return x
}

// AsUnwrapped flags this object as an xml node
func (x *XMLObject) AsUnwrapped() *XMLObject {
	x.Wrapped = false
	return x
}
