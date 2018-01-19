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

package org.apache.thrift;

import java.io.UnsupportedEncodingException;
import java.nio.ByteBuffer;

import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TField;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.protocol.TProtocolUtil;
import org.apache.thrift.protocol.TType;
import org.apache.thrift.transport.TMemoryInputTransport;

/**
 * Generic utility for easily deserializing objects from a byte array or Java
 * String.
 *
 */
public class TDeserializer {
  private final TProtocol protocol_;
  private final TMemoryInputTransport trans_;

  /**
   * Create a new TDeserializer that uses the TBinaryProtocol by default.
   */
  public TDeserializer() {
    this(new TBinaryProtocol.Factory());
  }

  /**
   * Create a new TDeserializer. It will use the TProtocol specified by the
   * factory that is passed in.
   *
   * @param protocolFactory Factory to create a protocol
   */
  public TDeserializer(TProtocolFactory protocolFactory) {
    trans_ = new TMemoryInputTransport();
    protocol_ = protocolFactory.getProtocol(trans_);
  }

  /**
   * Deserialize the Thrift object from a byte array.
   *
   * @param base The object to read into
   * @param bytes The array to read from
   */
  public void deserialize(TBase base, byte[] bytes) throws TException {
      deserialize(base, bytes, 0, bytes.length);
  }

  /**
   * Deserialize the Thrift object from a byte array.
   *
   * @param base The object to read into
   * @param bytes The array to read from
   * @param offset The offset into {@code bytes}
   * @param length The length to read from {@code bytes}
   */
  public void deserialize(TBase base, byte[] bytes, int offset, int length) throws TException {
    try {
      trans_.reset(bytes, offset, length);
      base.read(protocol_);
    } finally {
      trans_.clear();
      protocol_.reset();
    }
  }

  /**
   * Deserialize the Thrift object from a Java string, using a specified
   * character set for decoding.
   *
   * @param base The object to read into
   * @param data The string to read from
   * @param charset Valid JVM charset
   */
  public void deserialize(TBase base, String data, String charset) throws TException {
    try {
      deserialize(base, data.getBytes(charset));
    } catch (UnsupportedEncodingException uex) {
      throw new TException("JVM DOES NOT SUPPORT ENCODING: " + charset);
    } finally {
      protocol_.reset();
    }
  }

  /**
   * Deserialize only a single Thrift object (addressed by recursively using field id)
   * from a byte record.   
   * @param tb The object to read into
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path tb
   * @param fieldIdPathRest The rest FieldId's that define a path tb
   * @throws TException 
   */
  public void partialDeserialize(TBase tb, byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    try {
      if (locateField(bytes, fieldIdPathFirst, fieldIdPathRest) != null) {
        // if this line is reached, iprot will be positioned at the start of tb.
        tb.read(protocol_);
      }      
    } catch (Exception e) {
      throw new TException(e);
    } finally {
      trans_.clear();
      protocol_.reset();
    }
  }

