package k8s

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"gomodules.xyz/jsonpatch/v2"
	admission "k8s.io/api/admission/v1beta1"
	conversion "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

// WebhookServerConfig is the configuration object for a WebhookServer, used with NewWebhookServer.
type WebhookServerConfig struct {
	// The Port to run the HTTPS server on
	Port int
	// TLSConfig contains cert information for running the HTTPS server
	TLSConfig TLSConfig
	// ValidatingControllers is a map of schemas to their corresponding ValidatingAdmissionController.
	ValidatingControllers map[*resource.Kind]resource.ValidatingAdmissionController
	// MutatingControllers is a map of schemas to their corresponding MutatingAdmissionController.
	MutatingControllers map[*resource.Kind]resource.MutatingAdmissionController
	// KindConverters is a map of GroupKind to a Converter which can parse any valid version of the kind
	// and return any valid version of the kind.
	KindConverters map[metav1.GroupKind]Converter
	// DefaultValidatingController is called for any /validate requests received which don't have an entry in ValidatingControllers.
	// If left nil, an error will be returned to the caller instead.
	DefaultValidatingController resource.ValidatingAdmissionController
	// DefaultMutatingController is called for any /validate requests received which don't have an entry in MutatingControllers.
	// If left nil, an error will be returned to the caller instead.
	DefaultMutatingController resource.MutatingAdmissionController
}

// TLSConfig describes a set of TLS files
type TLSConfig struct {
	// CertPath is the path to the on-disk cert file
	CertPath string
	// KeyPath is the path to the on-disk key file for the cert
	KeyPath string
}

// WebhookServer is a kubernetes webhook server, which exposes /validate and /mutate HTTPS endpoints.
// It implements operator.Controller and can be run as a controller in an operator, or as a standalone process.
type WebhookServer struct {
	// DefaultValidatingController is the default ValidatingAdmissionController to use if one is not defined for the schema in the request.
	// If this is empty, the request will be rejected.
	DefaultValidatingController resource.ValidatingAdmissionController
	// DefaultMutatingController is the default MutatingAdmissionController to use if one is not defined for the schema in the request.
	// If this is empty, the request will be rejected.
	DefaultMutatingController resource.MutatingAdmissionController
	validatingControllers     map[string]validatingAdmissionControllerTuple
	mutatingControllers       map[string]mutatingAdmissionControllerTuple
	converters                map[string]Converter
	port                      int
	tlsConfig                 TLSConfig
}

// NewWebhookServer creates a new WebhookServer using the provided configuration.
// The only required parts of the config are the Port and TLSConfig, as all other parts
// (default controllers, schema-specific controllers) can be set post-initialization.
func NewWebhookServer(config WebhookServerConfig) (*WebhookServer, error) {
	if config.Port < 1 || config.Port > 65536 {
		return nil, errors.New("config.Port must be a valid port number (between 1 and 65536)")
	}
	if config.TLSConfig.CertPath == "" {
		return nil, errors.New("config.TLSConfig.CertPath is required")
	}
	if config.TLSConfig.KeyPath == "" {
		return nil, errors.New("config.TLSConfig.KeyPath is required")
	}

	ws := WebhookServer{
		DefaultValidatingController: config.DefaultValidatingController,
		DefaultMutatingController:   config.DefaultMutatingController,
		validatingControllers:       make(map[string]validatingAdmissionControllerTuple),
		mutatingControllers:         make(map[string]mutatingAdmissionControllerTuple),
		converters:                  make(map[string]Converter),
		port:                        config.Port,
		tlsConfig:                   config.TLSConfig,
	}

	for sch, controller := range config.ValidatingControllers {
		ws.AddValidatingAdmissionController(controller, *sch)
	}

	for sch, controller := range config.MutatingControllers {
		ws.AddMutatingAdmissionController(controller, *sch)
	}

	for gv, conv := range config.KindConverters {
		ws.AddConverter(conv, gv)
	}

	return &ws, nil
}

// AddValidatingAdmissionController adds a resource.ValidatingAdmissionController to the WebhookServer, associated with a given schema.
// The schema association associates all incoming requests of the same group and kind of the schema to the schema's ZeroValue object.
// If a ValidatingAdmissionController already exists for the provided schema, the one provided in this call will be used instead of the extant one.
func (w *WebhookServer) AddValidatingAdmissionController(controller resource.ValidatingAdmissionController, kind resource.Kind) {
	if w.validatingControllers == nil {
		w.validatingControllers = make(map[string]validatingAdmissionControllerTuple)
	}
	w.validatingControllers[gvk(&metav1.GroupVersionKind{
		Group:   kind.Group(),
		Version: kind.Version(),
		Kind:    kind.Kind(),
	})] = validatingAdmissionControllerTuple{
		schema:     kind,
		controller: controller,
	}
}

