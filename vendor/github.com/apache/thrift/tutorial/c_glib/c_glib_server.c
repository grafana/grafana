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
#include <thrift/c_glib/protocol/thrift_protocol_factory.h>
#include <thrift/c_glib/server/thrift_server.h>
#include <thrift/c_glib/server/thrift_simple_server.h>
#include <thrift/c_glib/transport/thrift_buffered_transport_factory.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>

#include "gen-c_glib/calculator.h"

G_BEGIN_DECLS

/* In the C (GLib) implementation of Thrift, the actual work done by a
   server---that is, the code that runs when a client invokes a
   service method---is defined in a separate "handler" class that
   implements the service interface. Here we define the
   TutorialCalculatorHandler class, which implements the CalculatorIf
   interface and provides the behavior expected by tutorial clients.
   (Typically this code would be placed in its own module but for
   clarity this tutorial is presented entirely in a single file.)

   For each service the Thrift compiler generates an abstract base
   class from which handler implementations should inherit. In our
   case TutorialCalculatorHandler inherits from CalculatorHandler,
   defined in gen-c_glib/calculator.h.

   If you're new to GObject, try not to be intimidated by the quantity
   of code here---much of it is boilerplate and can mostly be
   copied-and-pasted from existing work. For more information refer to
   the GObject Reference Manual, available online at
   https://developer.gnome.org/gobject/. */

#define TYPE_TUTORIAL_CALCULATOR_HANDLER \
  (tutorial_calculator_handler_get_type ())

#define TUTORIAL_CALCULATOR_HANDLER(obj)                                \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj),                                   \
                               TYPE_TUTORIAL_CALCULATOR_HANDLER,        \
                               TutorialCalculatorHandler))
#define TUTORIAL_CALCULATOR_HANDLER_CLASS(c)                    \
  (G_TYPE_CHECK_CLASS_CAST ((c),                                \
                            TYPE_TUTORIAL_CALCULATOR_HANDLER,   \
                            TutorialCalculatorHandlerClass))
#define IS_TUTORIAL_CALCULATOR_HANDLER(obj)                             \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj),                                   \
                               TYPE_TUTORIAL_CALCULATOR_HANDLER))
#define IS_TUTORIAL_CALCULATOR_HANDLER_CLASS(c)                 \
  (G_TYPE_CHECK_CLASS_TYPE ((c),                                \
                            TYPE_TUTORIAL_CALCULATOR_HANDLER))
#define TUTORIAL_CALCULATOR_HANDLER_GET_CLASS(obj)              \
  (G_TYPE_INSTANCE_GET_CLASS ((obj),                            \
                              TYPE_TUTORIAL_CALCULATOR_HANDLER, \
                              TutorialCalculatorHandlerClass))

struct _TutorialCalculatorHandler {
  CalculatorHandler parent_instance;

  /* private */
  GHashTable *log;
};
typedef struct _TutorialCalculatorHandler TutorialCalculatorHandler;

struct _TutorialCalculatorHandlerClass {
  CalculatorHandlerClass parent_class;
};
typedef struct _TutorialCalculatorHandlerClass TutorialCalculatorHandlerClass;

GType tutorial_calculator_handler_get_type (void);

G_END_DECLS

/* ---------------------------------------------------------------- */

/* The implementation of TutorialCalculatorHandler follows. */

G_DEFINE_TYPE (TutorialCalculatorHandler,
               tutorial_calculator_handler,
               TYPE_CALCULATOR_HANDLER)

/* Each of a handler's methods accepts at least two parameters: A
   pointer to the service-interface implementation (the handler object
   itself) and a handle to a GError structure to receive information
   about any error that occurs.

   On success, a handler method returns TRUE. A return value of FALSE
   indicates an error occurred and the error parameter has been
   set. (Methods should not return FALSE without first setting the
   error parameter.) */
static gboolean
tutorial_calculator_handler_ping (CalculatorIf  *iface,
                                  GError       **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  puts ("ping()");

  return TRUE;
}

