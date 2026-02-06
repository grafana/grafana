package ast

import (
	"encoding/json"
)

func UnmarshalSelectionSet(b []byte) (SelectionSet, error) {
	var tmp []json.RawMessage

	if err := json.Unmarshal(b, &tmp); err != nil {
		return nil, err
	}

	result := make([]Selection, 0)
	for _, item := range tmp {
		var field Field
		if err := json.Unmarshal(item, &field); err == nil {
			result = append(result, &field)
			continue
		}
		var fragmentSpread FragmentSpread
		if err := json.Unmarshal(item, &fragmentSpread); err == nil {
			result = append(result, &fragmentSpread)
			continue
		}
		var inlineFragment InlineFragment
		if err := json.Unmarshal(item, &inlineFragment); err == nil {
			result = append(result, &inlineFragment)
			continue
		}
	}

	return result, nil
}

func (f *FragmentDefinition) UnmarshalJSON(b []byte) error {
	var tmp map[string]json.RawMessage
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	for k := range tmp {
		switch k {
		case "Name":
			err := json.Unmarshal(tmp[k], &f.Name)
			if err != nil {
				return err
			}
		case "VariableDefinition":
			err := json.Unmarshal(tmp[k], &f.VariableDefinition)
			if err != nil {
				return err
			}
		case "TypeCondition":
			err := json.Unmarshal(tmp[k], &f.TypeCondition)
			if err != nil {
				return err
			}
		case "Directives":
			err := json.Unmarshal(tmp[k], &f.Directives)
			if err != nil {
				return err
			}
		case "SelectionSet":
			ss, err := UnmarshalSelectionSet(tmp[k])
			if err != nil {
				return err
			}
			f.SelectionSet = ss
		case "Definition":
			err := json.Unmarshal(tmp[k], &f.Definition)
			if err != nil {
				return err
			}
		case "Position":
			err := json.Unmarshal(tmp[k], &f.Position)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (f *InlineFragment) UnmarshalJSON(b []byte) error {
	var tmp map[string]json.RawMessage
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	for k := range tmp {
		switch k {
		case "TypeCondition":
			err := json.Unmarshal(tmp[k], &f.TypeCondition)
			if err != nil {
				return err
			}
		case "Directives":
			err := json.Unmarshal(tmp[k], &f.Directives)
			if err != nil {
				return err
			}
		case "SelectionSet":
			ss, err := UnmarshalSelectionSet(tmp[k])
			if err != nil {
				return err
			}
			f.SelectionSet = ss
		case "ObjectDefinition":
			err := json.Unmarshal(tmp[k], &f.ObjectDefinition)
			if err != nil {
				return err
			}
		case "Position":
			err := json.Unmarshal(tmp[k], &f.Position)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (f *OperationDefinition) UnmarshalJSON(b []byte) error {
	var tmp map[string]json.RawMessage
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	for k := range tmp {
		switch k {
		case "Operation":
			err := json.Unmarshal(tmp[k], &f.Operation)
			if err != nil {
				return err
			}
		case "Name":
			err := json.Unmarshal(tmp[k], &f.Name)
			if err != nil {
				return err
			}
		case "VariableDefinitions":
			err := json.Unmarshal(tmp[k], &f.VariableDefinitions)
			if err != nil {
				return err
			}
		case "Directives":
			err := json.Unmarshal(tmp[k], &f.Directives)
			if err != nil {
				return err
			}
		case "SelectionSet":
			ss, err := UnmarshalSelectionSet(tmp[k])
			if err != nil {
				return err
			}
			f.SelectionSet = ss
		case "Position":
			err := json.Unmarshal(tmp[k], &f.Position)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (f *Field) UnmarshalJSON(b []byte) error {
	var tmp map[string]json.RawMessage
	if err := json.Unmarshal(b, &tmp); err != nil {
		return err
	}
	for k := range tmp {
		switch k {
		case "Alias":
			err := json.Unmarshal(tmp[k], &f.Alias)
			if err != nil {
				return err
			}
		case "Name":
			err := json.Unmarshal(tmp[k], &f.Name)
			if err != nil {
				return err
			}
		case "Arguments":
			err := json.Unmarshal(tmp[k], &f.Arguments)
			if err != nil {
				return err
			}
		case "Directives":
			err := json.Unmarshal(tmp[k], &f.Directives)
			if err != nil {
				return err
			}
		case "SelectionSet":
			ss, err := UnmarshalSelectionSet(tmp[k])
			if err != nil {
				return err
			}
			f.SelectionSet = ss
		case "Position":
			err := json.Unmarshal(tmp[k], &f.Position)
			if err != nil {
				return err
			}
		case "Definition":
			err := json.Unmarshal(tmp[k], &f.Definition)
			if err != nil {
				return err
			}
		case "ObjectDefinition":
			err := json.Unmarshal(tmp[k], &f.ObjectDefinition)
			if err != nil {
				return err
			}
		}
	}
	return nil
}