// AddMutatingAdmissionController adds a resource.MutatingAdmissionController to the WebhookServer, associated with a given schema.
// The schema association associates all incoming requests of the same group and kind of the schema to the schema's ZeroValue object.
// If a MutatingAdmissionController already exists for the provided schema, the one provided in this call will be used instead of the extant one.
func (w *WebhookServer) AddMutatingAdmissionController(controller resource.MutatingAdmissionController, kind resource.Kind) {
	if w.mutatingControllers == nil {
		w.mutatingControllers = make(map[string]mutatingAdmissionControllerTuple)
	}
	w.mutatingControllers[gvk(&metav1.GroupVersionKind{
		Group:   kind.Group(),
		Version: kind.Version(),
		Kind:    kind.Kind(),
	})] = mutatingAdmissionControllerTuple{
		schema:     kind,
		controller: controller,
	}
}

// AddConverter adds a Converter to the WebhookServer, associated with the given group and kind.
func (w *WebhookServer) AddConverter(converter Converter, groupKind metav1.GroupKind) {
	if w.converters == nil {
		w.converters = make(map[string]Converter)
	}
	w.converters[gk(groupKind.Group, groupKind.Kind)] = converter
}

// Run establishes an HTTPS server on the configured port and exposes `/validate` and `/mutate` paths for kubernetes
// validating and mutating webhooks, respectively. It will block until either closeChan is closed (in which case it returns nil),
// or the server encounters an unrecoverable error (in which case it returns the error).
func (w *WebhookServer) Run(closeChan <-chan struct{}) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/validate", w.HandleValidateHTTP)
	mux.HandleFunc("/mutate", w.HandleMutateHTTP)
	mux.HandleFunc("/convert", w.HandleConvertHTTP)
	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", w.port),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	errCh := make(chan error, 1)
	go func() {
		errCh <- server.ListenAndServeTLS(w.tlsConfig.CertPath, w.tlsConfig.KeyPath)
	}()
	go func() {
		for range closeChan {
			// do nothing until closeCh is closed or receives a message
			break
		}
		ctx, cancelFunc := context.WithTimeout(context.Background(), time.Second)
		defer cancelFunc()
		errCh <- server.Shutdown(ctx)
	}()
	err := <-errCh
	return err
}

// HandleValidateHTTP is the HTTP HandlerFunc for a kubernetes validating webhook call
// nolint:errcheck,revive,funlen
func (w *WebhookServer) HandleValidateHTTP(writer http.ResponseWriter, req *http.Request) {
	// Only POST is allowed
	if req.Method != http.MethodPost {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		logging.FromContext(req.Context()).Error("Bad method")
		return
	}

	// Read the body
	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		logging.FromContext(req.Context()).Error("Couldn't read body", "error", err)
		return
	}

	// Unmarshal the admission review
	admRev, err := unmarshalKubernetesAdmissionReview(body, resource.WireFormatJSON)
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		logging.FromContext(req.Context()).Error("Couldn't unmarshal", "error", err)
		return
	}

	// Look up the schema and controller
	var schema resource.Kind
	var controller resource.ValidatingAdmissionController
	if tpl, ok := w.validatingControllers[gvk(admRev.Request.RequestKind)]; ok {
		schema = tpl.schema
		controller = tpl.controller
	} else if w.DefaultValidatingController != nil {
		// If we have a default controller, create a SimpleObject schema and use the default controller
		schema.Schema = resource.NewSimpleSchema(admRev.Request.RequestKind.Group, admRev.Request.RequestKind.Version, &resource.TypedSpecObject[any]{}, &resource.TypedList[*resource.TypedSpecObject[any]]{}, resource.WithKind(admRev.Request.RequestKind.Kind))
		schema.Codecs = map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()}
		controller = w.DefaultValidatingController
	}

	// If we didn't get a controller, return a failure
	if controller == nil {
		writer.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(writer, errStringNoAdmissionControllerDefined, "validating", admRev.Request.RequestKind.Group, admRev.Request.RequestKind.Kind)
		logging.FromContext(req.Context()).Error("No controller", "error", err)
		return
	}

	// Translate the kubernetes admission request to one with a resource.Object in it, using the schema
	admReq, err := translateKubernetesAdmissionRequest(admRev.Request, schema)
	if err != nil {
		// TODO: different error?
		writer.WriteHeader(http.StatusBadRequest)
		logging.FromContext(req.Context()).Error("Couldn't translate request", "error", err)
		return
	}

	// Run the controller
	err = controller.Validate(req.Context(), admReq)
	adResp := admission.AdmissionResponse{
		UID:     admRev.Request.UID,
		Allowed: true,
	}
	if err != nil {
		addAdmissionError(&adResp, err)
	}
	bytes, err := json.Marshal(&admission.AdmissionReview{
		TypeMeta: admRev.TypeMeta,
		Response: &adResp,
	})
	if err != nil {
		// Bad news
		writer.WriteHeader(http.StatusInternalServerError)
		writer.Write([]byte(err.Error())) // TODO: better
		return
	}
	writer.WriteHeader(http.StatusOK)
	writer.Write(bytes)
}

