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

#include <stdio.h>
#include <glib-object.h>

#include <thrift/c_glib/protocol/thrift_binary_protocol.h>
#include <thrift/c_glib/transport/thrift_buffered_transport.h>
#include <thrift/c_glib/transport/thrift_socket.h>

#include "gen-c_glib/calculator.h"

int main (void)
{
  ThriftSocket *socket;
  ThriftTransport *transport;
  ThriftProtocol *protocol;
  CalculatorIf *client;

  GError *error = NULL;
  InvalidOperation *invalid_operation = NULL;

  Work *work;

  gint32 sum;
  gint32 diff;

  int exit_status = 0;

#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  socket    = g_object_new (THRIFT_TYPE_SOCKET,
                            "hostname",  "localhost",
                            "port",      9090,
                            NULL);
  transport = g_object_new (THRIFT_TYPE_BUFFERED_TRANSPORT,
                            "transport", socket,
                            NULL);
  protocol  = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL,
                            "transport", transport,
                            NULL);

  thrift_transport_open (transport, &error);


  /* In the C (GLib) implementation of Thrift, service methods on the
     server are accessed via a generated client class that implements
     the service interface. In this tutorial, we access a Calculator
     service through an instance of CalculatorClient, which implements
     CalculatorIf. */
  client = g_object_new (TYPE_CALCULATOR_CLIENT,
                         "input_protocol",  protocol,
                         "output_protocol", protocol,
                         NULL);

  /* Each of the client methods requires at least two parameters: A
     pointer to the client-interface implementation (the client
     object), and a handle to a GError structure to receive
     information about any error that occurs.

     On success, client methods return TRUE. A return value of FALSE
     indicates an error occurred and the error parameter has been
     set. */
  if (!error && calculator_if_ping (client, &error)) {
    puts ("ping()");
  }

  /* Service methods that return a value do so by passing the result
     back via an output parameter (here, "sum"). */
  if (!error && calculator_if_add (client, &sum, 1, 1, &error)) {
    printf ("1+1=%d\n", sum);
  }

  /* Thrift structs are implemented as GObjects, with each of the
     struct's members exposed as an object property. */
  work = g_object_new (TYPE_WORK, NULL);

  if (!error) {
    g_object_set (work,
                  "num1", 1,
                  "num2", 0,
                  "op",   OPERATION_DIVIDE,
                  NULL);

    /* Exceptions are passed back from service methods in a manner
       similar to return values. */
    if (calculator_if_calculate (client,
                                 NULL,
                                 1,
                                 work,
                                 &invalid_operation,
                                 &error)) {
      puts ("Whoa? We can divide by zero!");
    }
    else {
      if (invalid_operation) {
        gchar *why;

        /* Like structs, exceptions are implemented as objects with
           properties. */
        g_object_get (invalid_operation, "why", &why, NULL);

        printf ("InvalidOperation: %s\n", why);

        if (why != NULL)
          g_free (why);
        g_object_unref (invalid_operation);
        invalid_operation = NULL;
      }

      g_clear_error (&error);
    }
  }

  if (!error) {
    /* Struct objects can be reused across method invocations. */
    g_object_set (work,
                  "num1", 15,
                  "num2", 10,
                  "op",   OPERATION_SUBTRACT,
                  NULL);

    if (calculator_if_calculate (client,
                                 &diff,
                                 1,
                                 work,
                                 &invalid_operation,
                                 &error)) {
      printf ("15-10=%d\n", diff);
    }
  }

  g_object_unref (work);

  if (!error) {
    SharedStruct *shared_struct;
    gchar *value;

    shared_struct = g_object_new (TYPE_SHARED_STRUCT, NULL);

    /* As defined in the Thrift file, the Calculator service extends
       the SharedService service. Correspondingly, in the generated
       code CalculatorIf inherits from SharedServiceIf, and the parent
       service's methods are accessible through a simple cast. */
    if (shared_service_client_get_struct (SHARED_SERVICE_IF (client),
                                          &shared_struct,
                                          1,
                                          &error)) {
      g_object_get (shared_struct, "value", &value, NULL);
      printf ("Check log: %s\n", value);
      g_free (value);
    }

    g_object_unref (shared_struct);
  }

  if (error) {
    printf ("ERROR: %s\n", error->message);
    g_clear_error (&error);

    exit_status = 1;
  }

  thrift_transport_close (transport, NULL);

  g_object_unref (client);
  g_object_unref (protocol);
  g_object_unref (transport);
  g_object_unref (socket);

  return exit_status;
}
