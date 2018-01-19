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

#include "gen-c_glib/t_test_container_test_types.h"
#include "gen-c_glib/t_test_container_service.h"

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol_factory.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol.h>
#include <thrift/c_glib/protocol/thrift_protocol_factory.h>
#include <thrift/c_glib/server/thrift_server.h>
#include <thrift/c_glib/server/thrift_simple_server.h>
#include <thrift/c_glib/transport/thrift_buffered_transport_factory.h>
#include <thrift/c_glib/transport/thrift_buffered_transport.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>
#include <thrift/c_glib/transport/thrift_socket.h>

#include <glib-object.h>
#include <glib.h>

#include <unistd.h>
#include <signal.h>
#include <string.h>
#include <sys/wait.h>
#include <sys/types.h>

#define TEST_SERVER_HOSTNAME "localhost"
#define TEST_SERVER_PORT     9090

/* --------------------------------------------------------------------------
   The ContainerService handler we'll use for testing */

G_BEGIN_DECLS

GType test_container_service_handler_get_type (void);

#define TYPE_TEST_CONTAINER_SERVICE_HANDLER \
  (test_container_service_handler_get_type ())

#define TEST_CONTAINER_SERVICE_HANDLER(obj)                             \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj),                                   \
                               TYPE_TEST_CONTAINER_SERVICE_HANDLER,     \
                               TestContainerServiceHandler))
#define TEST_CONTAINER_SERVICE_HANDLER_CLASS(c)                         \
  (G_TYPE_CHECK_CLASS_CAST ((c),                                        \
                            TYPE_TEST_CONTAINER_SERVICE_HANDLER,        \
                            TestContainerServiceHandlerClass))
#define IS_TEST_CONTAINER_SERVICE_HANDLER(obj)                          \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj),                                   \
                               TYPE_TEST_CONTAINER_SERVICE_HANDLER))
#define IS_TEST_CONTAINER_SERVICE_HANDLER_CLASS(c)                      \
  (G_TYPE_CHECK_CLASS_TYPE ((c),                                        \
                            TYPE_TEST_CONTAINER_SERVICE_HANDLER))
#define TEST_CONTAINER_SERVICE_HANDLER_GET_CLASS(obj)                   \
  (G_TYPE_INSTANCE_GET_CLASS ((obj),                                    \
                              TYPE_TEST_CONTAINER_SERVICE_HANDLER,      \
                              TestContainerServiceHandlerClass))

struct _TestContainerServiceHandler {
  TTestContainerServiceHandler parent_instance;

  /* private */
  GPtrArray *string_list;
};
typedef struct _TestContainerServiceHandler TestContainerServiceHandler;

struct _TestContainerServiceHandlerClass {
  TTestContainerServiceHandlerClass parent_class;
};
typedef struct _TestContainerServiceHandlerClass
  TestContainerServiceHandlerClass;

G_END_DECLS

/* -------------------------------------------------------------------------- */

G_DEFINE_TYPE (TestContainerServiceHandler,
               test_container_service_handler,
               T_TEST_TYPE_CONTAINER_SERVICE_HANDLER)

/* A helper function used to append copies of strings to a string list */
static void append_string_to_ptr_array (gpointer element, gpointer ptr_array)
{
  g_ptr_array_add ((GPtrArray *)ptr_array, g_strdup ((gchar *)element));
}

/* Accept a string list from the client and append its contents to our internal
   list */
static gboolean
test_container_service_handler_receive_string_list (TTestContainerServiceIf *iface,
                                                    const GPtrArray *stringList,
                                                    GError **error)
{
  TestContainerServiceHandler *self = TEST_CONTAINER_SERVICE_HANDLER (iface);

  /* Append the client's strings to our own internal string list */
  g_ptr_array_foreach ((GPtrArray *)stringList,
                       append_string_to_ptr_array,
                       self->string_list);

  g_clear_error (error);
  return TRUE;
}

/* Return the contents of our internal string list to the client */
static gboolean
test_container_service_handler_return_string_list (TTestContainerServiceIf *iface,
                                                   GPtrArray **_return,
                                                   GError **error)
{
  TestContainerServiceHandler *self = TEST_CONTAINER_SERVICE_HANDLER (iface);

  /* Return (copies of) the strings contained in our list */
  g_ptr_array_foreach (self->string_list,
                       append_string_to_ptr_array,
                       *_return);

  g_clear_error (error);
  return TRUE;
}

