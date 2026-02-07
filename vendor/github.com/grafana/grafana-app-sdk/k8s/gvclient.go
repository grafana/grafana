package k8s

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

const (
	versionLabel = "grafana-app-sdk-resource-version"

	// AnnotationPrefix is the prefix used in annotations which contain grafana kind metadata
	AnnotationPrefix = "grafana.com/"
)

// groupVersionClient is the underlying client both Client and SchemalessClient use.
// GroupVersion is the unit with which kubernetes rest.Interface clients exist, so at minimum,
// we require one rest.Interface for each unique GroupVersion.
type groupVersionClient struct {
	client           rest.Interface
	version          string
	config           ClientConfig
	requestDurations *prometheus.HistogramVec
	totalRequests    *prometheus.CounterVec
	watchEventsTotal *prometheus.CounterVec
	watchErrorsTotal *prometheus.CounterVec
}

func (g *groupVersionClient) get(ctx context.Context, identifier resource.Identifier, plural string,
	into resource.Object, codec resource.Codec) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-get")
	defer span.End()
	sc := 0
	request := g.client.Get().Resource(plural).Name(identifier.Name)
	if strings.TrimSpace(identifier.Namespace) != "" {
		request = request.Namespace(identifier.Namespace)
	}
	logging.FromContext(ctx).Debug("executing kubernetes get request", "method", "GET", "url", request.URL().String())
	start := time.Now()
	raw, err := request.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "GET", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodGet),
		attribute.String("server.address", request.URL().Hostname()),
		attribute.String("server.port", request.URL().Port()),
		attribute.String("url.full", request.URL().String()),
	)
	g.incRequestCounter(sc, "GET", plural, "spec")
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = codec.Read(bytes.NewReader(raw), into)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
	}
	return err
}

type metadataObject struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata"`
}

// dryRun=All

func (g *groupVersionClient) getMetadata(ctx context.Context, identifier resource.Identifier, plural string) (
	*metadataObject, error) {
	ctx, span := GetTracer().Start(ctx, "kubernetes-getmetadata")
	defer span.End()
	sc := 0
	request := g.client.Get().Resource(plural).Name(identifier.Name)
	if strings.TrimSpace(identifier.Namespace) != "" {
		request = request.Namespace(identifier.Namespace)
	}
	logging.FromContext(ctx).Debug("executing kubernetes get request", "method", "GET", "url", request.URL().String())
	start := time.Now()
	raw, err := request.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "GET", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodGet),
		attribute.String("server.address", request.URL().Hostname()),
		attribute.String("server.port", request.URL().Port()),
		attribute.String("url.full", request.URL().String()),
	)
	g.incRequestCounter(sc, "GET", plural, "spec")
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	md := metadataObject{}
	err = json.Unmarshal(raw, &md)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("unable to unmarshal request body: %s", err.Error()))
		return nil, err
	}
	return &md, nil
}

//nolint:unused
func (g *groupVersionClient) exists(ctx context.Context, identifier resource.Identifier, plural string) (
	bool, error) {
	ctx, span := GetTracer().Start(ctx, "kubernetes-exists")
	defer span.End()
	statusCode := 0
	request := g.client.Get().Resource(plural).Name(identifier.Name)
	if strings.TrimSpace(identifier.Namespace) != "" {
		request = request.Namespace(identifier.Namespace)
	}
	start := time.Now()
	err := request.Do(ctx).StatusCode(&statusCode).Error()
	g.logRequestDuration(time.Since(start), statusCode, "GET", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", statusCode),
		attribute.String("http.request.method", http.MethodGet),
		attribute.String("server.address", request.URL().Hostname()),
		attribute.String("server.port", request.URL().Port()),
		attribute.String("url.full", request.URL().String()),
	)
	g.incRequestCounter(statusCode, "GET", plural, "spec")
	if err != nil {
		// Ignore not found errors.
		if statusCode == http.StatusNotFound {
			return false, nil
		}

		span.SetStatus(codes.Error, err.Error())
		return false, ParseKubernetesError(nil, statusCode, err)
	}
	return true, nil
}

