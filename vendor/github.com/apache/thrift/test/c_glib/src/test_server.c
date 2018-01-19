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

#include <glib-object.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol_factory.h>
#include <thrift/c_glib/protocol/thrift_compact_protocol_factory.h>
#include <thrift/c_glib/server/thrift_server.h>
#include <thrift/c_glib/server/thrift_simple_server.h>
#include <thrift/c_glib/transport/thrift_buffered_transport.h>
#include <thrift/c_glib/transport/thrift_buffered_transport_factory.h>
#include <thrift/c_glib/transport/thrift_framed_transport.h>
#include <thrift/c_glib/transport/thrift_framed_transport_factory.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>
#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_transport_factory.h>

#include "../gen-c_glib/t_test_thrift_test.h"

#include "thrift_test_handler.h"

/* Our server object, declared globally so it is accessible within the SIGINT
   signal handler */
ThriftServer *server = NULL;

/* A flag that indicates whether the server was interrupted with SIGINT
   (i.e. Ctrl-C) so we can tell whether its termination was abnormal */
gboolean sigint_received = FALSE;

/* Handle SIGINT ("Ctrl-C") signals by gracefully stopping the server */
static void
sigint_handler (int signal_number)
{
  THRIFT_UNUSED_VAR (signal_number);

  /* Take note we were called */
  sigint_received = TRUE;

  /* Shut down the server gracefully */
  if (server != NULL)
    thrift_server_stop (server);
}

int
main (int argc, char **argv)
{
  static gint   port = 9090;
  static gchar *server_type_option = NULL;
  static gchar *transport_option = NULL;
  static gchar *protocol_option = NULL;
  static gint   string_limit = 0;
  static gint   container_limit = 0;

  static
    GOptionEntry option_entries[] = {
    { "port",            0, 0, G_OPTION_ARG_INT,      &port,
      "Port number to connect (=9090)", NULL },
    { "server-type",     0, 0, G_OPTION_ARG_STRING,   &server_type_option,
      "Type of server: simple (=simple)", NULL },
    { "transport",       0, 0, G_OPTION_ARG_STRING,   &transport_option,
      "Transport: buffered, framed (=buffered)", NULL },
    { "protocol",        0, 0, G_OPTION_ARG_STRING,   &protocol_option,
      "Protocol: binary, compact (=binary)", NULL },
    { "string-limit",    0, 0, G_OPTION_ARG_INT,      &string_limit,
      "Max string length (=none)", NULL },
    { "container-limit", 0, 0, G_OPTION_ARG_INT,      &container_limit,
      "Max container length (=none)", NULL },
    { NULL }
  };

  gchar *server_name            = "simple";
  gchar *transport_name         = "buffered";
  GType  transport_factory_type = THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY;
  gchar *protocol_name          = "binary";
  GType  protocol_factory_type  = THRIFT_TYPE_BINARY_PROTOCOL_FACTORY;

  TTestThriftTestHandler *handler;
  ThriftProcessor        *processor;
  ThriftServerTransport  *server_transport;
  ThriftTransportFactory *transport_factory;
  ThriftProtocolFactory  *protocol_factory;

  struct sigaction sigint_action;

  GOptionContext *option_context;
  gboolean        options_valid = TRUE;

  GError *error = NULL;

#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  /* Configure and parse our command-line options */
  option_context = g_option_context_new (NULL);
  g_option_context_add_main_entries (option_context,
                                     option_entries,
                                     NULL);
  if (g_option_context_parse (option_context,
                              &argc,
                              &argv,
                              &error) == FALSE) {
    fprintf (stderr, "%s\n", error->message);
    return 255;
  }
  g_option_context_free (option_context);

  /* Validate the parsed options */
  if (server_type_option != NULL &&
      strncmp (server_type_option, "simple", 7) != 0) {
    fprintf (stderr, "Unknown server type %s\n", protocol_option);
    options_valid = FALSE;
  }

  if (protocol_option != NULL) {
    if (strncmp (protocol_option, "compact", 8) == 0) {
      protocol_factory_type = THRIFT_TYPE_COMPACT_PROTOCOL_FACTORY;
      protocol_name = "compact";
    }
    else if (strncmp (protocol_option, "binary", 7) != 0) {
      fprintf (stderr, "Unknown protocol type %s\n", protocol_option);
      options_valid = FALSE;
    }
  }

  if (transport_option != NULL) {
    if (strncmp (transport_option, "framed", 7) == 0) {
      transport_factory_type = THRIFT_TYPE_FRAMED_TRANSPORT_FACTORY;
      transport_name = "framed";
    }
    else if (strncmp (transport_option, "buffered", 9) != 0) {
      fprintf (stderr, "Unknown transport type %s\n", transport_option);
      options_valid = FALSE;
    }
  }

  if (!options_valid)
    return 254;

  /* Establish all our connection objects */
  handler           = g_object_new (TYPE_THRIFT_TEST_HANDLER,
                                    NULL);
  processor         = g_object_new (T_TEST_TYPE_THRIFT_TEST_PROCESSOR,
                                    "handler", handler,
                                    NULL);
  server_transport  = g_object_new (THRIFT_TYPE_SERVER_SOCKET,
                                    "port", port,
                                    NULL);
  transport_factory = g_object_new (transport_factory_type,
                                    NULL);

  if (strncmp (protocol_name, "compact", 8) == 0) {
    protocol_factory  = g_object_new (protocol_factory_type,
                                      "string_limit", string_limit,
                                      "container_limit", container_limit,
                                      NULL);
  } else {
    protocol_factory  = g_object_new (protocol_factory_type,
                                      NULL);
  }

  server = g_object_new (THRIFT_TYPE_SIMPLE_SERVER,
                         "processor",                processor,
                         "server_transport",         server_transport,
                         "input_transport_factory",  transport_factory,
                         "output_transport_factory", transport_factory,
                         "input_protocol_factory",   protocol_factory,
                         "output_protocol_factory",  protocol_factory,
                         NULL);

  /* Install our SIGINT handler, which handles Ctrl-C being pressed by stopping
     the server gracefully */
  memset (&sigint_action, 0, sizeof (sigint_action));
  sigint_action.sa_handler = sigint_handler;
  sigint_action.sa_flags = SA_RESETHAND;
  sigaction (SIGINT, &sigint_action, NULL);

  printf ("Starting \"%s\" server (%s/%s) listen on: %d\n",
          server_name,
          transport_name,
          protocol_name,
          port);
  fflush (stdout);

  /* Serve clients until SIGINT is received (Ctrl-C is pressed) */
  thrift_server_serve (server, &error);

  /* If the server stopped for any reason other than being interrupted by the
     user, report the error */
  if (!sigint_received) {
    g_message ("thrift_server_serve: %s",
               error != NULL ? error->message : "(null)");
    g_clear_error (&error);
  }

  puts ("done.");

  g_object_unref (server);
  g_object_unref (protocol_factory);
  g_object_unref (transport_factory);
  g_object_unref (server_transport);
  g_object_unref (processor);
  g_object_unref (handler);

  return 0;
}