static gboolean
test_container_service_handler_return_list_string_list (TTestContainerServiceIf *iface,
                                                        GPtrArray **_return,
                                                        GError **error)
{
  TestContainerServiceHandler *self = TEST_CONTAINER_SERVICE_HANDLER (iface);
  GPtrArray *nested_list;

  /* Return a list containing our list of strings */
  nested_list
    = g_ptr_array_new_with_free_func ((GDestroyNotify)g_ptr_array_unref);
  g_ptr_array_add (nested_list, self->string_list);
  g_ptr_array_ref (self->string_list);

  g_ptr_array_add (*_return, nested_list);

  g_clear_error (error);
  return TRUE;
}

static gboolean
test_container_service_handler_return_typedefd_list_string_list (TTestContainerServiceIf *iface,
                                                                 TTestListStringList **_return,
                                                                 GError **error)
{
  TestContainerServiceHandler *self = TEST_CONTAINER_SERVICE_HANDLER (iface);
  TTestStringList *nested_list;

  /* Return a list containing our list of strings */
  nested_list
    = g_ptr_array_new_with_free_func ((GDestroyNotify)g_ptr_array_unref);
  g_ptr_array_add (nested_list, self->string_list);
  g_ptr_array_ref (self->string_list);

  g_ptr_array_add (*_return, nested_list);

  g_clear_error (error);
  return TRUE;
}

static void
test_container_service_handler_finalize (GObject *object) {
  TestContainerServiceHandler *self = TEST_CONTAINER_SERVICE_HANDLER (object);

  /* Destroy our internal containers */
  g_ptr_array_unref (self->string_list);
  self->string_list = NULL;

  G_OBJECT_CLASS (test_container_service_handler_parent_class)->
    finalize (object);
}

static void
test_container_service_handler_init (TestContainerServiceHandler *self)
{
  /* Create our internal containers */
  self->string_list = g_ptr_array_new_with_free_func (g_free);
}

static void
test_container_service_handler_class_init (TestContainerServiceHandlerClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  TTestContainerServiceHandlerClass *parent_class =
    T_TEST_CONTAINER_SERVICE_HANDLER_CLASS (klass);

  gobject_class->finalize = test_container_service_handler_finalize;

  parent_class->receive_string_list =
    test_container_service_handler_receive_string_list;
  parent_class->return_string_list =
    test_container_service_handler_return_string_list;
  parent_class->return_list_string_list =
    test_container_service_handler_return_list_string_list;
  parent_class->return_typedefd_list_string_list =
    test_container_service_handler_return_typedefd_list_string_list;
}

/* -------------------------------------------------------------------------- */

/* Our test server, declared globally so we can access it within a signal
   handler */
ThriftServer *server = NULL;

/* A signal handler used to detect when the child process (the test suite) has
   exited so we know to shut down the server and terminate ourselves */
static void
sigchld_handler (int signal_number)
{
  THRIFT_UNUSED_VAR (signal_number);

  /* The child process (the tests) has exited or been terminated; shut down the
     server gracefully */
  if (server != NULL)
    thrift_server_stop (server);
}

/* A helper function that executes a test case against a newly constructed
   service client */
static void
execute_with_service_client (void (*test_case)(TTestContainerServiceIf *,
                                               GError **))
{
  ThriftSocket *socket;
  ThriftTransport *transport;
  ThriftProtocol *protocol;

  TTestContainerServiceIf *client;

  GError *error = NULL;

  /* Create a client with which to access the server */
  socket    = g_object_new (THRIFT_TYPE_SOCKET,
                            "hostname", TEST_SERVER_HOSTNAME,
                            "port",     TEST_SERVER_PORT,
                            NULL);
  transport = g_object_new (THRIFT_TYPE_BUFFERED_TRANSPORT,
                            "transport", socket,
                            NULL);
  protocol  = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL,
                            "transport", transport,
                            NULL);

  thrift_transport_open (transport, &error);
  g_assert_no_error (error);

  client = g_object_new (T_TEST_TYPE_CONTAINER_SERVICE_CLIENT,
                         "input_protocol",  protocol,
                         "output_protocol", protocol,
                         NULL);

  /* Execute the test against this client */
  (*test_case)(client, &error);
  g_assert_no_error (error);

  /* Clean up and exit */
  thrift_transport_close (transport, NULL);

  g_object_unref (client);
  g_object_unref (protocol);
  g_object_unref (transport);
  g_object_unref (socket);
}