// HandleMutateHTTP is the HTTP HandlerFunc for a kubernetes mutating webhook call
// nolint:errcheck,revive,funlen
func (w *WebhookServer) HandleMutateHTTP(writer http.ResponseWriter, req *http.Request) {
	// Only POST is allowed
	if req.Method != http.MethodPost {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Read the body
	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	// Unmarshal the admission review
	admRev, err := unmarshalKubernetesAdmissionReview(body, resource.WireFormatJSON)
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	// Look up the schema and controller
	var schema resource.Kind
	var controller resource.MutatingAdmissionController
	if tpl, ok := w.mutatingControllers[gvk(admRev.Request.RequestKind)]; ok {
		schema = tpl.schema
		controller = tpl.controller
	} else if w.DefaultMutatingController != nil {
		// If we have a default controller, create a SimpleObject schema and use the default controller
		schema.Schema = resource.NewSimpleSchema(admRev.Request.RequestKind.Group, admRev.Request.RequestKind.Version, &resource.TypedSpecObject[any]{}, &resource.TypedList[*resource.TypedSpecObject[any]]{}, resource.WithKind(admRev.Request.RequestKind.Kind))
		schema.Codecs = map[resource.KindEncoding]resource.Codec{resource.KindEncodingJSON: resource.NewJSONCodec()}
		controller = w.DefaultMutatingController
	}

	// If we didn't get a controller, return a failure
	if controller == nil {
		writer.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(writer, errStringNoAdmissionControllerDefined, "mutating", admRev.Request.RequestKind.Group, admRev.Request.RequestKind.Kind)
		return
	}

	// Translate the kubernetes admission request to one with a resource.Object in it, using the schema
	admReq, err := translateKubernetesAdmissionRequest(admRev.Request, schema)
	if err != nil {
		// TODO: different error?
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	// Run the controller
	mResp, err := controller.Mutate(req.Context(), admReq)
	adResp := admission.AdmissionResponse{
		UID:     admRev.Request.UID,
		Allowed: true,
	}
	if err == nil && mResp != nil && mResp.UpdatedObject != nil {
		pt := admission.PatchTypeJSONPatch
		adResp.PatchType = &pt
		// Re-use `err` here, we handle it below
		adResp.Patch, err = w.generatePatch(admRev, mResp.UpdatedObject, schema.Codec(resource.KindEncodingJSON))
	}
	if err != nil {
		addAdmissionError(&adResp, err)
	}
	bytes, err := json.Marshal(&admission.AdmissionReview{
		TypeMeta: admRev.TypeMeta,
		Response: &adResp,
	})
	if err != nil {
		// Bad news
		writer.WriteHeader(http.StatusInternalServerError)
		writer.Write([]byte(err.Error())) // TODO: better
		return
	}
	writer.WriteHeader(http.StatusOK)
	writer.Write(bytes)
}

// HandleConvertHTTP is the HTTP HandlerFunc for a kubernetes CRD conversion webhook call
// nolint:errcheck,revive,funlen
func (w *WebhookServer) HandleConvertHTTP(writer http.ResponseWriter, req *http.Request) {
	// Only POST is allowed
	if req.Method != http.MethodPost {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Read the body
	body, err := io.ReadAll(req.Body)
	defer req.Body.Close()
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	// Unmarshal the ConversionReview
	rev := conversion.ConversionReview{}
	err = json.Unmarshal(body, &rev)
	if err != nil {
		writer.WriteHeader(http.StatusBadRequest)
		return
	}

	if rev.Response == nil {
		rev.Response = &conversion.ConversionResponse{
			ConvertedObjects: make([]runtime.RawExtension, 0),
		}
	}
	// Pre-fill the response
	rev.Response.UID = rev.Request.UID
	// We'll update this away from a success if there is an error along the way
	rev.Response.Result.Code = http.StatusOK
	rev.Response.Result.Status = metav1.StatusSuccess

	// Go through each object in the request
	for _, obj := range rev.Request.Objects {
		// Partly unmarshal to find the kind and APIVersion
		tm := metav1.TypeMeta{}
		err = json.Unmarshal(obj.Raw, &tm)
		if err != nil {
			rev.Response.Result.Status = metav1.StatusFailure
			rev.Response.Result.Code = http.StatusBadRequest
			rev.Response.Result.Message = err.Error()
			logging.FromContext(req.Context()).Error("Error unmarshaling basic type data from object for conversion", "error", err.Error())
			break
		}
		// Get the associated converter for this kind
		conv, ok := w.converters[gk(tm.GroupVersionKind().Group, tm.Kind)]
		if !ok {
			// No converter for this kind
			rev.Response.Result.Status = metav1.StatusFailure
			rev.Response.Result.Code = http.StatusUnprocessableEntity
			rev.Response.Result.Message = fmt.Sprintf("No converter registered for kind %s", tm.Kind)
			logging.FromContext(req.Context()).Error("No converter has been registered for this groupKind", "kind", tm.Kind, "group", tm.GetObjectKind().GroupVersionKind().Group)
			break
		}
		// Do the conversion
		// Partial unmarshal to get kind and APIVersion
		res, err := conv.Convert(RawKind{
			Kind:       tm.Kind,
			APIVersion: tm.APIVersion,
			Group:      tm.GroupVersionKind().Group,
			Version:    tm.GroupVersionKind().Version,
			Raw:        obj.Raw,
		}, rev.Request.DesiredAPIVersion)
		if err != nil {
			// Conversion error
			rev.Response.Result.Status = metav1.StatusFailure
			rev.Response.Result.Code = http.StatusInternalServerError
			rev.Response.Result.Message = "Error converting object"
			logging.FromContext(req.Context()).Error("Error converting object", "error", err.Error())
			break
		}
		rev.Response.ConvertedObjects = append(rev.Response.ConvertedObjects, runtime.RawExtension{
			Raw: res,
		})
	}
	resp, err := json.Marshal(rev)
	if err != nil {
		writer.WriteHeader(http.StatusInternalServerError)
		return
	}
	writer.Write(resp)
}

func (*WebhookServer) generatePatch(admRev *admission.AdmissionReview, alteredObject resource.Object, codec resource.Codec) ([]byte, error) {
	// We need to generate a list of JSONPatch operations for updating the existing object to the provided one.
	// To start, we need to translate the provided object into its kubernetes bytes representation
	buf := &bytes.Buffer{}
	err := codec.Write(buf, alteredObject)
	if err != nil {
		return nil, err
	}
	// Now, we generate a patch using the bytes provided to us in the admission request
	patch, err := jsonpatch.CreatePatch(admRev.Request.Object.Raw, buf.Bytes())
	if err != nil {
		return nil, err
	}
	return json.Marshal(patch)
}

type validatingAdmissionControllerTuple struct {
	schema     resource.Kind
	controller resource.ValidatingAdmissionController
}

type mutatingAdmissionControllerTuple struct {
	schema     resource.Kind
	controller resource.MutatingAdmissionController
}

func gk(group, kind string) string {
	return fmt.Sprintf("%s.%s", kind, group)
}

func gvk(kind *metav1.GroupVersionKind) string {
	return kind.String()
}

//nolint:gosec
func addAdmissionError(resp *admission.AdmissionResponse, err error) {
	if err == nil || resp == nil {
		return
	}
	resp.Allowed = false
	resp.Result = &metav1.Status{
		Status:  "Failure",
		Message: err.Error(),
	}
	if cast, ok := err.(resource.AdmissionError); ok {
		resp.Result.Code = int32(cast.StatusCode())
		resp.Result.Reason = metav1.StatusReason(cast.Reason())
	}
}