func (g *groupVersionClient) create(
	ctx context.Context,
	plural string,
	obj resource.Object,
	into resource.Object,
	opts resource.CreateOptions,
	codec resource.Codec,
) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-create")
	defer span.End()
	addLabels(obj, map[string]string{
		versionLabel: g.version,
	})
	buf := &bytes.Buffer{}
	err := codec.Write(buf, obj)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("error marshaling kubernetes JSON: %s", err.Error()))
		return err
	}

	sc := 0
	request := g.client.Post().Resource(plural).Body(buf.Bytes())
	if strings.TrimSpace(obj.GetNamespace()) != "" {
		request = request.Namespace(obj.GetNamespace())
	}

	if opts.DryRun {
		request = request.Param("dryRun", "All")
	}
	logging.FromContext(ctx).Debug("executing kubernetes create request", "method", "POST", "url", request.URL().String())

	start := time.Now()
	raw, err := request.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "CREATE", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodPost),
		attribute.String("server.address", request.URL().Hostname()),
		attribute.String("server.port", request.URL().Port()),
		attribute.String("url.full", request.URL().String()),
	)
	g.incRequestCounter(sc, "CREATE", plural, "spec")
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = codec.Read(bytes.NewReader(raw), into)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("unable to convert kubernetes response to resource: %s", err.Error()))
		return err
	}
	return nil
}

func (g *groupVersionClient) update(
	ctx context.Context,
	plural string,
	obj resource.Object,
	into resource.Object,
	opts resource.UpdateOptions,
	codec resource.Codec,
) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-update")
	defer span.End()
	addLabels(obj, map[string]string{
		versionLabel: g.version,
	})
	buf := &bytes.Buffer{}
	err := codec.Write(buf, obj)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("error marshaling kubernetes JSON: %s", err.Error()))
		return err
	}

	req := g.client.Put().Resource(plural).
		Name(obj.GetName()).Body(buf.Bytes())
	if strings.TrimSpace(obj.GetNamespace()) != "" {
		req = req.Namespace(obj.GetNamespace())
	}
	if opts.DryRun {
		req = req.Param("dryRun", "All")
	}
	logging.FromContext(ctx).Debug("executing kubernetes update request", "method", "PUT", "url", req.URL().String())
	sc := 0
	start := time.Now()
	raw, err := req.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "UPDATE", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodPut),
		attribute.String("server.address", req.URL().Hostname()),
		attribute.String("server.port", req.URL().Port()),
		attribute.String("url.full", req.URL().String()),
	)
	g.incRequestCounter(sc, "UPDATE", plural, "spec")
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = codec.Read(bytes.NewReader(raw), into)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("unable to convert kubernetes response to resource: %s", err.Error()))
		return err
	}
	return nil
}

func (g *groupVersionClient) updateSubresource(
	ctx context.Context,
	plural, subresource string,
	obj resource.Object,
	into resource.Object,
	opts resource.UpdateOptions,
	codec resource.Codec,
) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-update-subresource")
	defer span.End()
	addLabels(obj, map[string]string{
		versionLabel: g.version,
	})
	buf := &bytes.Buffer{}
	err := codec.Write(buf, obj)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("error marshaling kubernetes JSON: %s", err.Error()))
		return err
	}

	req := g.client.Put().Resource(plural).SubResource(subresource).
		Name(obj.GetName()).Body(buf.Bytes())
	if strings.TrimSpace(obj.GetNamespace()) != "" {
		req = req.Namespace(obj.GetNamespace())
	}

	if opts.DryRun {
		req = req.Param("dryRun", "All")
	}
	logging.FromContext(ctx).Debug("executing kubernetes update subresource request", "method", "PUT", "url", req.URL().String())

	sc := 0
	start := time.Now()
	raw, err := req.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "UPDATE", plural, subresource)
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodPut),
		attribute.String("server.address", req.URL().Hostname()),
		attribute.String("server.port", req.URL().Port()),
		attribute.String("url.full", req.URL().String()),
	)
	g.incRequestCounter(sc, "UPDATE", plural, subresource)
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = codec.Read(bytes.NewReader(raw), into)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("unable to convert kubernetes response to resource: %s", err.Error()))
		return err
	}
	return nil
}

