package resource

import (
	"context"
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// UpdateObject ensures an object is updated by calling Get on the provided client to get the current state of the object,
// then runs updateFunc on it to update it, and finally calls UpdateInto with the updated object and provided config,
// using the ResourceVersion of the updated object. If the update fails due to a 409/Conflict, it will retry the whole process up to two times.
func UpdateObject[T Object](ctx context.Context, client Client, identifier Identifier, updateFunc func(obj T, isRetry bool) (T, error), opts UpdateOptions) (T, error) {
	var empty T
	if client == nil {
		return empty, errors.New("client must not be nil")
	}
	if updateFunc == nil {
		return empty, errors.New("updateFunc must not be nil")
	}
	rawObj, err := client.Get(ctx, identifier)
	if err != nil {
		return empty, err
	}
	obj, ok := rawObj.(T)
	if !ok {
		return empty, errors.New("unable to cast Object into provided type")
	}

	doUpdate := func(obj T, isRetry bool) (T, error) {
		obj, err = updateFunc(obj, isRetry)
		if err != nil {
			return empty, err
		}
		if obj.GetResourceVersion() == "" {
			return empty, ErrMissingResourceVersion
		}
		err = client.UpdateInto(ctx, identifier, obj, UpdateOptions{
			ResourceVersion: obj.GetResourceVersion(),
			Subresource:     opts.Subresource,
			DryRun:          opts.DryRun,
		}, obj)
		return obj, err
	}
	obj, err = doUpdate(obj, false)
	retries := 0
	for err != nil && apierrors.IsConflict(err) && retries < 2 {
		retries++
		err = client.GetInto(ctx, identifier, obj)
		if err != nil {
			return empty, err
		}
		obj, err = doUpdate(obj, true)
	}
	if err != nil {
		return empty, err
	}
	return obj, nil
}