/* Service-method parameters are passed through as parameters to the
   handler method.

   If the service method returns a value an output parameter, _return,
   is additionally passed to the handler method. This parameter should
   be set appropriately before the method returns, whenever it
   succeeds.

   The return value from this method happens to be of a base type,
   i32, but note if a method returns a complex type such as a map or
   list *_return will point to a pre-allocated data structure that
   does not need to be re-allocated and should not be destroyed. */
static gboolean
tutorial_calculator_handler_add (CalculatorIf  *iface,
                                 gint32        *_return,
                                 const gint32   num1,
                                 const gint32   num2,
                                 GError       **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("add(%d,%d)\n", num1, num2);
  *_return = num1 + num2;

  return TRUE;
}

/* Any handler method can return a ThriftApplicationException to the
   client by setting its error parameter appropriately and returning
   FALSE. See the ThriftApplicationExceptionError enumeration defined
   in thrift_application_exception.h for a list of recognized
   exception types (GError codes).

   If a service method can also throw a custom exception (that is, one
   defined in the .thrift file) an additional output parameter will be
   provided (here, "ouch") to hold an instance of the exception, when
   necessary. Note there will be a separate parameter added for each
   type of exception the method can throw.

   Unlike return values, exception objects are never pre-created; this
   is always the responsibility of the handler method. */
static gboolean
tutorial_calculator_handler_calculate (CalculatorIf      *iface,
                                       gint32            *_return,
                                       const gint32       logid,
                                       const Work        *w,
                                       InvalidOperation **ouch,
                                       GError           **error)
{
  TutorialCalculatorHandler *self;

  gint *log_key;
  gchar log_value[12];
  SharedStruct *log_struct;

  gint num1;
  gint num2;
  Operation op;
  gboolean result = TRUE;

  THRIFT_UNUSED_VAR (error);

  g_return_val_if_fail (IS_TUTORIAL_CALCULATOR_HANDLER (iface),
                        FALSE);
  self = TUTORIAL_CALCULATOR_HANDLER (iface);

  /* Remember: Exception objects are never pre-created */
  g_assert (*ouch == NULL);

  /* Fetch the contents of our Work parameter.

     Note that integer properties of thirty-two bits or fewer in width
     are _always_ of type gint, regardless of the range of values they
     hold. A common error is trying to retrieve, say, a structure
     member defined in the .thrift file as type i16 into a variable of
     type gint16, which will clobber variables adjacent on the
     stack. Remember: If you're retrieving an integer property the
     receiving variable must be of either type gint or gint64, as
     appropriate. */
  g_object_get ((Work *)w,
                "num1", &num1,
                "num2", &num2,
                "op",   &op,
                NULL);

  printf ("calculate(%d,{%d,%d,%d})\n", logid, op, num1, num2);

  switch (op) {
  case OPERATION_ADD:
    *_return = num1 + num2;
    break;

  case OPERATION_SUBTRACT:
    *_return = num1 - num2;
    break;

  case OPERATION_MULTIPLY:
    *_return = num1 * num2;
    break;

  case OPERATION_DIVIDE:
    if (num2 == 0) {
      /* For each custom exception type a subclass of ThriftStruct is
         generated by the Thrift compiler. Throw an exception by
         setting the corresponding output parameter to a new instance
         of its type and returning FALSE. */
      *ouch = g_object_new (TYPE_INVALID_OPERATION,
                            "whatOp", op,
                            "why",  g_strdup ("Cannot divide by 0"),
                            NULL);
      result = FALSE;

      /* Note the call to g_strdup above: All the memory used by a
         ThriftStruct's properties belongs to the object itself and
         will be freed on destruction. Removing this call to g_strdup
         will lead to a segmentation fault as the object tries to
         release memory allocated statically to the program. */
    }
    else {
      *_return = num1 / num2;
    }
    break;

  default:
    *ouch = g_object_new (TYPE_INVALID_OPERATION,
                          "whatOp", op,
                          "why",  g_strdup ("Invalid Operation"),
                          NULL);
    result = FALSE;
  }

  /* On success, log a record of the result to our hash table */
  if (result) {
    log_key = g_malloc (sizeof *log_key);
    *log_key = logid;

    snprintf (log_value, sizeof log_value, "%d", *_return);

    log_struct = g_object_new (TYPE_SHARED_STRUCT,
                               "key",   *log_key,
                               "value",  g_strdup (log_value),
                               NULL);
    g_hash_table_replace (self->log, log_key, log_struct);
  }

  return result;
}

