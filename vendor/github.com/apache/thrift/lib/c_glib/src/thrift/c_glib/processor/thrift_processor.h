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

#ifndef _THRIFT_PROCESSOR_H
#define _THRIFT_PROCESSOR_H

#include <glib-object.h>

#include <thrift/c_glib/protocol/thrift_protocol.h>

G_BEGIN_DECLS

/*! \file thrift_processor.h
 *  \brief Abstract class for Thrift processors.
 */

/* type macros */
#define THRIFT_TYPE_PROCESSOR (thrift_processor_get_type ())
#define THRIFT_PROCESSOR(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_PROCESSOR, ThriftProcessor))
#define THRIFT_IS_PROCESSOR(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_PROCESSOR))
#define THRIFT_PROCESSOR_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_PROCESSOR, ThriftProcessorClass))
#define THRIFT_IS_PROCESSOR_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_PROCESSOR))
#define THRIFT_PROCESSOR_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_PROCESSOR, ThriftProcessorClass))

/*!
 * Thrift Processorobject
 */
struct _ThriftProcessor
{
  GObject parent;
};
typedef struct _ThriftProcessor ThriftProcessor;

/*!
 * Thrift Processor class
 */
struct _ThriftProcessorClass
{
  GObjectClass parent;

  /* vtable */
  gboolean (*process) (ThriftProcessor *processor, ThriftProtocol *in,
                       ThriftProtocol *out, GError **error);
};
typedef struct _ThriftProcessorClass ThriftProcessorClass;

/* used by THRIFT_TYPE_PROCESSOR */
GType thrift_processor_get_type (void);

/*!
 * Processes the request.
 * \public \memberof ThriftProcessorClass
 */
gboolean thrift_processor_process (ThriftProcessor *processor,
                                   ThriftProtocol *in, ThriftProtocol *out,
                                   GError **error);

G_END_DECLS

#endif /* _THRIFT_PROCESSOR_H */
