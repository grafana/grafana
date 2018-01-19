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

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_buffered_transport.h>

/* object properties */
enum _ThriftBufferedTransportProperties
{
  PROP_0,
  PROP_THRIFT_BUFFERED_TRANSPORT_TRANSPORT,
  PROP_THRIFT_BUFFERED_TRANSPORT_READ_BUFFER_SIZE,
  PROP_THRIFT_BUFFERED_TRANSPORT_WRITE_BUFFER_SIZE
};

G_DEFINE_TYPE(ThriftBufferedTransport, thrift_buffered_transport, THRIFT_TYPE_TRANSPORT)

/* implements thrift_transport_is_open */
gboolean
thrift_buffered_transport_is_open (ThriftTransport *transport)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);
  return THRIFT_TRANSPORT_GET_CLASS (t->transport)->is_open (t->transport);
}

/* overrides thrift_transport_peek */
gboolean
thrift_buffered_transport_peek (ThriftTransport *transport, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);
  return (t->r_buf->len > 0) || thrift_transport_peek (t->transport, error);
}

/* implements thrift_transport_open */
gboolean
thrift_buffered_transport_open (ThriftTransport *transport, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);
  return THRIFT_TRANSPORT_GET_CLASS (t->transport)->open (t->transport, error);
}

/* implements thrift_transport_close */
gboolean
thrift_buffered_transport_close (ThriftTransport *transport, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);
  return THRIFT_TRANSPORT_GET_CLASS (t->transport)->close (t->transport, error);
}

/* the actual read is "slow" because it calls the underlying transport */
gint32
thrift_buffered_transport_read_slow (ThriftTransport *transport, gpointer buf,
                                     guint32 len, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);
  gint ret = 0;
  guint32 want = len;
  guint32 got = 0;
  guchar *tmpdata = g_alloca (len);
  guint32 have = t->r_buf->len;

  /* we shouldn't hit this unless the buffer doesn't have enough to read */
  assert (t->r_buf->len < want);

  /* first copy what we have in our buffer. */
  if (have > 0)
  {
    memcpy (buf, t->r_buf, t->r_buf->len);
    want -= t->r_buf->len;
    t->r_buf = g_byte_array_remove_range (t->r_buf, 0, t->r_buf->len);
  }

  /* if the buffer is still smaller than what we want to read, then just
   * read it directly.  otherwise, fill the buffer and then give out
   * enough to satisfy the read. */
  if (t->r_buf_size < want)
  {
    if ((ret = THRIFT_TRANSPORT_GET_CLASS (t->transport)->read (t->transport,
                                                                tmpdata,
                                                                want,
                                                                error)) < 0) {
      return ret;
    }
    got += ret;

    /* copy the data starting from where we left off */
    memcpy ((guint8 *)buf + have, tmpdata, got);
    return got + have; 
  } else {
    guint32 give;

    if ((ret = THRIFT_TRANSPORT_GET_CLASS (t->transport)->read (t->transport,
                                                                tmpdata,
                                                                want,
                                                                error)) < 0) {
      return ret;
    }
    got += ret;
    t->r_buf = g_byte_array_append (t->r_buf, tmpdata, got);
    
    /* hand over what we have up to what the caller wants */
    give = want < t->r_buf->len ? want : t->r_buf->len;


    memcpy ((guint8 *)buf + len - want, t->r_buf->data, give);
    t->r_buf = g_byte_array_remove_range (t->r_buf, 0, give);
    want -= give;

    return (len - want);
  }
}

/* implements thrift_transport_read */
gint32
thrift_buffered_transport_read (ThriftTransport *transport, gpointer buf,
                                guint32 len, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);

  /* if we have enough buffer data to fulfill the read, just use
   * a memcpy */
  if (len <= t->r_buf->len)
  {
    memcpy (buf, t->r_buf->data, len);
    g_byte_array_remove_range (t->r_buf, 0, len);
    return len;
  }

  return thrift_buffered_transport_read_slow (transport, buf, len, error);
}

/* implements thrift_transport_read_end
 * called when write is complete.  nothing to do on our end. */
gboolean
thrift_buffered_transport_read_end (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

gboolean
thrift_buffered_transport_write_slow (ThriftTransport *transport, gpointer buf,
                                      guint32 len, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);
  guint32 have_bytes = t->w_buf->len;
  guint32 space = t->w_buf_size - t->w_buf->len;

  /* we need two syscalls because the buffered data plus the buffer itself
   * is too big. */
  if ((have_bytes + len >= 2*t->w_buf_size) || (have_bytes == 0))
  {
    if (have_bytes > 0)
    {
      if (!THRIFT_TRANSPORT_GET_CLASS (t->transport)->write (t->transport,
                                                             t->w_buf->data,
                                                             have_bytes,
                                                             error)) {
        return FALSE;
      }
      t->w_buf = g_byte_array_remove_range (t->w_buf, 0, have_bytes);
    }
    if (!THRIFT_TRANSPORT_GET_CLASS (t->transport)->write (t->transport,
                                                           buf, len, error)) {
      return FALSE;
    }
    return TRUE;
  }

  t->w_buf = g_byte_array_append (t->w_buf, buf, space);
  if (!THRIFT_TRANSPORT_GET_CLASS (t->transport)->write (t->transport,
                                                         t->w_buf->data,
                                                         t->w_buf->len,
                                                         error)) {
    return FALSE;
  }

  t->w_buf = g_byte_array_remove_range (t->w_buf, 0, t->w_buf->len);
  t->w_buf = g_byte_array_append (t->w_buf, (guint8 *)buf + space, len-space);

  return TRUE;
}

