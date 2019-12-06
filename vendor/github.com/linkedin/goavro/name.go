// Copyright [2017] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"errors"
	"fmt"
	"strings"
)

const nullNamespace = ""

// ErrInvalidName is the error returned when one or more parts of an Avro name
// is invalid.
type ErrInvalidName struct {
	Message string
}

func (e ErrInvalidName) Error() string {
	return "schema name ought to " + e.Message
}

// NOTE: This function designed to work with name components, after they have
// been split on the period rune.
func isRuneInvalidForFirstCharacter(r rune) bool {
	return (r < 'A' || r > 'Z') && (r < 'a' || r > 'z') && r != '_'
}

func isRuneInvalidForOtherCharacters(r rune) bool {
	return isRuneInvalidForFirstCharacter(r) && (r < '0' || r > '9')
}

func checkNameComponent(s string) error {
	err := checkString(s)
	if err != nil {
		return &ErrInvalidName{err.Error()}
	}
	return err
}

func checkString(s string) error {
	if len(s) == 0 {
		return errors.New("be non-empty string")
	}
	if strings.IndexFunc(s[:1], isRuneInvalidForFirstCharacter) != -1 {
		return errors.New("start with [A-Za-z_]: " + s)
	}
	if strings.IndexFunc(s[1:], isRuneInvalidForOtherCharacters) != -1 {
		return errors.New("have second and remaining characters contain only [A-Za-z0-9_]: " + s)
	}
	return nil
}

// name describes an Avro name in terms of its full name and namespace.
type name struct {
	fullName  string // the instance's Avro name
	namespace string // for use when building new name from existing one
}

// newName returns a new Name instance after first ensuring the arguments do not
// violate any of the Avro naming rules.
func newName(n, ns, ens string) (*name, error) {
	var nn name

	if index := strings.LastIndexByte(n, '.'); index > -1 {
		// inputName does contain a dot, so ignore everything else and use it as the full name
		nn.fullName = n
		nn.namespace = n[:index]
	} else {
		// inputName does not contain a dot, therefore is not the full name
		if ns != nullNamespace {
			// if namespace provided in the schema in the same schema level, use it
			nn.fullName = ns + "." + n
			nn.namespace = ns
		} else if ens != nullNamespace {
			// otherwise if enclosing namespace provided, use it
			nn.fullName = ens + "." + n
			nn.namespace = ens
		} else {
			// otherwise no namespace, so use null namespace, the empty string
			nn.fullName = n
		}
	}

	// verify all components of the full name for adherence to Avro naming rules
	for i, component := range strings.Split(nn.fullName, ".") {
		if i == 0 && RelaxedNameValidation && component == "" {
			continue
		}
		if err := checkNameComponent(component); err != nil {
			return nil, err
		}
	}

	return &nn, nil
}

var (
	// RelaxedNameValidation causes name validation to allow the first component
	// of an Avro namespace to be the empty string.
	RelaxedNameValidation bool
)

func newNameFromSchemaMap(enclosingNamespace string, schemaMap map[string]interface{}) (*name, error) {
	var nameString, namespaceString string

	name, ok := schemaMap["name"]
	if !ok {
		return nil, errors.New("schema ought to have name key")
	}
	nameString, ok = name.(string)
	if !ok || nameString == nullNamespace {
		return nil, fmt.Errorf("schema name ought to be non-empty string; received: %T", name)
	}
	namespace, ok := schemaMap["namespace"]
	if ok {
		namespaceString, ok = namespace.(string)
		if !ok || namespaceString == nullNamespace {
			return nil, fmt.Errorf("schema namespace, if provided, ought to be non-empty string; received: %T", namespace)
		}
	}

	return newName(nameString, namespaceString, enclosingNamespace)
}

func (n *name) String() string {
	return n.fullName
}

// short returns the name without the prefixed namespace.
func (n *name) short() string {
	if index := strings.LastIndexByte(n.fullName, '.'); index > -1 {
		return n.fullName[index+1:]
	}
	return n.fullName
}
