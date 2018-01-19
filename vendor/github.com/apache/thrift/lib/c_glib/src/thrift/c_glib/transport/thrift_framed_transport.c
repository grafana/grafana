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

#include <assert.h>
#include <netdb.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_framed_transport.h>

/* object properties */
enum _ThriftFramedTransportProperties
{
  PROP_0,
  PROP_THRIFT_FRAMED_TRANSPORT_TRANSPORT,
  PROP_THRIFT_FRAMED_TRANSPORT_READ_BUFFER_SIZE,
  PROP_THRIFT_FRAMED_TRANSPORT_WRITE_BUFFER_SIZE
};

G_DEFINE_TYPE(ThriftFramedTransport, thrift_framed_transport, THRIFT_TYPE_TRANSPORT)

/* implements thrift_transport_is_open */
gboolean
thrift_framed_transport_is_open (ThriftTransport *transport)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  return THRIFT_TRANSPORT_GET_CLASS (t->transport)->is_open (t->transport);
}

/* overrides thrift_transport_peek */
gboolean
thrift_framed_transport_peek (ThriftTransport *transport, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  return (t->r_buf->len > 0) || thrift_transport_peek (t->transport, error);
}

/* implements thrift_transport_open */
gboolean
thrift_framed_transport_open (ThriftTransport *transport, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  return THRIFT_TRANSPORT_GET_CLASS (t->transport)->open (t->transport, error);
}

/* implements thrift_transport_close */
gboolean
thrift_framed_transport_close (ThriftTransport *transport, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  return THRIFT_TRANSPORT_GET_CLASS (t->transport)->close (t->transport, error);
}

/* reads a frame and puts it into the buffer */
gboolean
thrift_framed_transport_read_frame (ThriftTransport *transport,
                                    GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  guint32 sz;
  gint32 bytes;
  gboolean result = FALSE;

  /* read the size */
  if (thrift_transport_read (t->transport,
                             &sz,
                             sizeof (sz),
                             error) == sizeof (sz))
  {
    guchar *tmpdata;

    sz = ntohl (sz);

    /* create a buffer to hold the data and read that much data */
    tmpdata = g_alloca (sz);
    bytes = thrift_transport_read (t->transport, tmpdata, sz, error);

    if (bytes > 0 && (error == NULL || *error == NULL))
    {
      /* add the data to the buffer */
      g_byte_array_append (t->r_buf, tmpdata, bytes);

      result = TRUE;
    }
  }

  return result;
}

/* the actual read is "slow" because it calls the underlying transport */
gint32
thrift_framed_transport_read_slow (ThriftTransport *transport, gpointer buf,
                                   guint32 len, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  guint32 want = len;
  guint32 have = t->r_buf->len;
  gint32 result = -1;

  /* we shouldn't hit this unless the buffer doesn't have enough to read */
  assert (t->r_buf->len < want);

  /* first copy what we have in our buffer, if there is anything left */
  if (have > 0)
  {
    memcpy (buf, t->r_buf, t->r_buf->len);
    want -= t->r_buf->len;
    t->r_buf = g_byte_array_remove_range (t->r_buf, 0, t->r_buf->len);
  }

  /* read a frame of input and buffer it */
  if (thrift_framed_transport_read_frame (transport, error) == TRUE)
  {
    /* hand over what we have up to what the caller wants */
    guint32 give = want < t->r_buf->len ? want : t->r_buf->len;

    /* copy the data into the buffer */
    memcpy ((guint8 *)buf + len - want, t->r_buf->data, give);
    t->r_buf = g_byte_array_remove_range (t->r_buf, 0, give);
    want -= give;

    result = len - want;
  }

  return result;
}

/* implements thrift_transport_read */
gint32
thrift_framed_transport_read (ThriftTransport *transport, gpointer buf,
                              guint32 len, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);

  /* if we have enough buffer data to fulfill the read, just use
   * a memcpy from the buffer */
  if (len <= t->r_buf->len)
  {
    memcpy (buf, t->r_buf->data, len);
    g_byte_array_remove_range (t->r_buf, 0, len);
    return len;
  }

  return thrift_framed_transport_read_slow (transport, buf, len, error);
}

/* implements thrift_transport_read_end
 * called when read is complete.  nothing to do on our end. */
gboolean
thrift_framed_transport_read_end (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

gboolean
thrift_framed_transport_write_slow (ThriftTransport *transport, gpointer buf,
                                    guint32 len, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);

  THRIFT_UNUSED_VAR (error);

  /* append the data to the buffer and we're done */
  g_byte_array_append (t->w_buf, buf, len);

  return TRUE;
}

/* implements thrift_transport_write */
gboolean
thrift_framed_transport_write (ThriftTransport *transport,
                               const gpointer buf,     
                               const guint32 len, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);

  /* the length of the current buffer plus the length of the data being read */
  if (t->w_buf->len + len <= t->w_buf_size)
  {
    t->w_buf = g_byte_array_append (t->w_buf, buf, len);
    return TRUE;
  }

  return thrift_framed_transport_write_slow (transport, buf, len, error);
}

/* implements thrift_transport_write_end
 * called when write is complete.  nothing to do on our end. */