static void
test_containers_with_default_values (void)
{
  TTestContainersWithDefaultValues *default_values;
  GPtrArray *string_list;

  /* Fetch a new ContainersWithDefaultValues struct and its StringList member */
  default_values = g_object_new (T_TEST_TYPE_CONTAINERS_WITH_DEFAULT_VALUES,
                                 NULL);
  g_object_get (default_values,
                "StringList", &string_list,
                NULL);

  /* Make sure the list has been populated with its default values */
  g_assert_cmpint (string_list->len, ==, 2);
  g_assert_cmpstr (((gchar **)string_list->pdata)[0], ==, "Apache");
  g_assert_cmpstr (((gchar **)string_list->pdata)[1], ==, "Thrift");

  g_ptr_array_unref (string_list);
  g_object_unref (default_values);
}

static void
test_container_service_string_list_inner (TTestContainerServiceIf *client,
                                          GError **error)
{
  gchar *test_data[] = { "one", "two", "three" };

  GPtrArray *outgoing_string_list;
  GPtrArray *incoming_string_list;
  guint index;

  g_clear_error (error);

  /* Prepare our test data (our string list to send) */
  outgoing_string_list = g_ptr_array_new ();
  for (index = 0; index < 3; index += 1)
    g_ptr_array_add (outgoing_string_list, &test_data[index]);

  /* Send our data to the server and make sure we get the same data back on
     retrieve */
  g_assert
    (t_test_container_service_client_receive_string_list (client,
                                                          outgoing_string_list,
                                                          error) &&
     *error == NULL);

  incoming_string_list = g_ptr_array_new ();
  g_assert
    (t_test_container_service_client_return_string_list (client,
                                                         &incoming_string_list,
                                                         error) &&
     *error == NULL);

  /* Make sure the two lists are equivalent */
  g_assert_cmpint (incoming_string_list->len, ==, outgoing_string_list->len);
  for (index = 0; index < incoming_string_list->len; index += 1)
    g_assert_cmpstr (((gchar **)incoming_string_list->pdata)[index],
                     ==,
                     ((gchar **)outgoing_string_list->pdata)[index]);

  /* Clean up and exit */
  g_ptr_array_unref (incoming_string_list);
  g_ptr_array_unref (outgoing_string_list);
}

static void
test_container_service_string_list (void)
{
    execute_with_service_client (test_container_service_string_list_inner);
}

static void
test_container_service_list_string_list_inner (TTestContainerServiceIf *client,
                                               GError **error)
{
  GPtrArray *incoming_list;
  GPtrArray *nested_list;

  g_clear_error (error);

  /* Receive a list of string lists from the server */
  incoming_list =
    g_ptr_array_new_with_free_func ((GDestroyNotify)g_ptr_array_unref);
  g_assert
    (t_test_container_service_client_return_list_string_list (client,
                                                              &incoming_list,
                                                              error) &&
     *error == NULL);

  /* Make sure the list and its contents are valid */
  g_assert_cmpint (incoming_list->len, >, 0);

  nested_list = (GPtrArray *)g_ptr_array_index (incoming_list, 0);
  g_assert (nested_list != NULL);
  g_assert_cmpint (nested_list->len, >=, 0);

  /* Clean up and exit */
  g_ptr_array_unref (incoming_list);
}

static void
test_container_service_list_string_list (void)
{
  execute_with_service_client (test_container_service_list_string_list_inner);
}

