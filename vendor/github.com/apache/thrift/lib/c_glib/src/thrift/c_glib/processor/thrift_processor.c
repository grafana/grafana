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

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/processor/thrift_processor.h>

G_DEFINE_ABSTRACT_TYPE(ThriftProcessor, thrift_processor, G_TYPE_OBJECT)

gboolean
thrift_processor_process (ThriftProcessor *processor, ThriftProtocol *in,
                          ThriftProtocol *out, GError **error)
{
  return
    THRIFT_PROCESSOR_GET_CLASS (processor)->process (processor, in, out, error);
}

/* class initializer for ThriftProcessor */
static void
thrift_processor_class_init (ThriftProcessorClass *cls)
{
  /* set these as virtual methods to be implemented by a subclass */
  cls->process = thrift_processor_process;
}

static void
thrift_processor_init (ThriftProcessor *processor)
{
  THRIFT_UNUSED_VAR (processor);
}