/* A one-way method has the same signature as an equivalent, regular
   method that returns no value. */
static gboolean
tutorial_calculator_handler_zip (CalculatorIf  *iface,
                                 GError       **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  puts ("zip()");

  return TRUE;
}

/* As specified in the .thrift file (tutorial.thrift), the Calculator
   service extends the SharedService service. Correspondingly, in the
   generated code the Calculator interface, CalculatorIf, extends the
   SharedService interface, SharedServiceIf, and subclasses of
   CalculatorHandler should implement its methods as well.

   Here we provide an implementation for the getStruct method from the
   parent service. */
static gboolean
tutorial_calculator_handler_get_struct (SharedServiceIf  *iface,
                                        SharedStruct    **_return,
                                        const gint32      key32,
                                        GError          **error)
{
  gint key = (gint)key32;
  TutorialCalculatorHandler *self;
  SharedStruct *log_struct;
  gint log_key;
  gchar *log_value;

  THRIFT_UNUSED_VAR (error);

  g_return_val_if_fail (IS_TUTORIAL_CALCULATOR_HANDLER (iface),
                        FALSE);
  self = TUTORIAL_CALCULATOR_HANDLER (iface);

  /* Remember: Complex return types are always pre-created and need
     only be populated */
  g_assert (*_return != NULL);

  printf ("getStruct(%d)\n", key);

  /* If the key exists in our log, return the corresponding logged
     data (or an empty SharedStruct structure if it does not).

     Incidentally, note we _must_ here copy the values from the hash
     table into the return structure. All memory used by the return
     structure belongs to the structure itself and will be freed once
     a response is sent to the client. If we merely freed *_return and
     set it to point to our hash-table entry, that would mean memory
     would be released (effectively, data erased) out of the hash
     table! */
  log_struct = g_hash_table_lookup (self->log, &key);
  if (log_struct != NULL) {
    g_object_get (log_struct,
                  "key",   &log_key,
                  "value", &log_value,
                  NULL);
    g_object_set (*_return,
                  "key",   log_key,
                  "value", g_strdup (log_value),
                  NULL);
  }

  return TRUE;
}

/* TutorialCalculatorHandler's instance finalizer (destructor) */
static void
tutorial_calculator_handler_finalize (GObject *object)
{
  TutorialCalculatorHandler *self =
    TUTORIAL_CALCULATOR_HANDLER (object);

  /* Free our calculation-log hash table */
  g_hash_table_unref (self->log);
  self->log = NULL;

  /* Chain up to the parent class */
  G_OBJECT_CLASS (tutorial_calculator_handler_parent_class)->
    finalize (object);
}

/* TutorialCalculatorHandler's instance initializer (constructor) */
static void
tutorial_calculator_handler_init (TutorialCalculatorHandler *self)
{
  /* Create our calculation-log hash table */
  self->log = g_hash_table_new_full (g_int_hash,
                                     g_int_equal,
                                     g_free,
                                     g_object_unref);
}

/* TutorialCalculatorHandler's class initializer */
static void
tutorial_calculator_handler_class_init (TutorialCalculatorHandlerClass *klass)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (klass);
  SharedServiceHandlerClass *shared_service_handler_class =
    SHARED_SERVICE_HANDLER_CLASS (klass);
  CalculatorHandlerClass *calculator_handler_class =
    CALCULATOR_HANDLER_CLASS (klass);

  /* Register our destructor */
  gobject_class->finalize = tutorial_calculator_handler_finalize;

  /* Register our implementations of CalculatorHandler's methods */
  calculator_handler_class->ping =
    tutorial_calculator_handler_ping;
  calculator_handler_class->add =
    tutorial_calculator_handler_add;
  calculator_handler_class->calculate =
    tutorial_calculator_handler_calculate;
  calculator_handler_class->zip =
    tutorial_calculator_handler_zip;

  /* Register our implementation of SharedServiceHandler's method */
  shared_service_handler_class->get_struct =
    tutorial_calculator_handler_get_struct;
}

