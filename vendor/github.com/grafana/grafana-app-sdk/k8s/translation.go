package k8s

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"

	admission "k8s.io/api/admission/v1beta1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"
)

type k8sListWithItems struct {
	metav1.TypeMeta `json:",inline"`
	Metadata        metav1.ListMeta   `json:"metadata"`
	Items           []json.RawMessage `json:"items"`
}

//nolint:staticcheck
func rawToListWithParser(raw []byte, into resource.ListObject, itemParser func([]byte) (resource.Object, error)) error {
	um := k8sListWithItems{}
	err := json.Unmarshal(raw, &um)
	if err != nil {
		return err
	}
	// Attempt to parse all items in the list before setting the parsed metadata,
	// as the parser could return an error, and we don't want to _partially_ unmarshal the list (just metadata) into `into`
	items := make([]resource.Object, 0)
	for _, item := range um.Items {
		parsed, err := itemParser(item)
		if err != nil {
			return err
		}
		items = append(items, parsed)
	}
	into.SetResourceVersion(um.Metadata.ResourceVersion)
	into.SetGroupVersionKind(um.GroupVersionKind())
	into.SetSelfLink(um.Metadata.SelfLink)
	into.SetContinue(um.Metadata.Continue)
	into.SetRemainingItemCount(um.Metadata.GetRemainingItemCount())
	into.SetItems(items)
	return nil
}

var metaV1Fields = getV1ObjectMetaFields()

func marshalJSONPatch(patch resource.PatchRequest) ([]byte, error) {
	// Correct for differing metadata paths in kubernetes
	for idx, op := range patch.Operations {
		// We don't allow a patch on the metadata object as a whole
		if op.Path == "/metadata" {
			return nil, errors.New("cannot patch entire metadata object")
		}

		// We only need to (possibly) correct patch operations for the metadata
		if len(op.Path) < len("/metadata/") || op.Path[:len("/metadata/")] != "/metadata/" {
			continue
		}
		// If the next part of the path isn't a key in metav1.ObjectMeta, then we put it in annotations
		parts := strings.Split(strings.Trim(op.Path, "/"), "/")
		if len(parts) <= 1 {
			return nil, errors.New("invalid patch path")
		}
		if _, ok := metaV1Fields[parts[1]]; ok {
			// Normal kube metadata
			continue
		}
		// UNLESS it's extraFields, which holds implementation-specific extra fields
		if parts[1] == "extraFields" {
			if len(parts) < 3 {
				return nil, errors.New("cannot patch entire extraFields, please patch fields in extraFields instead")
			}
			// Just take the remaining part of the path and put it after /metadata
			// If it's not a valid kubernetes metadata object, that's because the user has done something funny with extraFields,
			// and it wouldn't be properly encoded/decoded by the translator anyway
			op.Path = "/metadata/" + strings.Join(parts[2:], "/")
		} else {
			// Otherwise, update the path to be in annotations, as that's where all the custom and non-kubernetes common metadata goes
			// We just have to prefic the remaining part of the path with the AnnotationPrefix
			// And replace '/' with '~1' for encoding into a patch path
			endPart := strings.Join(parts[1:], "~1") // If there were slashes, we need to encode them
			op.Path = fmt.Sprintf("/metadata/annotations/%s%s", strings.ReplaceAll(AnnotationPrefix, "/", "~1"), endPart)
			if op.Operation == resource.PatchOpReplace {
				op.Operation = resource.PatchOpAdd // We change this for safety--they behave the same within a map, but if they key is absent, replace won't work
			}
		}
		patch.Operations[idx] = op
	}
	return json.Marshal(patch.Operations)
}

func getV1ObjectMetaFields() map[string]struct{} {
	fields := make(map[string]struct{})
	typ := reflect.TypeOf(metav1.ObjectMeta{})
	for i := 0; i < typ.NumField(); i++ {
		jsonTag := typ.Field(i).Tag.Get("json")
		if len(jsonTag) == 0 || jsonTag[0] == '-' || jsonTag[0] == ',' {
			continue
		}
		if idx := strings.Index(jsonTag, ","); idx > 0 {
			jsonTag = jsonTag[:idx]
		}
		fields[jsonTag] = struct{}{}
	}
	return fields
}

func unmarshalKubernetesAdmissionReview(raw []byte, format resource.WireFormat) (*admission.AdmissionReview, error) {
	if format != resource.WireFormatJSON {
		return nil, fmt.Errorf("unsupported WireFormat '%s'", fmt.Sprint(format))
	}

	rev := admission.AdmissionReview{}
	err := json.Unmarshal(raw, &rev)
	if err != nil {
		return nil, err
	}
	return &rev, nil
}

func translateKubernetesAdmissionRequest(req *admission.AdmissionRequest, sch resource.Kind) (*resource.AdmissionRequest, error) {
	var err error
	var obj, old resource.Object

	if len(req.Object.Raw) > 0 {
		obj, err = sch.Read(bytes.NewReader(req.Object.Raw), resource.KindEncodingJSON)
		if err != nil {
			return nil, err
		}
	}
	if len(req.OldObject.Raw) > 0 {
		old, err = sch.Read(bytes.NewReader(req.OldObject.Raw), resource.KindEncodingJSON)
		if err != nil {
			return nil, err
		}
	}

	var action resource.AdmissionAction
	switch req.Operation {
	case admission.Create:
		action = resource.AdmissionActionCreate
	case admission.Update:
		action = resource.AdmissionActionUpdate
	case admission.Delete:
		action = resource.AdmissionActionDelete
	case admission.Connect:
		action = resource.AdmissionActionConnect
	default:
	}

	return &resource.AdmissionRequest{
		Action:  action,
		Kind:    req.Kind.Kind,
		Group:   req.Kind.Group,
		Version: req.Kind.Version,
		UserInfo: resource.AdmissionUserInfo{
			Username: req.UserInfo.Username,
			UID:      req.UserInfo.UID,
			Groups:   req.UserInfo.Groups,
		},
		Object:    obj,
		OldObject: old,
	}, nil
}
