// Copyright 2017 Microsoft Corporation. All rights reserved.
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

/*
Package pipeline implements an HTTP request/response middleware pipeline whose
policy objects mutate an HTTP request's URL, query parameters, and/or headers before
the request is sent over the wire.

Not all policy objects mutate an HTTP request; some policy objects simply impact the
flow of requests/responses by performing operations such as logging, retry policies,
timeouts, failure injection, and deserialization of response payloads.

Implementing the Policy Interface

To implement a policy, define a struct that implements the pipeline.Policy interface's Do method. Your Do
method is called when an HTTP request wants to be sent over the network. Your Do method can perform any
operation(s) it desires. For example, it can log the outgoing request, mutate the URL, headers, and/or query
parameters, inject a failure, etc. Your Do method must then forward the HTTP request to next Policy object
in a linked-list ensuring that the remaining Policy objects perform their work. Ultimately, the last Policy
object sends the HTTP request over the network (by calling the HTTPSender's Do method).

When an HTTP response comes back, each Policy object in the linked-list gets a chance to process the response
(in reverse order). The Policy object can log the response, retry the operation if due to a transient failure
or timeout, deserialize the response body, etc. Ultimately, the last Policy object returns the HTTP response
to the code that initiated the original HTTP request.

Here is a template for how to define a pipeline.Policy object:

   type myPolicy struct {
      node   PolicyNode
      // TODO: Add configuration/setting fields here (if desired)...
   }

   func (p *myPolicy) Do(ctx context.Context, request pipeline.Request) (pipeline.Response, error) {
      // TODO: Mutate/process the HTTP request here...
      response, err := p.node.Do(ctx, request)	// Forward HTTP request to next Policy & get HTTP response
      // TODO: Mutate/process the HTTP response here...
      return response, err	// Return response/error to previous Policy
   }

Implementing the Factory Interface

Each Policy struct definition requires a factory struct definition that implements the pipeline.Factory interface's New
method. The New method is called when application code wants to initiate a new HTTP request. Factory's New method is
passed a pipeline.PolicyNode object which contains a reference to the owning pipeline.Pipeline object (discussed later) and
a reference to the next Policy object in the linked list. The New method should create its corresponding Policy object
passing it the PolicyNode and any other configuration/settings fields appropriate for the specific Policy object.

Here is a template for how to define a pipeline.Policy object:

   // NOTE: Once created & initialized, Factory objects should be goroutine-safe (ex: immutable);
   // this allows reuse (efficient use of memory) and makes these objects usable by multiple goroutines concurrently.
   type myPolicyFactory struct {
      // TODO: Add any configuration/setting fields if desired...
   }

   func (f *myPolicyFactory) New(node pipeline.PolicyNode) Policy {
      return &myPolicy{node: node} // TODO: Also initialize any configuration/setting fields here (if desired)...
   }

Using your Factory and Policy objects via a Pipeline

To use the Factory and Policy objects, an application constructs a slice of Factory objects and passes
this slice to the pipeline.NewPipeline function.

   func NewPipeline(factories []pipeline.Factory, sender pipeline.HTTPSender) Pipeline

This function also requires an object implementing the HTTPSender interface. For simple scenarios,
passing nil for HTTPSender causes a standard Go http.Client object to be created and used to actually
send the HTTP response over the network. For more advanced scenarios, you can pass your own HTTPSender
object in. This allows sharing of http.Client objects or the use of custom-configured http.Client objects
or other objects that can simulate the network requests for testing purposes.

Now that you have a pipeline.Pipeline object, you can create a pipeline.Request object (which is a simple
wrapper around Go's standard http.Request object) and pass it to Pipeline's Do method along with passing a
context.Context for cancelling the HTTP request (if desired).

   type Pipeline interface {
      Do(ctx context.Context, methodFactory pipeline.Factory, request pipeline.Request) (pipeline.Response, error)
   }

Do iterates over the slice of Factory objects and tells each one to create its corresponding
Policy object. After the linked-list of Policy objects have been created, Do calls the first
Policy object passing it the Context & HTTP request parameters. These parameters now flow through
all the Policy objects giving each object a chance to look at and/or mutate the HTTP request.
The last Policy object sends the message over the network.

When the network operation completes, the HTTP response and error return values pass
back through the same Policy objects in reverse order. Most Policy objects ignore the
response/error but some log the result, retry the operation (depending on the exact
reason the operation failed), or deserialize the response's body. Your own Policy
objects can do whatever they like when processing outgoing requests or incoming responses.

Note that after an I/O request runs to completion, the Policy objects for that request
are garbage collected. However, Pipeline object (like Factory objects) are goroutine-safe allowing
them to be created once and reused over many I/O operations. This allows for efficient use of
memory and also makes them safely usable by multiple goroutines concurrently.

Inserting a Method-Specific Factory into the Linked-List of Policy Objects

While Pipeline and Factory objects can be reused over many different operations, it is
common to have special behavior for a specific operation/method. For example, a method
may need to deserialize the response's body to an instance of a specific data type.
To accommodate this, the Pipeline's Do method takes an additional method-specific
Factory object. The Do method tells this Factory to create a Policy object and
injects this method-specific Policy object into the linked-list of Policy objects.

When creating a Pipeline object, the slice of Factory objects passed must have 1
(and only 1) entry marking where the method-specific Factory should be injected.
The Factory marker is obtained by calling the pipeline.MethodFactoryMarker() function:

   func MethodFactoryMarker() pipeline.Factory

Creating an HTTP Request Object

The HTTP request object passed to Pipeline's Do method is not Go's http.Request struct.
Instead, it is a pipeline.Request struct which is a simple wrapper around Go's standard
http.Request. You create a pipeline.Request object by calling the pipeline.NewRequest function:

   func NewRequest(method string, url url.URL, options pipeline.RequestOptions) (request pipeline.Request, err error)

To this function, you must pass a pipeline.RequestOptions that looks like this:

   type RequestOptions struct {
      // The readable and seekable stream to be sent to the server as the request's body.
      Body io.ReadSeeker

      // The callback method (if not nil) to be invoked to report progress as the stream is uploaded in the HTTP request.
      Progress ProgressReceiver
   }

The method and struct ensure that the request's body stream is a read/seekable stream.
A seekable stream is required so that upon retry, the final Policy object can seek
the stream back to the beginning before retrying the network request and re-uploading the
body. In addition, you can associate a ProgressReceiver callback function which will be
invoked periodically to report progress while bytes are being read from the body stream
and sent over the network.

Processing the HTTP Response

When an HTTP response comes in from the network, a reference to Go's http.Response struct is
embedded in a struct that implements the pipeline.Response interface:

   type Response interface {
      Response() *http.Response
   }

This interface is returned through all the Policy objects. Each Policy object can call the Response
interface's Response method to examine (or mutate) the embedded http.Response object.

A Policy object can internally define another struct (implementing the pipeline.Response interface)
that embeds an http.Response and adds additional fields and return this structure to other Policy
objects. This allows a Policy object to deserialize the body to some other struct and return the
original http.Response and the additional struct back through the Policy chain. Other Policy objects
can see the Response but cannot see the additional struct with the deserialized body. After all the
Policy objects have returned, the pipeline.Response interface is returned by Pipeline's Do method.
The caller of this method can perform a type assertion attempting to get back to the struct type
really returned by the Policy object. If the type assertion is successful, the caller now has
access to both the http.Response and the deserialized struct object.*/
package pipeline