/* ---------------------------------------------------------------- */

/* That ends the implementation of TutorialCalculatorHandler.
   Everything below is fairly generic code that sets up a minimal
   Thrift server for tutorial clients. */


/* Our server object, declared globally so it is accessible within the
   SIGINT signal handler */
ThriftServer *server = NULL;

/* A flag that indicates whether the server was interrupted with
   SIGINT (i.e. Ctrl-C) so we can tell whether its termination was
   abnormal */
gboolean sigint_received = FALSE;

/* Handle SIGINT ("Ctrl-C") signals by gracefully stopping the
   server */
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

int main (void)
{
  TutorialCalculatorHandler *handler;
  CalculatorProcessor *processor;

  ThriftServerTransport *server_transport;
  ThriftTransportFactory *transport_factory;
  ThriftProtocolFactory *protocol_factory;

  struct sigaction sigint_action;

  GError *error = NULL;
  int exit_status = 0;

#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  /* Create an instance of our handler, which provides the service's
     methods' implementation */
  handler =
    g_object_new (TYPE_TUTORIAL_CALCULATOR_HANDLER,
                  NULL);

  /* Create an instance of the service's processor, automatically
     generated by the Thrift compiler, which parses incoming messages
     and dispatches them to the appropriate method in the handler */
  processor =
    g_object_new (TYPE_CALCULATOR_PROCESSOR,
                  "handler", handler,
                  NULL);

  /* Create our server socket, which binds to the specified port and
     listens for client connections */
  server_transport =
    g_object_new (THRIFT_TYPE_SERVER_SOCKET,
                  "port", 9090,
                  NULL);

  /* Create our transport factory, used by the server to wrap "raw"
     incoming connections from the client (in this case with a
     ThriftBufferedTransport to improve performance) */
  transport_factory =
    g_object_new (THRIFT_TYPE_BUFFERED_TRANSPORT_FACTORY,
                  NULL);

  /* Create our protocol factory, which determines which wire protocol
     the server will use (in this case, Thrift's binary protocol) */
  protocol_factory =
    g_object_new (THRIFT_TYPE_BINARY_PROTOCOL_FACTORY,
                  NULL);

  /* Create the server itself */
  server =
    g_object_new (THRIFT_TYPE_SIMPLE_SERVER,
                  "processor",                processor,
                  "server_transport",         server_transport,
                  "input_transport_factory",  transport_factory,
                  "output_transport_factory", transport_factory,
                  "input_protocol_factory",   protocol_factory,
                  "output_protocol_factory",  protocol_factory,
                  NULL);

  /* Install our SIGINT handler, which handles Ctrl-C being pressed by
     stopping the server gracefully (not strictly necessary, but a
     nice touch) */
  memset (&sigint_action, 0, sizeof (sigint_action));
  sigint_action.sa_handler = sigint_handler;
  sigint_action.sa_flags = SA_RESETHAND;
  sigaction (SIGINT, &sigint_action, NULL);

  /* Start the server, which will run until its stop method is invoked
     (from within the SIGINT handler, in this case) */
  puts ("Starting the server...");
  thrift_server_serve (server, &error);

  /* If the server stopped for any reason other than having been
     interrupted by the user, report the error */
  if (!sigint_received) {
    g_message ("thrift_server_serve: %s",
               error != NULL ? error->message : "(null)");
    g_clear_error (&error);
  }

  puts ("done.");

  g_object_unref (server);
  g_object_unref (transport_factory);
  g_object_unref (protocol_factory);
  g_object_unref (server_transport);

  g_object_unref (processor);
  g_object_unref (handler);

  return exit_status;
}