static void
test_container_service_typedefd_list_string_list_inner (TTestContainerServiceIf *client,
                                                        GError **error)
{
  TTestListStringList *incoming_list;
  TTestStringList *nested_list;

  g_clear_error (error);

  /* Receive a list of string lists from the server */
  incoming_list =
    g_ptr_array_new_with_free_func ((GDestroyNotify)g_ptr_array_unref);
  g_assert
    (t_test_container_service_client_return_list_string_list (client,
                                                              &incoming_list,
                                                              error) &&
     *error == NULL);

  /* Make sure the list and its contents are valid */
  g_assert_cmpint (incoming_list->len, >, 0);

  nested_list = (TTestStringList *)g_ptr_array_index (incoming_list, 0);
  g_assert (nested_list != NULL);
  g_assert_cmpint (nested_list->len, >=, 0);

  /* Clean up and exit */
  g_ptr_array_unref (incoming_list);
}

static void
test_container_service_typedefd_list_string_list (void)
{
  execute_with_service_client
    (test_container_service_typedefd_list_string_list_inner);
}

int
main(int argc, char *argv[])
{
  pid_t pid;
  int status;

#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  /* Fork to run our test suite in a child process */
  pid = fork ();
  g_assert_cmpint (pid, >=, 0);

  if (pid == 0) {    /* The child process */
    /* Wait a moment for the server to finish starting */
    sleep (1);

    g_test_init (&argc, &argv, NULL);

    g_test_add_func
      ("/testcontainertest/ContainerTest/Structs/ContainersWithDefaultValues",
       test_containers_with_default_values);
    g_test_add_func
      ("/testcontainertest/ContainerTest/Services/ContainerService/StringList",
       test_container_service_string_list);
    g_test_add_func
      ("/testcontainertest/ContainerTest/Services/ContainerService/ListStringList",
       test_container_service_list_string_list);
    g_test_add_func
      ("/testcontainertest/ContainerTest/Services/ContainerService/TypedefdListStringList",
       test_container_service_typedefd_list_string_list);

    /* Run the tests and make the result available to our parent process */
    _exit (g_test_run ());
  }
  else {
    TTestContainerServiceHandler *handler;
    TTestContainerServiceProcessor *processor;

    ThriftServerTransport *server_transport;
    ThriftTransportFactory *transport_factory;
    ThriftProtocolFactory *protocol_factory;

    struct sigaction sigchld_action;

    GError *error = NULL;
    int exit_status = 1;

    /* Trap the event of the child process terminating so we know to stop the
       server and exit */
    memset (&sigchld_action, 0, sizeof (sigchld_action));
    sigchld_action.sa_handler = sigchld_handler;
    sigchld_action.sa_flags = SA_RESETHAND;
    sigaction (SIGCHLD, &sigchld_action, NULL);

    /* Create our test server */
    handler = g_object_new (TYPE_TEST_CONTAINER_SERVICE_HANDLER,
                            NULL);
    processor = g_object_new (T_TEST_TYPE_CONTAINER_SERVICE_PROCESSOR,
                              "handler", handler,
                              NULL);
    server_transport = g_object_new (THRIFT_TYPE_SERVER_SOCKET,
                                     "port", TEST_SERVER_PORT,
                                     NULL);
    transport_factory = g_object_new (THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY,
                                      NULL);
    protocol_factory = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL_FACTORY,
                                     NULL);

    server = g_object_new (THRIFT_TYPE_SIMPLE_SERVER,
                           "processor",                processor,
                           "server_transport",         server_transport,
                           "input_transport_factory",  transport_factory,
                           "output_transport_factory", transport_factory,
                           "input_protocol_factory",   protocol_factory,
                           "output_protocol_factory",  protocol_factory,
                           NULL);

    /* Start the server */
    thrift_server_serve (server, &error);

    /* Make sure the server stopped only because it was interrupted (by the
       child process terminating) */
    g_assert(!error || g_error_matches(error,
                                       THRIFT_SERVER_SOCKET_ERROR,
                                       THRIFT_SERVER_SOCKET_ERROR_ACCEPT));

    /* Free our resources */
    g_object_unref (server);
    g_object_unref (transport_factory);
    g_object_unref (protocol_factory);
    g_object_unref (server_transport);

    g_object_unref (processor);
    g_object_unref (handler);

    /* Wait for the child process to complete and return its exit status */
    g_assert (wait (&status) == pid);
    if (WIFEXITED (status))
      exit_status = WEXITSTATUS (status);

    return exit_status;
  }
}