//nolint:revive,unused
func (g *groupVersionClient) patch(
	ctx context.Context,
	identifier resource.Identifier,
	plural string,
	patch resource.PatchRequest,
	into resource.Object,
	opts resource.PatchOptions,
	codec resource.Codec,
) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-patch")
	defer span.End()
	patchBytes, err := marshalJSONPatch(patch)
	if err != nil {
		return err
	}
	sr := "spec"
	req := g.client.Patch(types.JSONPatchType).Resource(plural)
	if opts.Subresource != "" {
		req = req.SubResource(opts.Subresource)
		sr = opts.Subresource
	}
	req = req.Name(identifier.Name).Body(patchBytes)
	if strings.TrimSpace(identifier.Namespace) != "" {
		req = req.Namespace(identifier.Namespace)
	}
	if opts.DryRun {
		req = req.Param("dryRun", "All")
	}
	logging.FromContext(ctx).Debug("executing kubernetes patch request", "method", "PATCH", "url", req.URL().String())
	sc := 0
	start := time.Now()
	raw, err := req.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "PATCH", plural, sr)
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodPatch),
		attribute.String("server.address", req.URL().Hostname()),
		attribute.String("server.port", req.URL().Port()),
		attribute.String("url.full", req.URL().String()),
	)
	g.incRequestCounter(sc, "PATCH", plural, sr)
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	err = codec.Read(bytes.NewReader(raw), into)
	if err != nil {
		span.SetStatus(codes.Error, fmt.Sprintf("unable to convert kubernetes response to resource: %s", err.Error()))
		return err
	}
	return nil
}

func (g *groupVersionClient) delete(ctx context.Context, identifier resource.Identifier, plural string, options resource.DeleteOptions) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-delete")
	defer span.End()
	sc := 0
	request := g.client.Delete().Resource(plural).Name(identifier.Name)
	if strings.TrimSpace(identifier.Namespace) != "" {
		request = request.Namespace(identifier.Namespace)
	}
	deleteOptions := metav1.DeleteOptions{
		TypeMeta: metav1.TypeMeta{
			Kind:       "DeleteOptions",
			APIVersion: "meta.k8s.io/v1",
		},
	}
	if options.Preconditions.ResourceVersion != "" || options.Preconditions.UID != "" {
		deleteOptions.Preconditions = &metav1.Preconditions{}
		if options.Preconditions.ResourceVersion != "" {
			deleteOptions.Preconditions.ResourceVersion = &options.Preconditions.ResourceVersion
		}
		if options.Preconditions.UID != "" {
			uid := types.UID(options.Preconditions.UID)
			deleteOptions.Preconditions.UID = &uid
		}
	}
	if options.PropagationPolicy != "" {
		policy := metav1.DeletionPropagation(options.PropagationPolicy)
		deleteOptions.PropagationPolicy = &policy
	}
	if deleteOptions.Preconditions != nil || deleteOptions.PropagationPolicy != nil {
		opts, err := json.Marshal(deleteOptions)
		if err != nil {
			return fmt.Errorf("unable to marshal delete options: %s", err.Error())
		}
		request = request.Body(opts)
	}
	logging.FromContext(ctx).Debug("executing kubernetes delete request", "method", "DELETE", "url", request.URL().String())
	start := time.Now()
	err := request.Do(ctx).StatusCode(&sc).Error()
	g.logRequestDuration(time.Since(start), sc, "DELETE", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodDelete),
		attribute.String("server.address", request.URL().Hostname()),
		attribute.String("server.port", request.URL().Port()),
		attribute.String("url.full", request.URL().String()),
	)
	g.incRequestCounter(sc, "DELETE", plural, "spec")
	if err != nil && sc >= 300 {
		return ParseKubernetesError(nil, sc, err)
	}
	return err
}

func (g *groupVersionClient) list(ctx context.Context, namespace, plural string, into resource.ListObject,
	options resource.ListOptions, itemParser func([]byte) (resource.Object, error)) error {
	ctx, span := GetTracer().Start(ctx, "kubernetes-list")
	defer span.End()
	req := g.client.Get().Resource(plural)
	if strings.TrimSpace(namespace) != "" {
		req = req.Namespace(namespace)
	}
	if len(options.LabelFilters) > 0 {
		req = req.Param("labelSelector", strings.Join(options.LabelFilters, ","))
	}
	if len(options.FieldSelectors) > 0 {
		req = req.Param("fieldSelector", strings.Join(options.FieldSelectors, ","))
	}
	if options.Limit > 0 {
		req = req.Param("limit", strconv.Itoa(options.Limit))
	}
	if options.Continue != "" {
		req = req.Param("continue", options.Continue)
	}
	if options.ResourceVersion != "" {
		req = req.Param("resourceVersion", options.ResourceVersion)
	}
	logging.FromContext(ctx).Debug("executing kubernetes list request", "method", "GET", "url", req.URL().String())
	sc := 0
	start := time.Now()
	raw, err := req.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, "LIST", plural, "spec")
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodGet),
		attribute.String("server.address", req.URL().Hostname()),
		attribute.String("server.port", req.URL().Port()),
		attribute.String("url.full", req.URL().String()),
	)
	g.incRequestCounter(sc, "LIST", plural, "spec")
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	return rawToListWithParser(raw, into, itemParser)
}

