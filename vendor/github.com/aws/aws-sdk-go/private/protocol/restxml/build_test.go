package restxml_test

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/client"
	"github.com/aws/aws-sdk-go/aws/client/metadata"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/aws/signer/v4"
	"github.com/aws/aws-sdk-go/awstesting"
	"github.com/aws/aws-sdk-go/awstesting/unit"
	"github.com/aws/aws-sdk-go/private/protocol"
	"github.com/aws/aws-sdk-go/private/protocol/restxml"
	"github.com/aws/aws-sdk-go/private/protocol/xml/xmlutil"
	"github.com/aws/aws-sdk-go/private/util"
	"github.com/stretchr/testify/assert"
)

var _ bytes.Buffer // always import bytes
var _ http.Request
var _ json.Marshaler
var _ time.Time
var _ xmlutil.XMLNode
var _ xml.Attr
var _ = ioutil.Discard
var _ = util.Trim("")
var _ = url.Values{}
var _ = io.EOF
var _ = aws.String
var _ = fmt.Println

func init() {
	protocol.RandReader = &awstesting.ZeroReader{}
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService1ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService1ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService1ProtocolTest client from just a session.
//     svc := inputservice1protocoltest.New(mySession)
//
//     // Create a InputService1ProtocolTest client with additional configuration
//     svc := inputservice1protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService1ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService1ProtocolTest {
	c := p.ClientConfig("inputservice1protocoltest", cfgs...)
	return newInputService1ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService1ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService1ProtocolTest {
	svc := &InputService1ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice1protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService1ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService1ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService1TestCaseOperation1 = "OperationName"

// InputService1TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService1TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService1TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService1TestCaseOperation1Request method.
//    req, resp := client.InputService1TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService1ProtocolTest) InputService1TestCaseOperation1Request(input *InputService1TestShapeInputShape) (req *request.Request, output *InputService1TestShapeInputService1TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService1TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService1TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService1TestShapeInputService1TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService1ProtocolTest) InputService1TestCaseOperation1(input *InputService1TestShapeInputShape) (*InputService1TestShapeInputService1TestCaseOperation1Output, error) {
	req, out := c.InputService1TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService1TestCaseOperation2 = "OperationName"

// InputService1TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService1TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService1TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService1TestCaseOperation2Request method.
//    req, resp := client.InputService1TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService1ProtocolTest) InputService1TestCaseOperation2Request(input *InputService1TestShapeInputShape) (req *request.Request, output *InputService1TestShapeInputService1TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService1TestCaseOperation2,
		HTTPMethod: "PUT",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService1TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService1TestShapeInputService1TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService1ProtocolTest) InputService1TestCaseOperation2(input *InputService1TestShapeInputShape) (*InputService1TestShapeInputService1TestCaseOperation2Output, error) {
	req, out := c.InputService1TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

const opInputService1TestCaseOperation3 = "OperationName"

// InputService1TestCaseOperation3Request generates a "aws/request.Request" representing the
// client's request for the InputService1TestCaseOperation3 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService1TestCaseOperation3 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService1TestCaseOperation3Request method.
//    req, resp := client.InputService1TestCaseOperation3Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService1ProtocolTest) InputService1TestCaseOperation3Request(input *InputService1TestShapeInputService1TestCaseOperation3Input) (req *request.Request, output *InputService1TestShapeInputService1TestCaseOperation3Output) {
	op := &request.Operation{
		Name:       opInputService1TestCaseOperation3,
		HTTPMethod: "GET",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService1TestShapeInputService1TestCaseOperation3Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService1TestShapeInputService1TestCaseOperation3Output{}
	req.Data = output
	return
}

func (c *InputService1ProtocolTest) InputService1TestCaseOperation3(input *InputService1TestShapeInputService1TestCaseOperation3Input) (*InputService1TestShapeInputService1TestCaseOperation3Output, error) {
	req, out := c.InputService1TestCaseOperation3Request(input)
	err := req.Send()
	return out, err
}

type InputService1TestShapeInputService1TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService1TestShapeInputService1TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService1TestShapeInputService1TestCaseOperation3Input struct {
	_ struct{} `type:"structure"`
}

type InputService1TestShapeInputService1TestCaseOperation3Output struct {
	_ struct{} `type:"structure"`
}

type InputService1TestShapeInputShape struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	Description *string `type:"string"`

	Name *string `type:"string"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService2ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService2ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService2ProtocolTest client from just a session.
//     svc := inputservice2protocoltest.New(mySession)
//
//     // Create a InputService2ProtocolTest client with additional configuration
//     svc := inputservice2protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService2ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService2ProtocolTest {
	c := p.ClientConfig("inputservice2protocoltest", cfgs...)
	return newInputService2ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService2ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService2ProtocolTest {
	svc := &InputService2ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice2protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService2ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService2ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService2TestCaseOperation1 = "OperationName"

// InputService2TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService2TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService2TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService2TestCaseOperation1Request method.
//    req, resp := client.InputService2TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService2ProtocolTest) InputService2TestCaseOperation1Request(input *InputService2TestShapeInputService2TestCaseOperation1Input) (req *request.Request, output *InputService2TestShapeInputService2TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService2TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService2TestShapeInputService2TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService2TestShapeInputService2TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService2ProtocolTest) InputService2TestCaseOperation1(input *InputService2TestShapeInputService2TestCaseOperation1Input) (*InputService2TestShapeInputService2TestCaseOperation1Output, error) {
	req, out := c.InputService2TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService2TestShapeInputService2TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	First *bool `type:"boolean"`

	Fourth *int64 `type:"integer"`

	Second *bool `type:"boolean"`

	Third *float64 `type:"float"`
}

type InputService2TestShapeInputService2TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService3ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService3ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService3ProtocolTest client from just a session.
//     svc := inputservice3protocoltest.New(mySession)
//
//     // Create a InputService3ProtocolTest client with additional configuration
//     svc := inputservice3protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService3ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService3ProtocolTest {
	c := p.ClientConfig("inputservice3protocoltest", cfgs...)
	return newInputService3ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService3ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService3ProtocolTest {
	svc := &InputService3ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice3protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService3ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService3ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService3TestCaseOperation1 = "OperationName"

// InputService3TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService3TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService3TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService3TestCaseOperation1Request method.
//    req, resp := client.InputService3TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService3ProtocolTest) InputService3TestCaseOperation1Request(input *InputService3TestShapeInputShape) (req *request.Request, output *InputService3TestShapeInputService3TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService3TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService3TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService3TestShapeInputService3TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService3ProtocolTest) InputService3TestCaseOperation1(input *InputService3TestShapeInputShape) (*InputService3TestShapeInputService3TestCaseOperation1Output, error) {
	req, out := c.InputService3TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService3TestCaseOperation2 = "OperationName"

// InputService3TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService3TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService3TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService3TestCaseOperation2Request method.
//    req, resp := client.InputService3TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService3ProtocolTest) InputService3TestCaseOperation2Request(input *InputService3TestShapeInputShape) (req *request.Request, output *InputService3TestShapeInputService3TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService3TestCaseOperation2,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService3TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService3TestShapeInputService3TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService3ProtocolTest) InputService3TestCaseOperation2(input *InputService3TestShapeInputShape) (*InputService3TestShapeInputService3TestCaseOperation2Output, error) {
	req, out := c.InputService3TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

type InputService3TestShapeInputService3TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService3TestShapeInputService3TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService3TestShapeInputShape struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	Description *string `type:"string"`

	SubStructure *InputService3TestShapeSubStructure `type:"structure"`
}

type InputService3TestShapeSubStructure struct {
	_ struct{} `type:"structure"`

	Bar *string `type:"string"`

	Foo *string `type:"string"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService4ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService4ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService4ProtocolTest client from just a session.
//     svc := inputservice4protocoltest.New(mySession)
//
//     // Create a InputService4ProtocolTest client with additional configuration
//     svc := inputservice4protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService4ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService4ProtocolTest {
	c := p.ClientConfig("inputservice4protocoltest", cfgs...)
	return newInputService4ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService4ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService4ProtocolTest {
	svc := &InputService4ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice4protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService4ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService4ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService4TestCaseOperation1 = "OperationName"

// InputService4TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService4TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService4TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService4TestCaseOperation1Request method.
//    req, resp := client.InputService4TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService4ProtocolTest) InputService4TestCaseOperation1Request(input *InputService4TestShapeInputService4TestCaseOperation1Input) (req *request.Request, output *InputService4TestShapeInputService4TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService4TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService4TestShapeInputService4TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService4TestShapeInputService4TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService4ProtocolTest) InputService4TestCaseOperation1(input *InputService4TestShapeInputService4TestCaseOperation1Input) (*InputService4TestShapeInputService4TestCaseOperation1Output, error) {
	req, out := c.InputService4TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService4TestShapeInputService4TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	Description *string `type:"string"`

	SubStructure *InputService4TestShapeSubStructure `type:"structure"`
}

type InputService4TestShapeInputService4TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService4TestShapeSubStructure struct {
	_ struct{} `type:"structure"`

	Bar *string `type:"string"`

	Foo *string `type:"string"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService5ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService5ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService5ProtocolTest client from just a session.
//     svc := inputservice5protocoltest.New(mySession)
//
//     // Create a InputService5ProtocolTest client with additional configuration
//     svc := inputservice5protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService5ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService5ProtocolTest {
	c := p.ClientConfig("inputservice5protocoltest", cfgs...)
	return newInputService5ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService5ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService5ProtocolTest {
	svc := &InputService5ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice5protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService5ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService5ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService5TestCaseOperation1 = "OperationName"

// InputService5TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService5TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService5TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService5TestCaseOperation1Request method.
//    req, resp := client.InputService5TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService5ProtocolTest) InputService5TestCaseOperation1Request(input *InputService5TestShapeInputService5TestCaseOperation1Input) (req *request.Request, output *InputService5TestShapeInputService5TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService5TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService5TestShapeInputService5TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService5TestShapeInputService5TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService5ProtocolTest) InputService5TestCaseOperation1(input *InputService5TestShapeInputService5TestCaseOperation1Input) (*InputService5TestShapeInputService5TestCaseOperation1Output, error) {
	req, out := c.InputService5TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService5TestShapeInputService5TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	ListParam []*string `type:"list"`
}

type InputService5TestShapeInputService5TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService6ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService6ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService6ProtocolTest client from just a session.
//     svc := inputservice6protocoltest.New(mySession)
//
//     // Create a InputService6ProtocolTest client with additional configuration
//     svc := inputservice6protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService6ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService6ProtocolTest {
	c := p.ClientConfig("inputservice6protocoltest", cfgs...)
	return newInputService6ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService6ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService6ProtocolTest {
	svc := &InputService6ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice6protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService6ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService6ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService6TestCaseOperation1 = "OperationName"

// InputService6TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService6TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService6TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService6TestCaseOperation1Request method.
//    req, resp := client.InputService6TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService6ProtocolTest) InputService6TestCaseOperation1Request(input *InputService6TestShapeInputService6TestCaseOperation1Input) (req *request.Request, output *InputService6TestShapeInputService6TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService6TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService6TestShapeInputService6TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService6TestShapeInputService6TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService6ProtocolTest) InputService6TestCaseOperation1(input *InputService6TestShapeInputService6TestCaseOperation1Input) (*InputService6TestShapeInputService6TestCaseOperation1Output, error) {
	req, out := c.InputService6TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService6TestShapeInputService6TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	ListParam []*string `locationName:"AlternateName" locationNameList:"NotMember" type:"list"`
}

type InputService6TestShapeInputService6TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService7ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService7ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService7ProtocolTest client from just a session.
//     svc := inputservice7protocoltest.New(mySession)
//
//     // Create a InputService7ProtocolTest client with additional configuration
//     svc := inputservice7protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService7ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService7ProtocolTest {
	c := p.ClientConfig("inputservice7protocoltest", cfgs...)
	return newInputService7ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService7ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService7ProtocolTest {
	svc := &InputService7ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice7protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService7ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService7ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService7TestCaseOperation1 = "OperationName"

// InputService7TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService7TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService7TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService7TestCaseOperation1Request method.
//    req, resp := client.InputService7TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService7ProtocolTest) InputService7TestCaseOperation1Request(input *InputService7TestShapeInputService7TestCaseOperation1Input) (req *request.Request, output *InputService7TestShapeInputService7TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService7TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService7TestShapeInputService7TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService7TestShapeInputService7TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService7ProtocolTest) InputService7TestCaseOperation1(input *InputService7TestShapeInputService7TestCaseOperation1Input) (*InputService7TestShapeInputService7TestCaseOperation1Output, error) {
	req, out := c.InputService7TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService7TestShapeInputService7TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	ListParam []*string `type:"list" flattened:"true"`
}

type InputService7TestShapeInputService7TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService8ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService8ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService8ProtocolTest client from just a session.
//     svc := inputservice8protocoltest.New(mySession)
//
//     // Create a InputService8ProtocolTest client with additional configuration
//     svc := inputservice8protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService8ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService8ProtocolTest {
	c := p.ClientConfig("inputservice8protocoltest", cfgs...)
	return newInputService8ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService8ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService8ProtocolTest {
	svc := &InputService8ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice8protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService8ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService8ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService8TestCaseOperation1 = "OperationName"

// InputService8TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService8TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService8TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService8TestCaseOperation1Request method.
//    req, resp := client.InputService8TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService8ProtocolTest) InputService8TestCaseOperation1Request(input *InputService8TestShapeInputService8TestCaseOperation1Input) (req *request.Request, output *InputService8TestShapeInputService8TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService8TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService8TestShapeInputService8TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService8TestShapeInputService8TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService8ProtocolTest) InputService8TestCaseOperation1(input *InputService8TestShapeInputService8TestCaseOperation1Input) (*InputService8TestShapeInputService8TestCaseOperation1Output, error) {
	req, out := c.InputService8TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService8TestShapeInputService8TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	ListParam []*string `locationName:"item" type:"list" flattened:"true"`
}

type InputService8TestShapeInputService8TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService9ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService9ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService9ProtocolTest client from just a session.
//     svc := inputservice9protocoltest.New(mySession)
//
//     // Create a InputService9ProtocolTest client with additional configuration
//     svc := inputservice9protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService9ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService9ProtocolTest {
	c := p.ClientConfig("inputservice9protocoltest", cfgs...)
	return newInputService9ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService9ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService9ProtocolTest {
	svc := &InputService9ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice9protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService9ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService9ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService9TestCaseOperation1 = "OperationName"

// InputService9TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService9TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService9TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService9TestCaseOperation1Request method.
//    req, resp := client.InputService9TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService9ProtocolTest) InputService9TestCaseOperation1Request(input *InputService9TestShapeInputService9TestCaseOperation1Input) (req *request.Request, output *InputService9TestShapeInputService9TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService9TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService9TestShapeInputService9TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService9TestShapeInputService9TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService9ProtocolTest) InputService9TestCaseOperation1(input *InputService9TestShapeInputService9TestCaseOperation1Input) (*InputService9TestShapeInputService9TestCaseOperation1Output, error) {
	req, out := c.InputService9TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService9TestShapeInputService9TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	ListParam []*InputService9TestShapeSingleFieldStruct `locationName:"item" type:"list" flattened:"true"`
}

type InputService9TestShapeInputService9TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService9TestShapeSingleFieldStruct struct {
	_ struct{} `type:"structure"`

	Element *string `locationName:"value" type:"string"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService10ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService10ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService10ProtocolTest client from just a session.
//     svc := inputservice10protocoltest.New(mySession)
//
//     // Create a InputService10ProtocolTest client with additional configuration
//     svc := inputservice10protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService10ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService10ProtocolTest {
	c := p.ClientConfig("inputservice10protocoltest", cfgs...)
	return newInputService10ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService10ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService10ProtocolTest {
	svc := &InputService10ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice10protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService10ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService10ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService10TestCaseOperation1 = "OperationName"

// InputService10TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService10TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService10TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService10TestCaseOperation1Request method.
//    req, resp := client.InputService10TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService10ProtocolTest) InputService10TestCaseOperation1Request(input *InputService10TestShapeInputService10TestCaseOperation1Input) (req *request.Request, output *InputService10TestShapeInputService10TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService10TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/2014-01-01/hostedzone",
	}

	if input == nil {
		input = &InputService10TestShapeInputService10TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService10TestShapeInputService10TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService10ProtocolTest) InputService10TestCaseOperation1(input *InputService10TestShapeInputService10TestCaseOperation1Input) (*InputService10TestShapeInputService10TestCaseOperation1Output, error) {
	req, out := c.InputService10TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService10TestShapeInputService10TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	StructureParam *InputService10TestShapeStructureShape `type:"structure"`
}

type InputService10TestShapeInputService10TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService10TestShapeStructureShape struct {
	_ struct{} `type:"structure"`

	// B is automatically base64 encoded/decoded by the SDK.
	B []byte `locationName:"b" type:"blob"`

	T *time.Time `locationName:"t" type:"timestamp" timestampFormat:"iso8601"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService11ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService11ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService11ProtocolTest client from just a session.
//     svc := inputservice11protocoltest.New(mySession)
//
//     // Create a InputService11ProtocolTest client with additional configuration
//     svc := inputservice11protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService11ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService11ProtocolTest {
	c := p.ClientConfig("inputservice11protocoltest", cfgs...)
	return newInputService11ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService11ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService11ProtocolTest {
	svc := &InputService11ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice11protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService11ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService11ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService11TestCaseOperation1 = "OperationName"

// InputService11TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService11TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService11TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService11TestCaseOperation1Request method.
//    req, resp := client.InputService11TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService11ProtocolTest) InputService11TestCaseOperation1Request(input *InputService11TestShapeInputService11TestCaseOperation1Input) (req *request.Request, output *InputService11TestShapeInputService11TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService11TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService11TestShapeInputService11TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService11TestShapeInputService11TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService11ProtocolTest) InputService11TestCaseOperation1(input *InputService11TestShapeInputService11TestCaseOperation1Input) (*InputService11TestShapeInputService11TestCaseOperation1Output, error) {
	req, out := c.InputService11TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService11TestShapeInputService11TestCaseOperation1Input struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	Foo map[string]*string `location:"headers" locationName:"x-foo-" type:"map"`
}

type InputService11TestShapeInputService11TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService12ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService12ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService12ProtocolTest client from just a session.
//     svc := inputservice12protocoltest.New(mySession)
//
//     // Create a InputService12ProtocolTest client with additional configuration
//     svc := inputservice12protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService12ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService12ProtocolTest {
	c := p.ClientConfig("inputservice12protocoltest", cfgs...)
	return newInputService12ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService12ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService12ProtocolTest {
	svc := &InputService12ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice12protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService12ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService12ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService12TestCaseOperation1 = "OperationName"

// InputService12TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService12TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService12TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService12TestCaseOperation1Request method.
//    req, resp := client.InputService12TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService12ProtocolTest) InputService12TestCaseOperation1Request(input *InputService12TestShapeInputService12TestCaseOperation1Input) (req *request.Request, output *InputService12TestShapeInputService12TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService12TestCaseOperation1,
		HTTPMethod: "GET",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService12TestShapeInputService12TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService12TestShapeInputService12TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService12ProtocolTest) InputService12TestCaseOperation1(input *InputService12TestShapeInputService12TestCaseOperation1Input) (*InputService12TestShapeInputService12TestCaseOperation1Output, error) {
	req, out := c.InputService12TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService12TestShapeInputService12TestCaseOperation1Input struct {
	_ struct{} `type:"structure"`

	Items []*string `location:"querystring" locationName:"item" type:"list"`
}

type InputService12TestShapeInputService12TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService13ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService13ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService13ProtocolTest client from just a session.
//     svc := inputservice13protocoltest.New(mySession)
//
//     // Create a InputService13ProtocolTest client with additional configuration
//     svc := inputservice13protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService13ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService13ProtocolTest {
	c := p.ClientConfig("inputservice13protocoltest", cfgs...)
	return newInputService13ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService13ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService13ProtocolTest {
	svc := &InputService13ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice13protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService13ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService13ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService13TestCaseOperation1 = "OperationName"

// InputService13TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService13TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService13TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService13TestCaseOperation1Request method.
//    req, resp := client.InputService13TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService13ProtocolTest) InputService13TestCaseOperation1Request(input *InputService13TestShapeInputService13TestCaseOperation1Input) (req *request.Request, output *InputService13TestShapeInputService13TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService13TestCaseOperation1,
		HTTPMethod: "GET",
		HTTPPath:   "/2014-01-01/jobsByPipeline/{PipelineId}",
	}

	if input == nil {
		input = &InputService13TestShapeInputService13TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService13TestShapeInputService13TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService13ProtocolTest) InputService13TestCaseOperation1(input *InputService13TestShapeInputService13TestCaseOperation1Input) (*InputService13TestShapeInputService13TestCaseOperation1Output, error) {
	req, out := c.InputService13TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService13TestShapeInputService13TestCaseOperation1Input struct {
	_ struct{} `type:"structure"`

	PipelineId *string `location:"uri" type:"string"`

	QueryDoc map[string]*string `location:"querystring" type:"map"`
}

type InputService13TestShapeInputService13TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService14ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService14ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService14ProtocolTest client from just a session.
//     svc := inputservice14protocoltest.New(mySession)
//
//     // Create a InputService14ProtocolTest client with additional configuration
//     svc := inputservice14protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService14ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService14ProtocolTest {
	c := p.ClientConfig("inputservice14protocoltest", cfgs...)
	return newInputService14ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService14ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService14ProtocolTest {
	svc := &InputService14ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice14protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService14ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService14ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService14TestCaseOperation1 = "OperationName"

// InputService14TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService14TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService14TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService14TestCaseOperation1Request method.
//    req, resp := client.InputService14TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService14ProtocolTest) InputService14TestCaseOperation1Request(input *InputService14TestShapeInputService14TestCaseOperation1Input) (req *request.Request, output *InputService14TestShapeInputService14TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService14TestCaseOperation1,
		HTTPMethod: "GET",
		HTTPPath:   "/2014-01-01/jobsByPipeline/{PipelineId}",
	}

	if input == nil {
		input = &InputService14TestShapeInputService14TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService14TestShapeInputService14TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService14ProtocolTest) InputService14TestCaseOperation1(input *InputService14TestShapeInputService14TestCaseOperation1Input) (*InputService14TestShapeInputService14TestCaseOperation1Output, error) {
	req, out := c.InputService14TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService14TestShapeInputService14TestCaseOperation1Input struct {
	_ struct{} `type:"structure"`

	PipelineId *string `location:"uri" type:"string"`

	QueryDoc map[string][]*string `location:"querystring" type:"map"`
}

type InputService14TestShapeInputService14TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService15ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService15ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService15ProtocolTest client from just a session.
//     svc := inputservice15protocoltest.New(mySession)
//
//     // Create a InputService15ProtocolTest client with additional configuration
//     svc := inputservice15protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService15ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService15ProtocolTest {
	c := p.ClientConfig("inputservice15protocoltest", cfgs...)
	return newInputService15ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService15ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService15ProtocolTest {
	svc := &InputService15ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice15protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService15ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService15ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService15TestCaseOperation1 = "OperationName"

// InputService15TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService15TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService15TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService15TestCaseOperation1Request method.
//    req, resp := client.InputService15TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService15ProtocolTest) InputService15TestCaseOperation1Request(input *InputService15TestShapeInputService15TestCaseOperation1Input) (req *request.Request, output *InputService15TestShapeInputService15TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService15TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService15TestShapeInputService15TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService15TestShapeInputService15TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService15ProtocolTest) InputService15TestCaseOperation1(input *InputService15TestShapeInputService15TestCaseOperation1Input) (*InputService15TestShapeInputService15TestCaseOperation1Output, error) {
	req, out := c.InputService15TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService15TestShapeInputService15TestCaseOperation1Input struct {
	_ struct{} `type:"structure" payload:"Foo"`

	Foo *string `locationName:"foo" type:"string"`
}

type InputService15TestShapeInputService15TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService16ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService16ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService16ProtocolTest client from just a session.
//     svc := inputservice16protocoltest.New(mySession)
//
//     // Create a InputService16ProtocolTest client with additional configuration
//     svc := inputservice16protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService16ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService16ProtocolTest {
	c := p.ClientConfig("inputservice16protocoltest", cfgs...)
	return newInputService16ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService16ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService16ProtocolTest {
	svc := &InputService16ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice16protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService16ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService16ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService16TestCaseOperation1 = "OperationName"

// InputService16TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService16TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService16TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService16TestCaseOperation1Request method.
//    req, resp := client.InputService16TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService16ProtocolTest) InputService16TestCaseOperation1Request(input *InputService16TestShapeInputShape) (req *request.Request, output *InputService16TestShapeInputService16TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService16TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService16TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService16TestShapeInputService16TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService16ProtocolTest) InputService16TestCaseOperation1(input *InputService16TestShapeInputShape) (*InputService16TestShapeInputService16TestCaseOperation1Output, error) {
	req, out := c.InputService16TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService16TestCaseOperation2 = "OperationName"

// InputService16TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService16TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService16TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService16TestCaseOperation2Request method.
//    req, resp := client.InputService16TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService16ProtocolTest) InputService16TestCaseOperation2Request(input *InputService16TestShapeInputShape) (req *request.Request, output *InputService16TestShapeInputService16TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService16TestCaseOperation2,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService16TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService16TestShapeInputService16TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService16ProtocolTest) InputService16TestCaseOperation2(input *InputService16TestShapeInputShape) (*InputService16TestShapeInputService16TestCaseOperation2Output, error) {
	req, out := c.InputService16TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

type InputService16TestShapeInputService16TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService16TestShapeInputService16TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService16TestShapeInputShape struct {
	_ struct{} `type:"structure" payload:"Foo"`

	Foo []byte `locationName:"foo" type:"blob"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService17ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService17ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService17ProtocolTest client from just a session.
//     svc := inputservice17protocoltest.New(mySession)
//
//     // Create a InputService17ProtocolTest client with additional configuration
//     svc := inputservice17protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService17ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService17ProtocolTest {
	c := p.ClientConfig("inputservice17protocoltest", cfgs...)
	return newInputService17ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService17ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService17ProtocolTest {
	svc := &InputService17ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice17protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService17ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService17ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService17TestCaseOperation1 = "OperationName"

// InputService17TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService17TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService17TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService17TestCaseOperation1Request method.
//    req, resp := client.InputService17TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService17ProtocolTest) InputService17TestCaseOperation1Request(input *InputService17TestShapeInputShape) (req *request.Request, output *InputService17TestShapeInputService17TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService17TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService17TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService17TestShapeInputService17TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService17ProtocolTest) InputService17TestCaseOperation1(input *InputService17TestShapeInputShape) (*InputService17TestShapeInputService17TestCaseOperation1Output, error) {
	req, out := c.InputService17TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService17TestCaseOperation2 = "OperationName"

// InputService17TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService17TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService17TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService17TestCaseOperation2Request method.
//    req, resp := client.InputService17TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService17ProtocolTest) InputService17TestCaseOperation2Request(input *InputService17TestShapeInputShape) (req *request.Request, output *InputService17TestShapeInputService17TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService17TestCaseOperation2,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService17TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService17TestShapeInputService17TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService17ProtocolTest) InputService17TestCaseOperation2(input *InputService17TestShapeInputShape) (*InputService17TestShapeInputService17TestCaseOperation2Output, error) {
	req, out := c.InputService17TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

const opInputService17TestCaseOperation3 = "OperationName"

// InputService17TestCaseOperation3Request generates a "aws/request.Request" representing the
// client's request for the InputService17TestCaseOperation3 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService17TestCaseOperation3 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService17TestCaseOperation3Request method.
//    req, resp := client.InputService17TestCaseOperation3Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService17ProtocolTest) InputService17TestCaseOperation3Request(input *InputService17TestShapeInputShape) (req *request.Request, output *InputService17TestShapeInputService17TestCaseOperation3Output) {
	op := &request.Operation{
		Name:       opInputService17TestCaseOperation3,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService17TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService17TestShapeInputService17TestCaseOperation3Output{}
	req.Data = output
	return
}

func (c *InputService17ProtocolTest) InputService17TestCaseOperation3(input *InputService17TestShapeInputShape) (*InputService17TestShapeInputService17TestCaseOperation3Output, error) {
	req, out := c.InputService17TestCaseOperation3Request(input)
	err := req.Send()
	return out, err
}

const opInputService17TestCaseOperation4 = "OperationName"

// InputService17TestCaseOperation4Request generates a "aws/request.Request" representing the
// client's request for the InputService17TestCaseOperation4 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService17TestCaseOperation4 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService17TestCaseOperation4Request method.
//    req, resp := client.InputService17TestCaseOperation4Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService17ProtocolTest) InputService17TestCaseOperation4Request(input *InputService17TestShapeInputShape) (req *request.Request, output *InputService17TestShapeInputService17TestCaseOperation4Output) {
	op := &request.Operation{
		Name:       opInputService17TestCaseOperation4,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService17TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService17TestShapeInputService17TestCaseOperation4Output{}
	req.Data = output
	return
}

func (c *InputService17ProtocolTest) InputService17TestCaseOperation4(input *InputService17TestShapeInputShape) (*InputService17TestShapeInputService17TestCaseOperation4Output, error) {
	req, out := c.InputService17TestCaseOperation4Request(input)
	err := req.Send()
	return out, err
}

type InputService17TestShapeFooShape struct {
	_ struct{} `locationName:"foo" type:"structure"`

	Baz *string `locationName:"baz" type:"string"`
}

type InputService17TestShapeInputService17TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService17TestShapeInputService17TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService17TestShapeInputService17TestCaseOperation3Output struct {
	_ struct{} `type:"structure"`
}

type InputService17TestShapeInputService17TestCaseOperation4Output struct {
	_ struct{} `type:"structure"`
}

type InputService17TestShapeInputShape struct {
	_ struct{} `type:"structure" payload:"Foo"`

	Foo *InputService17TestShapeFooShape `locationName:"foo" type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService18ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService18ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService18ProtocolTest client from just a session.
//     svc := inputservice18protocoltest.New(mySession)
//
//     // Create a InputService18ProtocolTest client with additional configuration
//     svc := inputservice18protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService18ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService18ProtocolTest {
	c := p.ClientConfig("inputservice18protocoltest", cfgs...)
	return newInputService18ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService18ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService18ProtocolTest {
	svc := &InputService18ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice18protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService18ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService18ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService18TestCaseOperation1 = "OperationName"

// InputService18TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService18TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService18TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService18TestCaseOperation1Request method.
//    req, resp := client.InputService18TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService18ProtocolTest) InputService18TestCaseOperation1Request(input *InputService18TestShapeInputService18TestCaseOperation1Input) (req *request.Request, output *InputService18TestShapeInputService18TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService18TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/",
	}

	if input == nil {
		input = &InputService18TestShapeInputService18TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService18TestShapeInputService18TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService18ProtocolTest) InputService18TestCaseOperation1(input *InputService18TestShapeInputService18TestCaseOperation1Input) (*InputService18TestShapeInputService18TestCaseOperation1Output, error) {
	req, out := c.InputService18TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService18TestShapeGrant struct {
	_ struct{} `locationName:"Grant" type:"structure"`

	Grantee *InputService18TestShapeGrantee `type:"structure"`
}

type InputService18TestShapeGrantee struct {
	_ struct{} `type:"structure" xmlPrefix:"xsi" xmlURI:"http://www.w3.org/2001/XMLSchema-instance"`

	EmailAddress *string `type:"string"`

	Type *string `locationName:"xsi:type" type:"string" xmlAttribute:"true"`
}

type InputService18TestShapeInputService18TestCaseOperation1Input struct {
	_ struct{} `type:"structure" payload:"Grant"`

	Grant *InputService18TestShapeGrant `locationName:"Grant" type:"structure"`
}

type InputService18TestShapeInputService18TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService19ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService19ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService19ProtocolTest client from just a session.
//     svc := inputservice19protocoltest.New(mySession)
//
//     // Create a InputService19ProtocolTest client with additional configuration
//     svc := inputservice19protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService19ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService19ProtocolTest {
	c := p.ClientConfig("inputservice19protocoltest", cfgs...)
	return newInputService19ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService19ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService19ProtocolTest {
	svc := &InputService19ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice19protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService19ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService19ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService19TestCaseOperation1 = "OperationName"

// InputService19TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService19TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService19TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService19TestCaseOperation1Request method.
//    req, resp := client.InputService19TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService19ProtocolTest) InputService19TestCaseOperation1Request(input *InputService19TestShapeInputService19TestCaseOperation1Input) (req *request.Request, output *InputService19TestShapeInputService19TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService19TestCaseOperation1,
		HTTPMethod: "GET",
		HTTPPath:   "/{Bucket}/{Key+}",
	}

	if input == nil {
		input = &InputService19TestShapeInputService19TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService19TestShapeInputService19TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService19ProtocolTest) InputService19TestCaseOperation1(input *InputService19TestShapeInputService19TestCaseOperation1Input) (*InputService19TestShapeInputService19TestCaseOperation1Output, error) {
	req, out := c.InputService19TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService19TestShapeInputService19TestCaseOperation1Input struct {
	_ struct{} `type:"structure"`

	Bucket *string `location:"uri" type:"string"`

	Key *string `location:"uri" type:"string"`
}

type InputService19TestShapeInputService19TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService20ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService20ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService20ProtocolTest client from just a session.
//     svc := inputservice20protocoltest.New(mySession)
//
//     // Create a InputService20ProtocolTest client with additional configuration
//     svc := inputservice20protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService20ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService20ProtocolTest {
	c := p.ClientConfig("inputservice20protocoltest", cfgs...)
	return newInputService20ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService20ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService20ProtocolTest {
	svc := &InputService20ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice20protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService20ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService20ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService20TestCaseOperation1 = "OperationName"

// InputService20TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService20TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService20TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService20TestCaseOperation1Request method.
//    req, resp := client.InputService20TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService20ProtocolTest) InputService20TestCaseOperation1Request(input *InputService20TestShapeInputShape) (req *request.Request, output *InputService20TestShapeInputService20TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService20TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService20TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService20TestShapeInputService20TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService20ProtocolTest) InputService20TestCaseOperation1(input *InputService20TestShapeInputShape) (*InputService20TestShapeInputService20TestCaseOperation1Output, error) {
	req, out := c.InputService20TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService20TestCaseOperation2 = "OperationName"

// InputService20TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService20TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService20TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService20TestCaseOperation2Request method.
//    req, resp := client.InputService20TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService20ProtocolTest) InputService20TestCaseOperation2Request(input *InputService20TestShapeInputShape) (req *request.Request, output *InputService20TestShapeInputService20TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService20TestCaseOperation2,
		HTTPMethod: "POST",
		HTTPPath:   "/path?abc=mno",
	}

	if input == nil {
		input = &InputService20TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService20TestShapeInputService20TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService20ProtocolTest) InputService20TestCaseOperation2(input *InputService20TestShapeInputShape) (*InputService20TestShapeInputService20TestCaseOperation2Output, error) {
	req, out := c.InputService20TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

type InputService20TestShapeInputService20TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService20TestShapeInputService20TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService20TestShapeInputShape struct {
	_ struct{} `type:"structure"`

	Foo *string `location:"querystring" locationName:"param-name" type:"string"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService21ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService21ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService21ProtocolTest client from just a session.
//     svc := inputservice21protocoltest.New(mySession)
//
//     // Create a InputService21ProtocolTest client with additional configuration
//     svc := inputservice21protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService21ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService21ProtocolTest {
	c := p.ClientConfig("inputservice21protocoltest", cfgs...)
	return newInputService21ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService21ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService21ProtocolTest {
	svc := &InputService21ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice21protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService21ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService21ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService21TestCaseOperation1 = "OperationName"

// InputService21TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService21TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService21TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService21TestCaseOperation1Request method.
//    req, resp := client.InputService21TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService21ProtocolTest) InputService21TestCaseOperation1Request(input *InputService21TestShapeInputShape) (req *request.Request, output *InputService21TestShapeInputService21TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService21TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService21TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService21TestShapeInputService21TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService21ProtocolTest) InputService21TestCaseOperation1(input *InputService21TestShapeInputShape) (*InputService21TestShapeInputService21TestCaseOperation1Output, error) {
	req, out := c.InputService21TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService21TestCaseOperation2 = "OperationName"

// InputService21TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService21TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService21TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService21TestCaseOperation2Request method.
//    req, resp := client.InputService21TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService21ProtocolTest) InputService21TestCaseOperation2Request(input *InputService21TestShapeInputShape) (req *request.Request, output *InputService21TestShapeInputService21TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService21TestCaseOperation2,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService21TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService21TestShapeInputService21TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService21ProtocolTest) InputService21TestCaseOperation2(input *InputService21TestShapeInputShape) (*InputService21TestShapeInputService21TestCaseOperation2Output, error) {
	req, out := c.InputService21TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

const opInputService21TestCaseOperation3 = "OperationName"

// InputService21TestCaseOperation3Request generates a "aws/request.Request" representing the
// client's request for the InputService21TestCaseOperation3 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService21TestCaseOperation3 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService21TestCaseOperation3Request method.
//    req, resp := client.InputService21TestCaseOperation3Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService21ProtocolTest) InputService21TestCaseOperation3Request(input *InputService21TestShapeInputShape) (req *request.Request, output *InputService21TestShapeInputService21TestCaseOperation3Output) {
	op := &request.Operation{
		Name:       opInputService21TestCaseOperation3,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService21TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService21TestShapeInputService21TestCaseOperation3Output{}
	req.Data = output
	return
}

func (c *InputService21ProtocolTest) InputService21TestCaseOperation3(input *InputService21TestShapeInputShape) (*InputService21TestShapeInputService21TestCaseOperation3Output, error) {
	req, out := c.InputService21TestCaseOperation3Request(input)
	err := req.Send()
	return out, err
}

const opInputService21TestCaseOperation4 = "OperationName"

// InputService21TestCaseOperation4Request generates a "aws/request.Request" representing the
// client's request for the InputService21TestCaseOperation4 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService21TestCaseOperation4 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService21TestCaseOperation4Request method.
//    req, resp := client.InputService21TestCaseOperation4Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService21ProtocolTest) InputService21TestCaseOperation4Request(input *InputService21TestShapeInputShape) (req *request.Request, output *InputService21TestShapeInputService21TestCaseOperation4Output) {
	op := &request.Operation{
		Name:       opInputService21TestCaseOperation4,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService21TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService21TestShapeInputService21TestCaseOperation4Output{}
	req.Data = output
	return
}

func (c *InputService21ProtocolTest) InputService21TestCaseOperation4(input *InputService21TestShapeInputShape) (*InputService21TestShapeInputService21TestCaseOperation4Output, error) {
	req, out := c.InputService21TestCaseOperation4Request(input)
	err := req.Send()
	return out, err
}

const opInputService21TestCaseOperation5 = "OperationName"

// InputService21TestCaseOperation5Request generates a "aws/request.Request" representing the
// client's request for the InputService21TestCaseOperation5 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService21TestCaseOperation5 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService21TestCaseOperation5Request method.
//    req, resp := client.InputService21TestCaseOperation5Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService21ProtocolTest) InputService21TestCaseOperation5Request(input *InputService21TestShapeInputShape) (req *request.Request, output *InputService21TestShapeInputService21TestCaseOperation5Output) {
	op := &request.Operation{
		Name:       opInputService21TestCaseOperation5,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService21TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService21TestShapeInputService21TestCaseOperation5Output{}
	req.Data = output
	return
}

func (c *InputService21ProtocolTest) InputService21TestCaseOperation5(input *InputService21TestShapeInputShape) (*InputService21TestShapeInputService21TestCaseOperation5Output, error) {
	req, out := c.InputService21TestCaseOperation5Request(input)
	err := req.Send()
	return out, err
}

const opInputService21TestCaseOperation6 = "OperationName"

// InputService21TestCaseOperation6Request generates a "aws/request.Request" representing the
// client's request for the InputService21TestCaseOperation6 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService21TestCaseOperation6 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService21TestCaseOperation6Request method.
//    req, resp := client.InputService21TestCaseOperation6Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService21ProtocolTest) InputService21TestCaseOperation6Request(input *InputService21TestShapeInputShape) (req *request.Request, output *InputService21TestShapeInputService21TestCaseOperation6Output) {
	op := &request.Operation{
		Name:       opInputService21TestCaseOperation6,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService21TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService21TestShapeInputService21TestCaseOperation6Output{}
	req.Data = output
	return
}

func (c *InputService21ProtocolTest) InputService21TestCaseOperation6(input *InputService21TestShapeInputShape) (*InputService21TestShapeInputService21TestCaseOperation6Output, error) {
	req, out := c.InputService21TestCaseOperation6Request(input)
	err := req.Send()
	return out, err
}

type InputService21TestShapeInputService21TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService21TestShapeInputService21TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService21TestShapeInputService21TestCaseOperation3Output struct {
	_ struct{} `type:"structure"`
}

type InputService21TestShapeInputService21TestCaseOperation4Output struct {
	_ struct{} `type:"structure"`
}

type InputService21TestShapeInputService21TestCaseOperation5Output struct {
	_ struct{} `type:"structure"`
}

type InputService21TestShapeInputService21TestCaseOperation6Output struct {
	_ struct{} `type:"structure"`
}

type InputService21TestShapeInputShape struct {
	_ struct{} `locationName:"OperationRequest" type:"structure" xmlURI:"https://foo/"`

	RecursiveStruct *InputService21TestShapeRecursiveStructType `type:"structure"`
}

type InputService21TestShapeRecursiveStructType struct {
	_ struct{} `type:"structure"`

	NoRecurse *string `type:"string"`

	RecursiveList []*InputService21TestShapeRecursiveStructType `type:"list"`

	RecursiveMap map[string]*InputService21TestShapeRecursiveStructType `type:"map"`

	RecursiveStruct *InputService21TestShapeRecursiveStructType `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService22ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService22ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService22ProtocolTest client from just a session.
//     svc := inputservice22protocoltest.New(mySession)
//
//     // Create a InputService22ProtocolTest client with additional configuration
//     svc := inputservice22protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService22ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService22ProtocolTest {
	c := p.ClientConfig("inputservice22protocoltest", cfgs...)
	return newInputService22ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService22ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService22ProtocolTest {
	svc := &InputService22ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice22protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService22ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService22ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService22TestCaseOperation1 = "OperationName"

// InputService22TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService22TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService22TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService22TestCaseOperation1Request method.
//    req, resp := client.InputService22TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService22ProtocolTest) InputService22TestCaseOperation1Request(input *InputService22TestShapeInputService22TestCaseOperation1Input) (req *request.Request, output *InputService22TestShapeInputService22TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService22TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService22TestShapeInputService22TestCaseOperation1Input{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService22TestShapeInputService22TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService22ProtocolTest) InputService22TestCaseOperation1(input *InputService22TestShapeInputService22TestCaseOperation1Input) (*InputService22TestShapeInputService22TestCaseOperation1Output, error) {
	req, out := c.InputService22TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

type InputService22TestShapeInputService22TestCaseOperation1Input struct {
	_ struct{} `type:"structure"`

	TimeArgInHeader *time.Time `location:"header" locationName:"x-amz-timearg" type:"timestamp" timestampFormat:"rfc822"`
}

type InputService22TestShapeInputService22TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

//The service client's operations are safe to be used concurrently.
// It is not safe to mutate any of the client's properties though.
type InputService23ProtocolTest struct {
	*client.Client
}

// New creates a new instance of the InputService23ProtocolTest client with a session.
// If additional configuration is needed for the client instance use the optional
// aws.Config parameter to add your extra config.
//
// Example:
//     // Create a InputService23ProtocolTest client from just a session.
//     svc := inputservice23protocoltest.New(mySession)
//
//     // Create a InputService23ProtocolTest client with additional configuration
//     svc := inputservice23protocoltest.New(mySession, aws.NewConfig().WithRegion("us-west-2"))
func NewInputService23ProtocolTest(p client.ConfigProvider, cfgs ...*aws.Config) *InputService23ProtocolTest {
	c := p.ClientConfig("inputservice23protocoltest", cfgs...)
	return newInputService23ProtocolTestClient(*c.Config, c.Handlers, c.Endpoint, c.SigningRegion)
}

// newClient creates, initializes and returns a new service client instance.
func newInputService23ProtocolTestClient(cfg aws.Config, handlers request.Handlers, endpoint, signingRegion string) *InputService23ProtocolTest {
	svc := &InputService23ProtocolTest{
		Client: client.New(
			cfg,
			metadata.ClientInfo{
				ServiceName:   "inputservice23protocoltest",
				SigningRegion: signingRegion,
				Endpoint:      endpoint,
				APIVersion:    "2014-01-01",
			},
			handlers,
		),
	}

	// Handlers
	svc.Handlers.Sign.PushBackNamed(v4.SignRequestHandler)
	svc.Handlers.Build.PushBackNamed(restxml.BuildHandler)
	svc.Handlers.Unmarshal.PushBackNamed(restxml.UnmarshalHandler)
	svc.Handlers.UnmarshalMeta.PushBackNamed(restxml.UnmarshalMetaHandler)
	svc.Handlers.UnmarshalError.PushBackNamed(restxml.UnmarshalErrorHandler)

	return svc
}

// newRequest creates a new request for a InputService23ProtocolTest operation and runs any
// custom request initialization.
func (c *InputService23ProtocolTest) newRequest(op *request.Operation, params, data interface{}) *request.Request {
	req := c.NewRequest(op, params, data)

	return req
}

const opInputService23TestCaseOperation1 = "OperationName"

// InputService23TestCaseOperation1Request generates a "aws/request.Request" representing the
// client's request for the InputService23TestCaseOperation1 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService23TestCaseOperation1 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService23TestCaseOperation1Request method.
//    req, resp := client.InputService23TestCaseOperation1Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService23ProtocolTest) InputService23TestCaseOperation1Request(input *InputService23TestShapeInputShape) (req *request.Request, output *InputService23TestShapeInputService23TestCaseOperation1Output) {
	op := &request.Operation{
		Name:       opInputService23TestCaseOperation1,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService23TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService23TestShapeInputService23TestCaseOperation1Output{}
	req.Data = output
	return
}

func (c *InputService23ProtocolTest) InputService23TestCaseOperation1(input *InputService23TestShapeInputShape) (*InputService23TestShapeInputService23TestCaseOperation1Output, error) {
	req, out := c.InputService23TestCaseOperation1Request(input)
	err := req.Send()
	return out, err
}

const opInputService23TestCaseOperation2 = "OperationName"

// InputService23TestCaseOperation2Request generates a "aws/request.Request" representing the
// client's request for the InputService23TestCaseOperation2 operation. The "output" return
// value can be used to capture response data after the request's "Send" method
// is called.
//
// Creating a request object using this method should be used when you want to inject
// custom logic into the request's lifecycle using a custom handler, or if you want to
// access properties on the request object before or after sending the request. If
// you just want the service response, call the InputService23TestCaseOperation2 method directly
// instead.
//
// Note: You must call the "Send" method on the returned request object in order
// to execute the request.
//
//    // Example sending a request using the InputService23TestCaseOperation2Request method.
//    req, resp := client.InputService23TestCaseOperation2Request(params)
//
//    err := req.Send()
//    if err == nil { // resp is now filled
//        fmt.Println(resp)
//    }
//
func (c *InputService23ProtocolTest) InputService23TestCaseOperation2Request(input *InputService23TestShapeInputShape) (req *request.Request, output *InputService23TestShapeInputService23TestCaseOperation2Output) {
	op := &request.Operation{
		Name:       opInputService23TestCaseOperation2,
		HTTPMethod: "POST",
		HTTPPath:   "/path",
	}

	if input == nil {
		input = &InputService23TestShapeInputShape{}
	}

	req = c.newRequest(op, input, output)
	req.Handlers.Unmarshal.Remove(restxml.UnmarshalHandler)
	req.Handlers.Unmarshal.PushBackNamed(protocol.UnmarshalDiscardBodyHandler)
	output = &InputService23TestShapeInputService23TestCaseOperation2Output{}
	req.Data = output
	return
}

func (c *InputService23ProtocolTest) InputService23TestCaseOperation2(input *InputService23TestShapeInputShape) (*InputService23TestShapeInputService23TestCaseOperation2Output, error) {
	req, out := c.InputService23TestCaseOperation2Request(input)
	err := req.Send()
	return out, err
}

type InputService23TestShapeInputService23TestCaseOperation1Output struct {
	_ struct{} `type:"structure"`
}

type InputService23TestShapeInputService23TestCaseOperation2Output struct {
	_ struct{} `type:"structure"`
}

type InputService23TestShapeInputShape struct {
	_ struct{} `type:"structure"`

	Token *string `type:"string" idempotencyToken:"true"`
}

//
// Tests begin here
//

func TestInputService1ProtocolTestBasicXMLSerializationCase1(t *testing.T) {
	svc := NewInputService1ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService1TestShapeInputShape{
		Description: aws.String("bar"),
		Name:        aws.String("foo"),
	}
	req, _ := svc.InputService1TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">bar</Description><Name xmlns="https://foo/">foo</Name></OperationRequest>`, util.Trim(string(body)), InputService1TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService1ProtocolTestBasicXMLSerializationCase2(t *testing.T) {
	svc := NewInputService1ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService1TestShapeInputShape{
		Description: aws.String("bar"),
		Name:        aws.String("foo"),
	}
	req, _ := svc.InputService1TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">bar</Description><Name xmlns="https://foo/">foo</Name></OperationRequest>`, util.Trim(string(body)), InputService1TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService1ProtocolTestBasicXMLSerializationCase3(t *testing.T) {
	svc := NewInputService1ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService1TestShapeInputService1TestCaseOperation3Input{}
	req, _ := svc.InputService1TestCaseOperation3Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService2ProtocolTestSerializeOtherScalarTypesCase1(t *testing.T) {
	svc := NewInputService2ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService2TestShapeInputService2TestCaseOperation1Input{
		First:  aws.Bool(true),
		Fourth: aws.Int64(3),
		Second: aws.Bool(false),
		Third:  aws.Float64(1.2),
	}
	req, _ := svc.InputService2TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><First xmlns="https://foo/">true</First><Fourth xmlns="https://foo/">3</Fourth><Second xmlns="https://foo/">false</Second><Third xmlns="https://foo/">1.2</Third></OperationRequest>`, util.Trim(string(body)), InputService2TestShapeInputService2TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService3ProtocolTestNestedStructuresCase1(t *testing.T) {
	svc := NewInputService3ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService3TestShapeInputShape{
		Description: aws.String("baz"),
		SubStructure: &InputService3TestShapeSubStructure{
			Bar: aws.String("b"),
			Foo: aws.String("a"),
		},
	}
	req, _ := svc.InputService3TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">baz</Description><SubStructure xmlns="https://foo/"><Bar xmlns="https://foo/">b</Bar><Foo xmlns="https://foo/">a</Foo></SubStructure></OperationRequest>`, util.Trim(string(body)), InputService3TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService3ProtocolTestNestedStructuresCase2(t *testing.T) {
	svc := NewInputService3ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService3TestShapeInputShape{
		Description: aws.String("baz"),
		SubStructure: &InputService3TestShapeSubStructure{
			Foo: aws.String("a"),
		},
	}
	req, _ := svc.InputService3TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">baz</Description><SubStructure xmlns="https://foo/"><Foo xmlns="https://foo/">a</Foo></SubStructure></OperationRequest>`, util.Trim(string(body)), InputService3TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService4ProtocolTestNestedStructuresCase1(t *testing.T) {
	svc := NewInputService4ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService4TestShapeInputService4TestCaseOperation1Input{
		Description:  aws.String("baz"),
		SubStructure: &InputService4TestShapeSubStructure{},
	}
	req, _ := svc.InputService4TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><Description xmlns="https://foo/">baz</Description><SubStructure xmlns="https://foo/"></SubStructure></OperationRequest>`, util.Trim(string(body)), InputService4TestShapeInputService4TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService5ProtocolTestNonFlattenedListsCase1(t *testing.T) {
	svc := NewInputService5ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService5TestShapeInputService5TestCaseOperation1Input{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService5TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><ListParam xmlns="https://foo/"><member xmlns="https://foo/">one</member><member xmlns="https://foo/">two</member><member xmlns="https://foo/">three</member></ListParam></OperationRequest>`, util.Trim(string(body)), InputService5TestShapeInputService5TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService6ProtocolTestNonFlattenedListsWithLocationNameCase1(t *testing.T) {
	svc := NewInputService6ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService6TestShapeInputService6TestCaseOperation1Input{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService6TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><AlternateName xmlns="https://foo/"><NotMember xmlns="https://foo/">one</NotMember><NotMember xmlns="https://foo/">two</NotMember><NotMember xmlns="https://foo/">three</NotMember></AlternateName></OperationRequest>`, util.Trim(string(body)), InputService6TestShapeInputService6TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService7ProtocolTestFlattenedListsCase1(t *testing.T) {
	svc := NewInputService7ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService7TestShapeInputService7TestCaseOperation1Input{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService7TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><ListParam xmlns="https://foo/">one</ListParam><ListParam xmlns="https://foo/">two</ListParam><ListParam xmlns="https://foo/">three</ListParam></OperationRequest>`, util.Trim(string(body)), InputService7TestShapeInputService7TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService8ProtocolTestFlattenedListsWithLocationNameCase1(t *testing.T) {
	svc := NewInputService8ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService8TestShapeInputService8TestCaseOperation1Input{
		ListParam: []*string{
			aws.String("one"),
			aws.String("two"),
			aws.String("three"),
		},
	}
	req, _ := svc.InputService8TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><item xmlns="https://foo/">one</item><item xmlns="https://foo/">two</item><item xmlns="https://foo/">three</item></OperationRequest>`, util.Trim(string(body)), InputService8TestShapeInputService8TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService9ProtocolTestListOfStructuresCase1(t *testing.T) {
	svc := NewInputService9ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService9TestShapeInputService9TestCaseOperation1Input{
		ListParam: []*InputService9TestShapeSingleFieldStruct{
			{
				Element: aws.String("one"),
			},
			{
				Element: aws.String("two"),
			},
			{
				Element: aws.String("three"),
			},
		},
	}
	req, _ := svc.InputService9TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><item xmlns="https://foo/"><value xmlns="https://foo/">one</value></item><item xmlns="https://foo/"><value xmlns="https://foo/">two</value></item><item xmlns="https://foo/"><value xmlns="https://foo/">three</value></item></OperationRequest>`, util.Trim(string(body)), InputService9TestShapeInputService9TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService10ProtocolTestBlobAndTimestampShapesCase1(t *testing.T) {
	svc := NewInputService10ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService10TestShapeInputService10TestCaseOperation1Input{
		StructureParam: &InputService10TestShapeStructureShape{
			B: []byte("foo"),
			T: aws.Time(time.Unix(1422172800, 0)),
		},
	}
	req, _ := svc.InputService10TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><StructureParam xmlns="https://foo/"><b xmlns="https://foo/">Zm9v</b><t xmlns="https://foo/">2015-01-25T08:00:00Z</t></StructureParam></OperationRequest>`, util.Trim(string(body)), InputService10TestShapeInputService10TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/hostedzone", r.URL.String())

	// assert headers

}

func TestInputService11ProtocolTestHeaderMapsCase1(t *testing.T) {
	svc := NewInputService11ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService11TestShapeInputService11TestCaseOperation1Input{
		Foo: map[string]*string{
			"a": aws.String("b"),
			"c": aws.String("d"),
		},
	}
	req, _ := svc.InputService11TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers
	assert.Equal(t, "b", r.Header.Get("x-foo-a"))
	assert.Equal(t, "d", r.Header.Get("x-foo-c"))

}

func TestInputService12ProtocolTestQuerystringListOfStringsCase1(t *testing.T) {
	svc := NewInputService12ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService12TestShapeInputService12TestCaseOperation1Input{
		Items: []*string{
			aws.String("value1"),
			aws.String("value2"),
		},
	}
	req, _ := svc.InputService12TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/path?item=value1&item=value2", r.URL.String())

	// assert headers

}

func TestInputService13ProtocolTestStringToStringMapsInQuerystringCase1(t *testing.T) {
	svc := NewInputService13ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService13TestShapeInputService13TestCaseOperation1Input{
		PipelineId: aws.String("foo"),
		QueryDoc: map[string]*string{
			"bar":  aws.String("baz"),
			"fizz": aws.String("buzz"),
		},
	}
	req, _ := svc.InputService13TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/jobsByPipeline/foo?bar=baz&fizz=buzz", r.URL.String())

	// assert headers

}

func TestInputService14ProtocolTestStringToStringListMapsInQuerystringCase1(t *testing.T) {
	svc := NewInputService14ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService14TestShapeInputService14TestCaseOperation1Input{
		PipelineId: aws.String("id"),
		QueryDoc: map[string][]*string{
			"fizz": {
				aws.String("buzz"),
				aws.String("pop"),
			},
			"foo": {
				aws.String("bar"),
				aws.String("baz"),
			},
		},
	}
	req, _ := svc.InputService14TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/2014-01-01/jobsByPipeline/id?foo=bar&foo=baz&fizz=buzz&fizz=pop", r.URL.String())

	// assert headers

}

func TestInputService15ProtocolTestStringPayloadCase1(t *testing.T) {
	svc := NewInputService15ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService15TestShapeInputService15TestCaseOperation1Input{
		Foo: aws.String("bar"),
	}
	req, _ := svc.InputService15TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, `bar`, util.Trim(string(body)))

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService16ProtocolTestBlobPayloadCase1(t *testing.T) {
	svc := NewInputService16ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService16TestShapeInputShape{
		Foo: []byte("bar"),
	}
	req, _ := svc.InputService16TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	assert.Equal(t, `bar`, util.Trim(string(body)))

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService16ProtocolTestBlobPayloadCase2(t *testing.T) {
	svc := NewInputService16ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService16TestShapeInputShape{}
	req, _ := svc.InputService16TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService17ProtocolTestStructurePayloadCase1(t *testing.T) {
	svc := NewInputService17ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService17TestShapeInputShape{
		Foo: &InputService17TestShapeFooShape{
			Baz: aws.String("bar"),
		},
	}
	req, _ := svc.InputService17TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<foo><baz>bar</baz></foo>`, util.Trim(string(body)), InputService17TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService17ProtocolTestStructurePayloadCase2(t *testing.T) {
	svc := NewInputService17ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService17TestShapeInputShape{}
	req, _ := svc.InputService17TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService17ProtocolTestStructurePayloadCase3(t *testing.T) {
	svc := NewInputService17ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService17TestShapeInputShape{
		Foo: &InputService17TestShapeFooShape{},
	}
	req, _ := svc.InputService17TestCaseOperation3Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<foo></foo>`, util.Trim(string(body)), InputService17TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService17ProtocolTestStructurePayloadCase4(t *testing.T) {
	svc := NewInputService17ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService17TestShapeInputShape{}
	req, _ := svc.InputService17TestCaseOperation4Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService18ProtocolTestXMLAttributeCase1(t *testing.T) {
	svc := NewInputService18ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService18TestShapeInputService18TestCaseOperation1Input{
		Grant: &InputService18TestShapeGrant{
			Grantee: &InputService18TestShapeGrantee{
				EmailAddress: aws.String("foo@example.com"),
				Type:         aws.String("CanonicalUser"),
			},
		},
	}
	req, _ := svc.InputService18TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<Grant xmlns:_xmlns="xmlns" _xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:XMLSchema-instance="http://www.w3.org/2001/XMLSchema-instance" XMLSchema-instance:type="CanonicalUser"><Grantee><EmailAddress>foo@example.com</EmailAddress></Grantee></Grant>`, util.Trim(string(body)), InputService18TestShapeInputService18TestCaseOperation1Input{})

	// assert URL
	awstesting.AssertURL(t, "https://test/", r.URL.String())

	// assert headers

}

func TestInputService19ProtocolTestGreedyKeysCase1(t *testing.T) {
	svc := NewInputService19ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService19TestShapeInputService19TestCaseOperation1Input{
		Bucket: aws.String("my/bucket"),
		Key:    aws.String("testing /123"),
	}
	req, _ := svc.InputService19TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/my%2Fbucket/testing%20/123", r.URL.String())

	// assert headers

}

func TestInputService20ProtocolTestOmitsNullQueryParamsButSerializesEmptyStringsCase1(t *testing.T) {
	svc := NewInputService20ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService20TestShapeInputShape{}
	req, _ := svc.InputService20TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService20ProtocolTestOmitsNullQueryParamsButSerializesEmptyStringsCase2(t *testing.T) {
	svc := NewInputService20ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService20TestShapeInputShape{
		Foo: aws.String(""),
	}
	req, _ := svc.InputService20TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/path?abc=mno&param-name=", r.URL.String())

	// assert headers

}

func TestInputService21ProtocolTestRecursiveShapesCase1(t *testing.T) {
	svc := NewInputService21ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService21TestShapeInputShape{
		RecursiveStruct: &InputService21TestShapeRecursiveStructType{
			NoRecurse: aws.String("foo"),
		},
	}
	req, _ := svc.InputService21TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></RecursiveStruct></OperationRequest>`, util.Trim(string(body)), InputService21TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService21ProtocolTestRecursiveShapesCase2(t *testing.T) {
	svc := NewInputService21ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService21TestShapeInputShape{
		RecursiveStruct: &InputService21TestShapeRecursiveStructType{
			RecursiveStruct: &InputService21TestShapeRecursiveStructType{
				NoRecurse: aws.String("foo"),
			},
		},
	}
	req, _ := svc.InputService21TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></RecursiveStruct></RecursiveStruct></OperationRequest>`, util.Trim(string(body)), InputService21TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService21ProtocolTestRecursiveShapesCase3(t *testing.T) {
	svc := NewInputService21ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService21TestShapeInputShape{
		RecursiveStruct: &InputService21TestShapeRecursiveStructType{
			RecursiveStruct: &InputService21TestShapeRecursiveStructType{
				RecursiveStruct: &InputService21TestShapeRecursiveStructType{
					RecursiveStruct: &InputService21TestShapeRecursiveStructType{
						NoRecurse: aws.String("foo"),
					},
				},
			},
		},
	}
	req, _ := svc.InputService21TestCaseOperation3Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></RecursiveStruct></RecursiveStruct></RecursiveStruct></RecursiveStruct></OperationRequest>`, util.Trim(string(body)), InputService21TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService21ProtocolTestRecursiveShapesCase4(t *testing.T) {
	svc := NewInputService21ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService21TestShapeInputShape{
		RecursiveStruct: &InputService21TestShapeRecursiveStructType{
			RecursiveList: []*InputService21TestShapeRecursiveStructType{
				{
					NoRecurse: aws.String("foo"),
				},
				{
					NoRecurse: aws.String("bar"),
				},
			},
		},
	}
	req, _ := svc.InputService21TestCaseOperation4Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveList xmlns="https://foo/"><member xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></member><member xmlns="https://foo/"><NoRecurse xmlns="https://foo/">bar</NoRecurse></member></RecursiveList></RecursiveStruct></OperationRequest>`, util.Trim(string(body)), InputService21TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService21ProtocolTestRecursiveShapesCase5(t *testing.T) {
	svc := NewInputService21ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService21TestShapeInputShape{
		RecursiveStruct: &InputService21TestShapeRecursiveStructType{
			RecursiveList: []*InputService21TestShapeRecursiveStructType{
				{
					NoRecurse: aws.String("foo"),
				},
				{
					RecursiveStruct: &InputService21TestShapeRecursiveStructType{
						NoRecurse: aws.String("bar"),
					},
				},
			},
		},
	}
	req, _ := svc.InputService21TestCaseOperation5Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveList xmlns="https://foo/"><member xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></member><member xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><NoRecurse xmlns="https://foo/">bar</NoRecurse></RecursiveStruct></member></RecursiveList></RecursiveStruct></OperationRequest>`, util.Trim(string(body)), InputService21TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService21ProtocolTestRecursiveShapesCase6(t *testing.T) {
	svc := NewInputService21ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService21TestShapeInputShape{
		RecursiveStruct: &InputService21TestShapeRecursiveStructType{
			RecursiveMap: map[string]*InputService21TestShapeRecursiveStructType{
				"bar": {
					NoRecurse: aws.String("bar"),
				},
				"foo": {
					NoRecurse: aws.String("foo"),
				},
			},
		},
	}
	req, _ := svc.InputService21TestCaseOperation6Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<OperationRequest xmlns="https://foo/"><RecursiveStruct xmlns="https://foo/"><RecursiveMap xmlns="https://foo/"><entry xmlns="https://foo/"><key xmlns="https://foo/">foo</key><value xmlns="https://foo/"><NoRecurse xmlns="https://foo/">foo</NoRecurse></value></entry><entry xmlns="https://foo/"><key xmlns="https://foo/">bar</key><value xmlns="https://foo/"><NoRecurse xmlns="https://foo/">bar</NoRecurse></value></entry></RecursiveMap></RecursiveStruct></OperationRequest>`, util.Trim(string(body)), InputService21TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService22ProtocolTestTimestampInHeaderCase1(t *testing.T) {
	svc := NewInputService22ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService22TestShapeInputService22TestCaseOperation1Input{
		TimeArgInHeader: aws.Time(time.Unix(1422172800, 0)),
	}
	req, _ := svc.InputService22TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers
	assert.Equal(t, "Sun, 25 Jan 2015 08:00:00 GMT", r.Header.Get("x-amz-timearg"))

}

func TestInputService23ProtocolTestIdempotencyTokenAutoFillCase1(t *testing.T) {
	svc := NewInputService23ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService23TestShapeInputShape{
		Token: aws.String("abc123"),
	}
	req, _ := svc.InputService23TestCaseOperation1Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<Token>abc123</Token>`, util.Trim(string(body)), InputService23TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}

func TestInputService23ProtocolTestIdempotencyTokenAutoFillCase2(t *testing.T) {
	svc := NewInputService23ProtocolTest(unit.Session, &aws.Config{Endpoint: aws.String("https://test")})
	input := &InputService23TestShapeInputShape{}
	req, _ := svc.InputService23TestCaseOperation2Request(input)
	r := req.HTTPRequest

	// build request
	restxml.Build(req)
	assert.NoError(t, req.Error)

	// assert body
	assert.NotNil(t, r.Body)
	body := util.SortXML(r.Body)
	awstesting.AssertXML(t, `<Token>00000000-0000-4000-8000-000000000000</Token>`, util.Trim(string(body)), InputService23TestShapeInputShape{})

	// assert URL
	awstesting.AssertURL(t, "https://test/path", r.URL.String())

	// assert headers

}