/* implements thrift_transport_write */
gboolean
thrift_buffered_transport_write (ThriftTransport *transport,
                                 const gpointer buf,
                                 const guint32 len, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);

  /* the length of the current buffer plus the length of the data being read */
  if (t->w_buf->len + len <= t->w_buf_size)
  {
    t->w_buf = g_byte_array_append (t->w_buf, buf, len);
    return len;
  }

  return thrift_buffered_transport_write_slow (transport, buf, len, error);
}

/* implements thrift_transport_write_end
 * called when write is complete.  nothing to do on our end. */
gboolean
thrift_buffered_transport_write_end (ThriftTransport *transport, GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (transport);
  THRIFT_UNUSED_VAR (error);
  return TRUE;
}

/* implements thrift_transport_flush */
gboolean
thrift_buffered_transport_flush (ThriftTransport *transport, GError **error)
{
  ThriftBufferedTransport *t = THRIFT_BUFFERED_TRANSPORT (transport);

  if (t->w_buf != NULL && t->w_buf->len > 0)
  {
    /* write the buffer and then empty it */
    if (!THRIFT_TRANSPORT_GET_CLASS (t->transport)->write (t->transport,
                                                           t->w_buf->data,
                                                           t->w_buf->len,
                                                           error)) {
      return FALSE;
    }
    t->w_buf = g_byte_array_remove_range (t->w_buf, 0, t->w_buf->len);
  }
  THRIFT_TRANSPORT_GET_CLASS (t->transport)->flush (t->transport,
                                                    error);

  return TRUE;
}

/* initializes the instance */
static void
thrift_buffered_transport_init (ThriftBufferedTransport *transport)
{
  transport->transport = NULL;
  transport->r_buf = g_byte_array_new ();
  transport->w_buf = g_byte_array_new ();
}

/* destructor */
static void
thrift_buffered_transport_finalize (GObject *object)
{
  ThriftBufferedTransport *transport = THRIFT_BUFFERED_TRANSPORT (object);

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
thrift_buffered_transport_get_property (GObject *object, guint property_id,
                                        GValue *value, GParamSpec *pspec)
{
  ThriftBufferedTransport *transport = THRIFT_BUFFERED_TRANSPORT (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_BUFFERED_TRANSPORT_TRANSPORT:
      g_value_set_object (value, transport->transport);
      break;
    case PROP_THRIFT_BUFFERED_TRANSPORT_READ_BUFFER_SIZE:
      g_value_set_uint (value, transport->r_buf_size);
      break;
    case PROP_THRIFT_BUFFERED_TRANSPORT_WRITE_BUFFER_SIZE:
      g_value_set_uint (value, transport->w_buf_size);
      break;
  }
}

/* property mutator */
void
thrift_buffered_transport_set_property (GObject *object, guint property_id,
                                        const GValue *value, GParamSpec *pspec)
{
  ThriftBufferedTransport *transport = THRIFT_BUFFERED_TRANSPORT (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_BUFFERED_TRANSPORT_TRANSPORT:
      transport->transport = g_value_get_object (value);
      break;
    case PROP_THRIFT_BUFFERED_TRANSPORT_READ_BUFFER_SIZE:
      transport->r_buf_size = g_value_get_uint (value);
      break;
    case PROP_THRIFT_BUFFERED_TRANSPORT_WRITE_BUFFER_SIZE:
      transport->w_buf_size = g_value_get_uint (value);
      break;
  }
}

/* initializes the class */
static void
thrift_buffered_transport_class_init (ThriftBufferedTransportClass *cls)
{
  ThriftTransportClass *ttc = THRIFT_TRANSPORT_CLASS (cls);
  GObjectClass *gobject_class = G_OBJECT_CLASS (cls);
  GParamSpec *param_spec = NULL;

  /* setup accessors and mutators */
  gobject_class->get_property = thrift_buffered_transport_get_property;
  gobject_class->set_property = thrift_buffered_transport_set_property;

  param_spec = g_param_spec_object ("transport", "transport (construct)",
                                    "Thrift transport",
                                    THRIFT_TYPE_TRANSPORT,
                                    G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_BUFFERED_TRANSPORT_TRANSPORT,
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
                                   PROP_THRIFT_BUFFERED_TRANSPORT_READ_BUFFER_SIZE,
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
                                   PROP_THRIFT_BUFFERED_TRANSPORT_WRITE_BUFFER_SIZE,
                                   param_spec);


  gobject_class->finalize = thrift_buffered_transport_finalize;
  ttc->is_open = thrift_buffered_transport_is_open;
  ttc->peek = thrift_buffered_transport_peek;
  ttc->open = thrift_buffered_transport_open;
  ttc->close = thrift_buffered_transport_close;
  ttc->read = thrift_buffered_transport_read;
  ttc->read_end = thrift_buffered_transport_read_end;
  ttc->write = thrift_buffered_transport_write;
  ttc->write_end = thrift_buffered_transport_write_end;
  ttc->flush = thrift_buffered_transport_flush;
}