func (g *groupVersionClient) customRouteRequest(ctx context.Context, namespace, plural, name string, request resource.CustomRouteRequestOptions) ([]byte, error) {
	ctx, span := GetTracer().Start(ctx, "kubernetes-custom-route")
	defer span.End()
	req := g.client.Verb(request.Verb)
	if plural != "" {
		sr := request.Path
		for len(sr) > 0 && sr[0] == '/' {
			sr = sr[1:]
		}
		req = req.Resource(plural).Name(name).SubResource(sr)
	} else {
		req = req.Resource(request.Path)
	}
	if namespace != "" {
		req = req.Namespace(namespace)
	}
	if request.Body != nil {
		req.Body(request.Body)
	}
	for k, v := range request.Query {
		for _, vv := range v {
			req = req.Param(k, vv)
		}
	}
	for k, v := range request.Headers {
		req = req.SetHeader(k, v...)
	}
	logging.FromContext(ctx).Debug("executing kubernetes custom route request", "method", request.Verb, "url", req.URL().String())
	sc := 0
	start := time.Now()
	raw, err := req.Do(ctx).StatusCode(&sc).Raw()
	g.logRequestDuration(time.Since(start), sc, request.Verb, plural, request.Path)
	span.SetAttributes(
		attribute.Int("http.response.status_code", sc),
		attribute.String("http.request.method", http.MethodGet),
		attribute.String("server.address", req.URL().Hostname()),
		attribute.String("server.port", req.URL().Port()),
		attribute.String("url.full", req.URL().String()),
	)
	g.incRequestCounter(sc, request.Verb, plural, request.Path)
	if err != nil {
		err = ParseKubernetesError(raw, sc, err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	return raw, nil
}

//nolint:revive
func (g *groupVersionClient) watch(ctx context.Context, namespace, plural string,
	exampleObject resource.Object, options resource.WatchOptions, codec resource.Codec) (*WatchResponse, error) {
	ctx, span := GetTracer().Start(ctx, "kubernetes-watch")
	defer span.End()
	g.client.Get()
	req := g.client.Get().Resource(plural).
		Param("watch", "1")
	if strings.TrimSpace(namespace) != "" {
		req = req.Namespace(namespace)
	}
	if len(options.LabelFilters) > 0 {
		req = req.Param("labelSelector", strings.Join(options.LabelFilters, ","))
	}
	if len(options.FieldSelectors) > 0 {
		req = req.Param("fieldSelector", strings.Join(options.FieldSelectors, ","))
	}
	if options.ResourceVersion != "" {
		req = req.Param("resourceVersion", options.ResourceVersion)
	}
	if options.ResourceVersionMatch != "" {
		req = req.Param("resourceVersionMatch", options.ResourceVersionMatch)
	}
	if options.AllowWatchBookmarks {
		req = req.Param("allowWatchBookmarks", "true")
	}
	if options.TimeoutSeconds != nil {
		req = req.Param("timeoutSeconds", fmt.Sprintf("%d", *options.TimeoutSeconds))
	}
	if options.SendInitialEvents != nil {
		req = req.Param("sendInitialEvents", strconv.FormatBool(*options.SendInitialEvents))
	}
	logging.FromContext(ctx).Debug("executing kubernetes watch request", "method", "GET", "url", req.URL().String())
	resp, err := req.Watch(ctx)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	span.SetAttributes(
		attribute.Int("http.response.status_code", http.StatusOK),
		attribute.String("http.request.method", http.MethodGet),
		attribute.String("server.address", req.URL().Hostname()),
		attribute.String("server.port", req.URL().Port()),
		attribute.String("url.full", req.URL().String()),
	)
	g.incRequestCounter(http.StatusOK, "WATCH", plural, "spec")
	channelBufferSize := options.EventBufferSize
	if channelBufferSize <= 0 {
		channelBufferSize = 1
	}
	w := &WatchResponse{
		ex:               exampleObject,
		codec:            codec,
		watch:            resp,
		ch:               make(chan resource.WatchEvent, channelBufferSize),
		stopCh:           make(chan struct{}),
		ctx:              ctx,
		namespace:        namespace,
		plural:           plural,
		watchEventsTotal: g.watchEventsTotal,
		watchErrorsTotal: g.watchErrorsTotal,
	}
	return w, nil
}

func (g *groupVersionClient) incRequestCounter(statusCode int, verb, kind, subresource string) {
	if g.totalRequests == nil {
		return
	}

	g.totalRequests.WithLabelValues(strconv.Itoa(statusCode), verb, kind, subresource).Inc()
}

func (g *groupVersionClient) logRequestDuration(dur time.Duration, statusCode int, verb, kind, subresource string) {
	if g.requestDurations == nil {
		return
	}

	g.requestDurations.WithLabelValues(strconv.Itoa(statusCode), verb, kind, subresource).Observe(dur.Seconds())
}

func (g *groupVersionClient) metrics() []prometheus.Collector {
	return []prometheus.Collector{
		g.totalRequests, g.requestDurations, g.watchEventsTotal, g.watchErrorsTotal,
	}
}

// WatchResponse wraps a kubernetes watch.Interface in order to implement resource.WatchResponse.
// The underlying watch.Interface can be accessed with KubernetesWatch().
type WatchResponse struct {
	watch            watch.Interface
	ch               chan resource.WatchEvent
	stopCh           chan struct{}
	ex               resource.Object
	codec            resource.Codec
	started          bool
	startMux         sync.Mutex
	ctx              context.Context
	namespace        string
	plural           string
	watchEventsTotal *prometheus.CounterVec
	watchErrorsTotal *prometheus.CounterVec
}

//nolint:revive,staticcheck,gocritic
func (w *WatchResponse) start() {
	logger := logging.FromContext(w.ctx).With(
		"kind", w.plural,
		"namespace", w.namespace,
	)
	logger.Debug("watch stream started")

	for {
		select {
		case evt := <-w.watch.ResultChan():
			if evt.Object == nil {
				logger.Warn("received nil object in watch event",
					"eventType", string(evt.Type))
				w.incWatchErrorCounter("nil_object")
				break
			}
			var obj resource.Object
			if cast, ok := evt.Object.(resource.Object); ok {
				obj = cast
			} else if cast, ok := evt.Object.(intoObject); ok {
				obj = w.ex.Copy()
				err := cast.Into(obj, w.codec)
				if err != nil {
					logger.Error("failed to translate watch event using Into() method",
						"error", err,
						"eventType", string(evt.Type),
						"groupVersionKind", evt.Object.GetObjectKind().GroupVersionKind().String())
					w.incWatchErrorCounter("translation_error")
					break
				}
			} else if cast, ok := evt.Object.(wrappedObject); ok {
				obj = cast.ResourceObject()
			} else {
				logger.Error(
					"unable to parse watch event object, does not implement resource.Object or have Into() or ResourceObject(). Please check your NegotiatedSerializer",
					"eventType", string(evt.Type),
					"groupVersionKind", evt.Object.GetObjectKind().GroupVersionKind().String())
				w.incWatchErrorCounter("unparseable_object")
				break
			}

			logger.Debug("received watch event",
				"eventType", string(evt.Type),
				"objectName", obj.GetName(),
				"objectNamespace", obj.GetNamespace())

			w.incWatchEventCounter(string(evt.Type))

			w.ch <- resource.WatchEvent{
				EventType: string(evt.Type),
				Object:    obj,
			}
		case <-w.stopCh:
			logger.Debug("watch stream stopped")
			close(w.stopCh)
			return
		}
	}
}

// Stop stops the translation channel between the kubernetes watch.Interface,
// and stops the continued watch request encapsulated by the watch.Interface.
func (w *WatchResponse) Stop() {
	w.startMux.Lock()
	defer w.startMux.Unlock()
	w.stopCh <- struct{}{}
	close(w.ch)
	w.watch.Stop()
	w.started = false
}

// WatchEvents returns a channel that receives watch events.
// All calls to this method will return the same channel.
// This channel will stop receiving events if KubernetesWatch() is called, as that halts the event translation process.
// If Stop() is called, ths channel is closed.
func (w *WatchResponse) WatchEvents() <-chan resource.WatchEvent {
	w.startMux.Lock()
	defer w.startMux.Unlock()
	if !w.started {
		// Start the translation buffer
		go w.start()
		w.started = true
	}
	return w.ch
}

// KubernetesWatch returns the underlying watch.Interface.
// Calling this method will shut down the translation channel between the watch.Interface and ResultChan().
// Using both KubernetesWatch() and ResultChan() simultaneously is not supported, and may result in undefined behavior.
func (w *WatchResponse) KubernetesWatch() watch.Interface {
	w.startMux.Lock()
	defer w.startMux.Unlock()
	// Stop the internal channel with the translation layer
	if w.started {
		w.stopCh <- struct{}{}
		w.started = false
	}

	// If metrics are configured, wrap the watch to record metrics
	if w.watchEventsTotal != nil {
		return &metricsWatchWrapper{
			underlying:       w.watch,
			plural:           w.plural,
			watchEventsTotal: w.watchEventsTotal,
			watchErrorsTotal: w.watchErrorsTotal,
			ctx:              w.ctx,
			ch:               make(chan watch.Event, cap(w.ch)),
			stopCh:           make(chan struct{}),
		}
	}

	return w.watch
}

func (w *WatchResponse) incWatchEventCounter(eventType string) {
	if w.watchEventsTotal == nil {
		return
	}
	w.watchEventsTotal.WithLabelValues(eventType, w.plural).Inc()
}

func (w *WatchResponse) incWatchErrorCounter(errorType string) {
	if w.watchErrorsTotal == nil {
		return
	}
	w.watchErrorsTotal.WithLabelValues(errorType, w.plural).Inc()
}

// metricsWatchWrapper wraps a watch.Interface to transparently record metrics for watch events
type metricsWatchWrapper struct {
	underlying       watch.Interface
	plural           string
	watchEventsTotal *prometheus.CounterVec
	watchErrorsTotal *prometheus.CounterVec
	ctx              context.Context
	ch               chan watch.Event
	once             sync.Once
	stopCh           chan struct{}
}

// Stop delegates to the underlying watch
func (w *metricsWatchWrapper) Stop() {
	w.underlying.Stop()
	// Signal the goroutine to stop if it was started
	select {
	case w.stopCh <- struct{}{}:
	default:
	}
}

// ResultChan returns a channel that intercepts events and records metrics
func (w *metricsWatchWrapper) ResultChan() <-chan watch.Event {
	// Use sync.Once to ensure we only spawn the goroutine once
	w.once.Do(func() {
		go w.interceptEvents()
	})
	return w.ch
}

// interceptEvents reads from the underlying watch, records metrics, and forwards events
func (w *metricsWatchWrapper) interceptEvents() {
	defer close(w.ch)

	logger := logging.FromContext(w.ctx).With("kind", w.plural)

	underlyingCh := w.underlying.ResultChan()
	for {
		select {
		case evt, ok := <-underlyingCh:
			if !ok {
				// Underlying channel closed
				logger.Debug("underlying watch channel closed")
				return
			}

			// Record event type metric
			w.incWatchEventCounter(string(evt.Type))

			// Check for nil object and record error if needed
			if evt.Object == nil {
				logger.Warn("received nil object in watch event", "eventType", string(evt.Type))
				w.incWatchErrorCounter("nil_object")
			}

			// Forward event to wrapper's channel
			w.ch <- evt

		case <-w.stopCh:
			logger.Debug("metrics watch wrapper stopped")
			return
		}
	}
}

func (w *metricsWatchWrapper) incWatchEventCounter(eventType string) {
	if w.watchEventsTotal == nil {
		return
	}
	w.watchEventsTotal.WithLabelValues(eventType, w.plural).Inc()
}

func (w *metricsWatchWrapper) incWatchErrorCounter(errorType string) {
	if w.watchErrorsTotal == nil {
		return
	}
	w.watchErrorsTotal.WithLabelValues(errorType, w.plural).Inc()
}

func addLabels(obj resource.Object, labels map[string]string) {
	l := obj.GetLabels()
	if l == nil {
		l = make(map[string]string)
	}
	for k, v := range labels {
		l[k] = v
	}
	obj.SetLabels(l)
}