  /**
   * Deserialize only a boolean field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to a boolean field
   * @param fieldIdPathRest The rest FieldId's that define a path to a boolean field
   * @throws TException
   */
  public Boolean partialDeserializeBool(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (Boolean) partialDeserializeField(TType.BOOL, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only a byte field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to a byte field
   * @param fieldIdPathRest The rest FieldId's that define a path to a byte field
   * @throws TException
   */
  public Byte partialDeserializeByte(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (Byte) partialDeserializeField(TType.BYTE, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only a double field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to a double field
   * @param fieldIdPathRest The rest FieldId's that define a path to a double field
   * @throws TException
   */
  public Double partialDeserializeDouble(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (Double) partialDeserializeField(TType.DOUBLE, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only an i16 field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to an i16 field
   * @param fieldIdPathRest The rest FieldId's that define a path to an i16 field
   * @throws TException
   */
  public Short partialDeserializeI16(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (Short) partialDeserializeField(TType.I16, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only an i32 field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to an i32 field
   * @param fieldIdPathRest The rest FieldId's that define a path to an i32 field
   * @throws TException
   */
  public Integer partialDeserializeI32(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (Integer) partialDeserializeField(TType.I32, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only an i64 field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to an i64 field
   * @param fieldIdPathRest The rest FieldId's that define a path to an i64 field
   * @throws TException
   */
  public Long partialDeserializeI64(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (Long) partialDeserializeField(TType.I64, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only a string field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to a string field
   * @param fieldIdPathRest The rest FieldId's that define a path to a string field
   * @throws TException
   */
  public String partialDeserializeString(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    return (String) partialDeserializeField(TType.STRING, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only a binary field (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to a binary field
   * @param fieldIdPathRest The rest FieldId's that define a path to a binary field
   * @throws TException
   */
  public ByteBuffer partialDeserializeByteArray(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    // TType does not have binary, so we use the arbitrary num 100
    return (ByteBuffer) partialDeserializeField((byte)100, bytes, fieldIdPathFirst, fieldIdPathRest);
  }

  /**
   * Deserialize only the id of the field set in a TUnion (addressed by recursively using field id)
   * from a byte record.
   * @param bytes The serialized object to read from
   * @param fieldIdPathFirst First of the FieldId's that define a path to a TUnion
   * @param fieldIdPathRest The rest FieldId's that define a path to a TUnion
   * @throws TException
   */
  public Short partialDeserializeSetFieldIdInUnion(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest)  throws TException {
    try {
      TField field = locateField(bytes, fieldIdPathFirst, fieldIdPathRest);
      if (field != null){
        protocol_.readStructBegin(); // The Union
        return protocol_.readFieldBegin().id; // The field set in the union
      }
      return null;
    } catch (Exception e) {
      throw new TException(e);
    } finally {
      trans_.clear();
      protocol_.reset();
    }
  }

  private Object partialDeserializeField(byte ttype, byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    try {
      TField field = locateField(bytes, fieldIdPathFirst, fieldIdPathRest);
      if (field != null) {
        // if this point is reached, iprot will be positioned at the start of the field.
        switch(ttype){
          case TType.BOOL:
            if (field.type == TType.BOOL){
              return protocol_.readBool();
            }
            break;
          case TType.BYTE:
            if (field.type == TType.BYTE) {
              return protocol_.readByte();
            }
            break;
          case TType.DOUBLE:
            if (field.type == TType.DOUBLE) {
              return protocol_.readDouble();
            }
            break;
          case TType.I16:
            if (field.type == TType.I16) {
              return protocol_.readI16();
            }
            break;
          case TType.I32:
            if (field.type == TType.I32) {
              return protocol_.readI32();
            }
            break;
          case TType.I64:
            if (field.type == TType.I64) {
              return protocol_.readI64();
            }
            break;
          case TType.STRING:
            if (field.type == TType.STRING) {
              return protocol_.readString();
            }
            break;
          case 100: // hack to differentiate between string and binary
            if (field.type == TType.STRING) {
              return protocol_.readBinary();
            }
            break;
        }
      }
      return null;
    } catch (Exception e) {
      throw new TException(e);
    } finally {
      trans_.clear();
      protocol_.reset();
    }
  }

  private TField locateField(byte[] bytes, TFieldIdEnum fieldIdPathFirst, TFieldIdEnum ... fieldIdPathRest) throws TException {
    trans_.reset(bytes);

    TFieldIdEnum[] fieldIdPath= new TFieldIdEnum[fieldIdPathRest.length + 1];
    fieldIdPath[0] = fieldIdPathFirst;
    for (int i = 0; i < fieldIdPathRest.length; i++){
      fieldIdPath[i + 1] = fieldIdPathRest[i];
    }

    // index into field ID path being currently searched for
    int curPathIndex = 0;

    // this will be the located field, or null if it is not located
    TField field = null;

    protocol_.readStructBegin();

    while (curPathIndex < fieldIdPath.length) {
      field = protocol_.readFieldBegin();
      // we can stop searching if we either see a stop or we go past the field
      // id we're looking for (since fields should now be serialized in asc
      // order).
      if (field.type == TType.STOP || field.id > fieldIdPath[curPathIndex].getThriftFieldId()) {
        return null;
      }

      if (field.id != fieldIdPath[curPathIndex].getThriftFieldId()) {
        // Not the field we're looking for. Skip field.
        TProtocolUtil.skip(protocol_, field.type);
        protocol_.readFieldEnd();
      } else {
        // This field is the next step in the path. Step into field.
        curPathIndex++;
        if (curPathIndex < fieldIdPath.length) {
          protocol_.readStructBegin();
        }
      }
    }
    return field;
  }

  /**
   * Deserialize the Thrift object from a Java string, using the default JVM
   * charset encoding.
   *
   * @param base The object to read into
   * @param data The string to read from
   */
  public void fromString(TBase base, String data) throws TException {
    deserialize(base, data.getBytes());
  }
}
