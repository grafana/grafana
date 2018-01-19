/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#ifndef _THRIFT_DISPATCH_PROCESSOR_H
#define _THRIFT_DISPATCH_PROCESSOR_H

#include <glib-object.h>

#include <thrift/c_glib/processor/thrift_processor.h>

G_BEGIN_DECLS

/*! \file thrift_dispatch_processor.h
 *  \brief Parses a method-call message header and invokes a function
 *         to dispatch the call by function name.
 *
 * ThriftDispatchProcessor is an abstract helper class that parses the
 * header of a method-call message and invokes a member function,
 * dispatch_call, with the method's name.
 *
 * Subclasses must implement dispatch_call to dispatch the method call
 * to the implementing function.
 */

/* Type macros */
#define THRIFT_TYPE_DISPATCH_PROCESSOR (thrift_dispatch_processor_get_type ())
#define THRIFT_DISPATCH_PROCESSOR(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_DISPATCH_PROCESSOR, ThriftDispatchProcessor))
#define THRIFT_IS_DISPATCH_PROCESSOR(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_DISPATCH_PROCESSOR))
#define THRIFT_DISPATCH_PROCESSOR_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_DISPATCH_PROCESSOR, ThriftDispatchProcessorClass))
#define THRIFT_IS_DISPATCH_PROCESSOR_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_DISPATCH_PROCESSOR))
#define THRIFT_DISPATCH_PROCESSOR_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_DISPATCH_PROCESSOR, ThriftDispatchProcessorClass))

/*!
 * Thrift Dispatch Processor object
 */
struct _ThriftDispatchProcessor
{
  ThriftProcessor parent;
};
typedef struct _ThriftDispatchProcessor ThriftDispatchProcessor;

/*!
 * Thrift Dispatch Processor class
 */
struct _ThriftDispatchProcessorClass
{
  ThriftProcessorClass parent;

  /* public */
  gboolean (*process) (ThriftProcessor *processor,
                       ThriftProtocol *in,
                       ThriftProtocol *out,
                       GError **error);

  /* protected */
  gboolean (*dispatch_call) (ThriftDispatchProcessor *self,
                             ThriftProtocol *in,
                             ThriftProtocol *out,
                             gchar *fname,
                             gint32 seqid,
                             GError **error);
};
typedef struct _ThriftDispatchProcessorClass ThriftDispatchProcessorClass;

/* Used by THRIFT_TYPE_DISPATCH_PROCESSOR */
GType thrift_dispatch_processor_get_type (void);

/*!
 * Processes a request.
 * \public \memberof ThriftDispatchProcessorClass
 */
gboolean thrift_dispatch_processor_process (ThriftProcessor *processor,
                                            ThriftProtocol *in,
                                            ThriftProtocol *out,
                                            GError **error);

G_END_DECLS

#endif /* _THRIFT_DISPATCH_PROCESSOR_H */