gboolean
thrift_framed_transport_write_end (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

/* implements thrift_transport_flush */
gboolean
thrift_framed_transport_flush (ThriftTransport *transport, GError **error)
{
  ThriftFramedTransport *t = THRIFT_FRAMED_TRANSPORT (transport);
  gint32 sz_hbo, sz_nbo;
  guchar *tmpdata;

  /* get the size of the frame in host and network byte order */
  sz_hbo = t->w_buf->len + sizeof(sz_nbo);
  sz_nbo = (gint32) htonl ((guint32) t->w_buf->len);

  /* copy the size of the frame and then the frame itself */
  tmpdata = g_alloca (sz_hbo);
  memcpy (tmpdata, (guint8 *) &sz_nbo, sizeof (sz_nbo));

  if (t->w_buf->len > 0)
  {
    memcpy (tmpdata + sizeof (sz_nbo), t->w_buf->data, t->w_buf->len);
    t->w_buf = g_byte_array_remove_range (t->w_buf, 0, t->w_buf->len);
  }
    
  /* write the buffer and then empty it */
  THRIFT_TRANSPORT_GET_CLASS (t->transport)->write (t->transport,
                                                    tmpdata, sz_hbo,
                                                    error);

  THRIFT_TRANSPORT_GET_CLASS (t->transport)->flush (t->transport,
                                                    error);

  return TRUE;
}

/* initializes the instance */
static void
thrift_framed_transport_init (ThriftFramedTransport *transport)
{
  transport->transport = NULL;
  transport->r_buf = g_byte_array_new ();
  transport->w_buf = g_byte_array_new ();
}

/* destructor */
static void
thrift_framed_transport_finalize (GObject *object)
{
  ThriftFramedTransport *transport = THRIFT_FRAMED_TRANSPORT (object);

  if (transport->r_buf != NULL)
  {
    g_byte_array_free (transport->r_buf, TRUE);
  }
  transport->r_buf = NULL;

  if (transport->w_buf != NULL)
  {
    g_byte_array_free (transport->w_buf, TRUE);
  }
  transport->w_buf = NULL;
}

/* property accessor */
void
thrift_framed_transport_get_property (GObject *object, guint property_id,
                                      GValue *value, GParamSpec *pspec)
{
  ThriftFramedTransport *transport = THRIFT_FRAMED_TRANSPORT (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_FRAMED_TRANSPORT_TRANSPORT:
      g_value_set_object (value, transport->transport);
      break;
    case PROP_THRIFT_FRAMED_TRANSPORT_READ_BUFFER_SIZE:
      g_value_set_uint (value, transport->r_buf_size);
      break;
    case PROP_THRIFT_FRAMED_TRANSPORT_WRITE_BUFFER_SIZE:
      g_value_set_uint (value, transport->w_buf_size);
      break;
  }
}

/* property mutator */
void
thrift_framed_transport_set_property (GObject *object, guint property_id,
                                      const GValue *value, GParamSpec *pspec)
{
  ThriftFramedTransport *transport = THRIFT_FRAMED_TRANSPORT (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_FRAMED_TRANSPORT_TRANSPORT:
      transport->transport = g_value_get_object (value);
      break;
    case PROP_THRIFT_FRAMED_TRANSPORT_READ_BUFFER_SIZE:
      transport->r_buf_size = g_value_get_uint (value);
      break;
    case PROP_THRIFT_FRAMED_TRANSPORT_WRITE_BUFFER_SIZE:
      transport->w_buf_size = g_value_get_uint (value);
      break;
  }
}

/* initializes the class */
static void
thrift_framed_transport_class_init (ThriftFramedTransportClass *cls)
{
  ThriftTransportClass *ttc = THRIFT_TRANSPORT_CLASS (cls);
  GObjectClass *gobject_class = G_OBJECT_CLASS (cls);
  GParamSpec *param_spec = NULL;

  /* setup accessors and mutators */
  gobject_class->get_property = thrift_framed_transport_get_property;
  gobject_class->set_property = thrift_framed_transport_set_property;

  param_spec = g_param_spec_object ("transport", "transport (construct)",
                                    "Thrift transport",
                                    THRIFT_TYPE_TRANSPORT,
                                    G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_FRAMED_TRANSPORT_TRANSPORT,
                                   param_spec);

  param_spec = g_param_spec_uint ("r_buf_size",
                                  "read buffer size (construct)",
                                  "Set the read buffer size",
                                  0, /* min */
                                  1048576, /* max, 1024*1024 */
                                  512, /* default value */
                                  G_PARAM_CONSTRUCT_ONLY |
                                  G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_FRAMED_TRANSPORT_READ_BUFFER_SIZE,
                                   param_spec);

  param_spec = g_param_spec_uint ("w_buf_size",
                                  "write buffer size (construct)",
                                  "Set the write buffer size",
                                  0, /* min */
                                  1048576, /* max, 1024*1024 */
                                  512, /* default value */
                                  G_PARAM_CONSTRUCT_ONLY |
                                  G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_FRAMED_TRANSPORT_WRITE_BUFFER_SIZE,
                                   param_spec);

  gobject_class->finalize = thrift_framed_transport_finalize;
  ttc->is_open = thrift_framed_transport_is_open;
  ttc->peek = thrift_framed_transport_peek;
  ttc->open = thrift_framed_transport_open;
  ttc->close = thrift_framed_transport_close;
  ttc->read = thrift_framed_transport_read;
  ttc->read_end = thrift_framed_transport_read_end;
  ttc->write = thrift_framed_transport_write;
  ttc->write_end = thrift_framed_transport_write_end;
  ttc->flush = thrift_framed_transport_flush;
}
