// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"bytes"
	"encoding/json"
	"reflect"
	"sort"
)

// OrderSchemaItem holds a named schema (e.g. from a property of an object)
type OrderSchemaItem struct {
	Schema

	Name string
}

// OrderSchemaItems is a sortable slice of named schemas.
// The ordering is defined by the x-order schema extension.
type OrderSchemaItems []OrderSchemaItem

// MarshalJSON produces a json object with keys defined by the name schemas
// of the OrderSchemaItems slice, keeping the original order of the slice.
func (items OrderSchemaItems) MarshalJSON() ([]byte, error) {
	buf := bytes.NewBuffer(nil)
	buf.WriteByte('{')

	if len(items) == 0 {
		buf.WriteByte('}')

		return buf.Bytes(), nil
	}

	if err := items.marshalJSONItem(items[0], buf); err != nil {
		return nil, err
	}

	for _, item := range items[1:] {
		buf.WriteByte(',')
		if err := items.marshalJSONItem(item, buf); err != nil {
			return nil, err
		}
	}
	buf.WriteByte('}')

	return buf.Bytes(), nil
}

func (items OrderSchemaItems) Len() int      { return len(items) }
func (items OrderSchemaItems) Swap(i, j int) { items[i], items[j] = items[j], items[i] }
func (items OrderSchemaItems) Less(i, j int) (ret bool) {
	ii, oki := items[i].Extensions.GetInt("x-order")
	ij, okj := items[j].Extensions.GetInt("x-order")
	if oki {
		if okj {
			defer func() {
				if err := recover(); err != nil {
					defer func() {
						if err = recover(); err != nil {
							ret = items[i].Name < items[j].Name
						}
					}()
					ret = reflect.ValueOf(ii).String() < reflect.ValueOf(ij).String()
				}
			}()
			return ii < ij
		}
		return true
	} else if okj {
		return false
	}
	return items[i].Name < items[j].Name
}

func (items OrderSchemaItems) marshalJSONItem(item OrderSchemaItem, output *bytes.Buffer) error {
	nameJSON, err := json.Marshal(item.Name)
	if err != nil {
		return err
	}
	output.Write(nameJSON)
	output.WriteByte(':')
	schemaJSON, err := json.Marshal(&item.Schema)
	if err != nil {
		return err
	}
	output.Write(schemaJSON)

	return nil
}

// SchemaProperties is a map representing the properties of a Schema object.
// It knows how to transform its keys into an ordered slice.
type SchemaProperties map[string]Schema

// ToOrderedSchemaItems transforms the map of properties into a sortable slice
func (properties SchemaProperties) ToOrderedSchemaItems() OrderSchemaItems {
	items := make(OrderSchemaItems, 0, len(properties))
	for k, v := range properties {
		items = append(items, OrderSchemaItem{
			Name:   k,
			Schema: v,
		})
	}
	sort.Sort(items)
	return items
}

// MarshalJSON produces properties as json, keeping their order.
func (properties SchemaProperties) MarshalJSON() ([]byte, error) {
	if properties == nil {
		return []byte("null"), nil
	}
	return json.Marshal(properties.ToOrderedSchemaItems())
}
