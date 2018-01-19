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
#include <thrift/c_glib/thrift_application_exception.h>
#include <thrift/c_glib/processor/thrift_dispatch_processor.h>

G_DEFINE_ABSTRACT_TYPE (ThriftDispatchProcessor,
                        thrift_dispatch_processor,
                        THRIFT_TYPE_PROCESSOR)

gboolean
thrift_dispatch_processor_process (ThriftProcessor *processor,
                                   ThriftProtocol *in,
                                   ThriftProtocol *out,
                                   GError **error)
{
  gchar *fname;
  ThriftMessageType mtype;
  gint32 seqid;
  ThriftDispatchProcessor *dispatch_processor =
    THRIFT_DISPATCH_PROCESSOR (processor);

  /* Read the start of the message, which we expect to be a method call */
  if (thrift_protocol_read_message_begin (in,
                                          &fname,
                                          &mtype,
                                          &seqid,
                                          error) < 0) {
    g_warning ("error reading start of message: %s",
               (error != NULL) ? (*error)->message : "(null)");
    return FALSE;
  }
  else if (mtype != T_CALL && mtype != T_ONEWAY) {
    g_warning ("received invalid message type %d from client", mtype);
    return FALSE;
  }

  /* Dispatch the method call */
  return THRIFT_DISPATCH_PROCESSOR_GET_CLASS (dispatch_processor)
    ->dispatch_call (dispatch_processor,
                     in,
                     out,
                     fname,
                     seqid,
                     error);
}

static gboolean
thrift_dispatch_processor_real_dispatch_call (ThriftDispatchProcessor *self,
                                              ThriftProtocol *in,
                                              ThriftProtocol *out,
                                              gchar *fname,
                                              gint32 seqid,
                                              GError **error)
{
  ThriftTransport *transport;
  ThriftApplicationException *xception;
  gchar *message;
  gint32 result;
  gboolean dispatch_result = FALSE;

  THRIFT_UNUSED_VAR (self);

  /* By default, return an application exception to the client indicating the
     method name is not recognized. */

  if ((thrift_protocol_skip (in, T_STRUCT, error) < 0) ||
      (thrift_protocol_read_message_end (in, error) < 0))
    return FALSE;

  g_object_get (in, "transport", &transport, NULL);
  result = thrift_transport_read_end (transport, error);
  g_object_unref (transport);
  if (result < 0)
    return FALSE;

  if (thrift_protocol_write_message_begin (out,
                                           fname,
                                           T_EXCEPTION,
                                           seqid,
                                           error) < 0)
    return FALSE;
  message = g_strconcat ("Invalid method name: '", fname, "'", NULL);
  g_free (fname);
  xception =
    g_object_new (THRIFT_TYPE_APPLICATION_EXCEPTION,
                  "type",    THRIFT_APPLICATION_EXCEPTION_ERROR_UNKNOWN_METHOD,
                  "message", message,
                  NULL);
  g_free (message);
  result = thrift_struct_write (THRIFT_STRUCT (xception),
                                out,
                                error);
  g_object_unref (xception);
  if ((result < 0) ||
      (thrift_protocol_write_message_end (out, error) < 0))
    return FALSE;

  g_object_get (out, "transport", &transport, NULL);
  dispatch_result =
    ((thrift_transport_write_end (transport, error) >= 0) &&
     (thrift_transport_flush (transport, error) >= 0));
  g_object_unref (transport);

  return dispatch_result;
}

static void
thrift_dispatch_processor_init (ThriftDispatchProcessor *self)
{
  THRIFT_UNUSED_VAR (self);
}

static void
thrift_dispatch_processor_class_init (ThriftDispatchProcessorClass *klass)
{
  ThriftProcessorClass *processor_class =
    THRIFT_PROCESSOR_CLASS (klass);

  /* Implement ThriftProcessor's process method */
  processor_class->process = thrift_dispatch_processor_process;

  /* Provide a default implement for dispatch_call, which returns an exception
     to the client indicating the method name was not recognized */
  klass->dispatch_call = thrift_dispatch_processor_real_dispatch_call;
}
