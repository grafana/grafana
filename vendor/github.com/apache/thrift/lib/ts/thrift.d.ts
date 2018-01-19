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

declare namespace Thrift {
  /**
   * Thrift JavaScript library version.
   */
  var Version: string;

  /**
   * Thrift IDL type string to Id mapping.
   * @property {number}  STOP   - End of a set of fields.
   * @property {number}  VOID   - No value (only legal for return types).
   * @property {number}  BOOL   - True/False integer.
   * @property {number}  BYTE   - Signed 8 bit integer.
   * @property {number}  I08    - Signed 8 bit integer.
   * @property {number}  DOUBLE - 64 bit IEEE 854 floating point.
   * @property {number}  I16    - Signed 16 bit integer.
   * @property {number}  I32    - Signed 32 bit integer.
   * @property {number}  I64    - Signed 64 bit integer.
   * @property {number}  STRING - Array of bytes representing a string of characters.
   * @property {number}  UTF7   - Array of bytes representing a string of UTF7 encoded characters.
   * @property {number}  STRUCT - A multifield type.
   * @property {number}  MAP    - A collection type (map/associative-array/dictionary).
   * @property {number}  SET    - A collection type (unordered and without repeated values).
   * @property {number}  LIST   - A collection type (unordered).
   * @property {number}  UTF8   - Array of bytes representing a string of UTF8 encoded characters.
   * @property {number}  UTF16  - Array of bytes representing a string of UTF16 encoded characters.
   */
  interface Type {
    STOP: number;
    VOID: number;
    BOOL: number;
    BYTE: number;
    I08: number;
    DOUBLE: number;
    I16: number;
    I32: number;
    I64: number;
    STRING: number;
    UTF7: number;
    STRUCT: number;
    MAP: number;
    SET: number;
    LIST: number;
    UTF8: number;
    UTF16: number;
  }
  var Type: Type;

  /**
   * Thrift RPC message type string to Id mapping.
   * @property {number}  CALL      - RPC call sent from client to server.
   * @property {number}  REPLY     - RPC call normal response from server to client.
   * @property {number}  EXCEPTION - RPC call exception response from server to client.
   * @property {number}  ONEWAY    - Oneway RPC call from client to server with no response.
   */
  interface MessageType {
    CALL: number;
    REPLY: number;
    EXCEPTION: number;
    ONEWAY: number;
  }
  var MessageType: MessageType;

  /**
   * Utility function returning the count of an object's own properties.
   * @param {object} obj - Object to test.
   * @returns {number} number of object's own properties
   */
  function objectLength(obj: Object): number;

  /**
   * Utility function to establish prototype inheritance.
   * @param {function} constructor - Contstructor function to set as derived.
   * @param {function} superConstructor - Contstructor function to set as base.
   * @param {string} [name] - Type name to set as name property in derived prototype.
   */
  function inherits(constructor: Function, superConstructor: Function, name?: string): void;

  /**
   * TException is the base class for all Thrift exceptions types.
   */
  class TException implements Error {
    name: string;
    message: string;

    /**
     * Initializes a Thrift TException instance.
     * @param {string} message - The TException message (distinct from the Error message).
     */
    constructor(message: string);

    /**
     * Returns the message set on the exception.
     * @returns {string} exception message
     */
    getMessage(): string;
  }

  /**
   * Thrift Application Exception type string to Id mapping.
   * @property {number}  UNKNOWN                 - Unknown/undefined.
   * @property {number}  UNKNOWN_METHOD          - Client attempted to call a method unknown to the server.
   * @property {number}  INVALID_MESSAGE_TYPE    - Client passed an unknown/unsupported MessageType.
   * @property {number}  WRONG_METHOD_NAME       - Unused.
   * @property {number}  BAD_SEQUENCE_ID         - Unused in Thrift RPC, used to flag proprietary sequence number errors.
   * @property {number}  MISSING_RESULT          - Raised by a server processor if a handler fails to supply the required return result.
   * @property {number}  INTERNAL_ERROR          - Something bad happened.
   * @property {number}  PROTOCOL_ERROR          - The protocol layer failed to serialize or deserialize data.
   * @property {number}  INVALID_TRANSFORM       - Unused.
   * @property {number}  INVALID_PROTOCOL        - The protocol (or version) is not supported.
   * @property {number}  UNSUPPORTED_CLIENT_TYPE - Unused.
   */
  interface TApplicationExceptionType {
    UNKNOWN: number;
    UNKNOWN_METHOD: number;
    INVALID_MESSAGE_TYPE: number;
    WRONG_METHOD_NAME: number;
    BAD_SEQUENCE_ID: number;
    MISSING_RESULT: number;
    INTERNAL_ERROR: number;
    PROTOCOL_ERROR: number;
    INVALID_TRANSFORM: number;
    INVALID_PROTOCOL: number;
    UNSUPPORTED_CLIENT_TYPE: number;
  }
  var TApplicationExceptionType: TApplicationExceptionType;

  /**
   * TApplicationException is the exception class used to propagate exceptions from an RPC server back to a calling client.
   */
  class TApplicationException extends TException {
    message: string;
    code: number;

    /**
     * Initializes a Thrift TApplicationException instance.
     * @param {string} message - The TApplicationException message (distinct from the Error message).
     * @param {Thrift.TApplicationExceptionType} [code] - The TApplicationExceptionType code.
     */
    constructor(message: string, code?: number);

    /**
     * Read a TApplicationException from the supplied protocol.
     * @param {object} input - The input protocol to read from.
     */
    read(input: Object): void;

    /**
     * Write a TApplicationException to the supplied protocol.
     * @param {object} output - The output protocol to write to.
     */
    write(output: Object): void;

    /**
     * Returns the application exception code set on the exception.
     * @returns {Thrift.TApplicationExceptionType} exception code
     */
    getCode(): number;
  }

  /**
   * The Apache Thrift Transport layer performs byte level I/O between RPC
   * clients and servers. The JavaScript Transport object type uses Http[s]/XHR and is
   * the sole browser based Thrift transport. Target servers must implement the http[s]
   * transport (see: node.js example server).
   */
  class TXHRTransport {
    url: string;
    wpos: number;
    rpos: number;
    useCORS: any;
    send_buf: string;
    recv_buf: string;

    /**
     * If you do not specify a url then you must handle XHR operations on
     * your own. This type can also be constructed using the Transport alias
     * for backward compatibility.
     * @param {string} [url] - The URL to connect to.
     * @param {object} [options] - Options.
     */
    constructor(url?: string, options?: Object);

    /**
     * Gets the browser specific XmlHttpRequest Object.
     * @returns {object} the browser XHR interface object
     */
    getXmlHttpRequestObject(): Object;

    /**
     * Sends the current XRH request if the transport was created with a URL and
     * the async parameter if false. If the transport was not created with a URL
     * or the async parameter is True or the URL is an empty string, the current
     * send buffer is returned.
     * @param {object} async - If true the current send buffer is returned.
     * @param {function} callback - Optional async completion callback.
     * @returns {undefined|string} Nothing or the current send buffer.
     */
    flush(async: any, callback?: Function): string;

    /**
     * Creates a jQuery XHR object to be used for a Thrift server call.
     * @param {object} client - The Thrift Service client object generated by the IDL compiler.
     * @param {object} postData - The message to send to the server.
     * @param {function} args - The function to call if the request succeeds.
     * @param {function} recv_method - The Thrift Service Client receive method for the call.
     * @returns {object} A new jQuery XHR object.
     */
    jqRequest(client: Object, postData: any, args: Function, recv_method: Function): Object;

    /**
     * Sets the buffer to use when receiving server responses.
     * @param {string} buf - The buffer to receive server responses.
     */
    setRecvBuffer(buf: string): void;

    /**
     * Returns true if the transport is open, in browser based JavaScript
     * this function always returns true.
     * @returns {boolean} Always True.
     */
    isOpen(): boolean;

    /**
     * Opens the transport connection, in browser based JavaScript
     * this function is a nop.
     */
    open(): void;

    /**
     * Closes the transport connection, in browser based JavaScript
     * this function is a nop.
     */
    close(): void;

    /**
     * Returns the specified number of characters from the response
     * buffer.
     * @param {number} len - The number of characters to return.
     * @returns {string} Characters sent by the server.
     */
    read(len: number): string;

    /**
     * Returns the entire response buffer.
     * @returns {string} Characters sent by the server.
     */
    readAll(): string;

    /**
     * Sets the send buffer to buf.
     * @param {string} buf - The buffer to send.
     */
    write(buf: string): void;

    /**
     * Returns the send buffer.
     * @returns {string} The send buffer.
     */
    getSendBuffer(): string;
  }

  /**
   * Old alias of the TXHRTransport for backwards compatibility.
   */
  class Transport extends TXHRTransport {}

  /**
   * The Apache Thrift Transport layer performs byte level I/O
   * between RPC clients and servers. The JavaScript TWebSocketTransport object
   * uses the WebSocket protocol. Target servers must implement WebSocket.
   */
  class TWebSocketTransport {
    url: string; //Where to connect
    socket: any; //The web socket
    callbacks: Function[]; //Pending callbacks
    send_pending: any[]; //Buffers/Callback pairs waiting to be sent
    send_buf: string; //Outbound data, immutable until sent
    recv_buf: string; //Inbound data
    rb_wpos: number; //Network write position in receive buffer
    rb_rpos: number; //Client read position in receive buffer

    /**
     * Constructor Function for the WebSocket transport.
     * @param {string } [url] - The URL to connect to.
     */
    constructor(url: string);

    __reset(url: string): void;

    /**
     * Sends the current WS request and registers callback. The async
     * parameter is ignored (WS flush is always async) and the callback
     * function parameter is required.
     * @param {object} async - Ignored.
     * @param {function} callback - The client completion callback.
     * @returns {undefined|string} Nothing (undefined)
     */
    flush(async: any, callback: Function): string;

    __onOpen(): void;

    __onClose(): void;

    __onMessage(): void;

    __onError(): void;

    /**
     * Sets the buffer to use when receiving server responses.
     * @param {string} buf - The buffer to receive server responses.
     */
    setRecvBuffer(buf: string): void;

    /**
     * Returns true if the transport is open
     * @returns {boolean}
     */
    isOpen(): boolean;

    /**
     * Opens the transport connection
     */
    open(): void;

    /**
     * Closes the transport connection
     */
    close(): void;

    /**
     * Returns the specified number of characters from the response
     * buffer.
     * @param {number} len - The number of characters to return.
     * @returns {string} Characters sent by the server.
     */
    read(len: number): string;

    /**
     * Returns the entire response buffer.
     * @returns {string} Characters sent by the server.
     */
    readAll(): string;

    /**
     * Sets the send buffer to buf.
     * @param {string} buf - The buffer to send.
     */
    write(buf: string): void;

    /**
     * Returns the send buffer.
     * @returns {string} The send buffer.
     */
    getSendBuffer(): string;
  }

  /**
   * Apache Thrift Protocols perform serialization which enables cross
   * language RPC. The Protocol type is the JavaScript browser implementation
   * of the Apache Thrift TJSONProtocol.
   */
  class TJSONProtocol {
    transport: Object;

    /**
     * Thrift IDL type Id to string mapping.
     * The mapping table looks as follows:
     * Thrift.Type.BOOL   -> "tf": True/False integer.
     * Thrift.Type.BYTE   -> "i8": Signed 8 bit integer.
     * Thrift.Type.I16    -> "i16": Signed 16 bit integer.
     * Thrift.Type.I32    -> "i32": Signed 32 bit integer.
     * Thrift.Type.I64    -> "i64": Signed 64 bit integer.
     * Thrift.Type.DOUBLE -> "dbl": 64 bit IEEE 854 floating point.
     * Thrift.Type.STRUCT -> "rec": A multifield type.
     * Thrift.Type.STRING -> "str": Array of bytes representing a string of characters.
     * Thrift.Type.MAP    -> "map": A collection type (map/associative-array/dictionary).
     * Thrift.Type.LIST   -> "lst": A collection type (unordered).
     * Thrift.Type.SET    -> "set": A collection type (unordered and without repeated values).
     */
    Type: { [k: number]: string };

    /**
     * Thrift IDL type string to Id mapping.
     * The mapping table looks as follows:
     * "tf"  -> Thrift.Type.BOOL
     * "i8"  -> Thrift.Type.BYTE
     * "i16" -> Thrift.Type.I16
     * "i32" -> Thrift.Type.I32
     * "i64" -> Thrift.Type.I64
     * "dbl" -> Thrift.Type.DOUBLE
     * "rec" -> Thrift.Type.STRUCT
     * "str" -> Thrift.Type.STRING
     * "map" -> Thrift.Type.MAP
     * "lst" -> Thrift.Type.LIST
     * "set" -> Thrift.Type.SET
     */
    RType: { [k: string]: number };

    /**
     * The TJSONProtocol version number.
     */
    Version: number;

    /**
     * Initializes a Thrift JSON protocol instance.
     * @param {Thrift.Transport} transport - The transport to serialize to/from.
     */
    constructor(transport: Object);

    /**
     * Returns the underlying transport.
     * @returns {Thrift.Transport} The underlying transport.
     */
    getTransport(): Object;

    /**
     * Serializes the beginning of a Thrift RPC message.
     * @param {string} name - The service method to call.
     * @param {Thrift.MessageType} messageType - The type of method call.
     * @param {number} seqid - The sequence number of this call (always 0 in Apache Thrift).
     */
    writeMessageBegin(name: string, messageType: number, seqid: number): void;

    /**
     * Serializes the end of a Thrift RPC message.
     */
    writeMessageEnd(): void;

    /**
     * Serializes the beginning of a struct.
     * @param {string} name - The name of the struct.
     */
    writeStructBegin(name?: string): void;

    /**
     * Serializes the end of a struct.
     */
    writeStructEnd(): void;

    /**
     * Serializes the beginning of a struct field.
     * @param {string} name - The name of the field.
     * @param {Thrift.Protocol.Type} fieldType - The data type of the field.
     * @param {number} fieldId - The field's unique identifier.
     */
    writeFieldBegin(name: string, fieldType: number, fieldId: number): void;

    /**
     * Serializes the end of a field.
     */
    writeFieldEnd(): void;

    /**
     * Serializes the end of the set of fields for a struct.
     */
    writeFieldStop(): void;

    /**
     * Serializes the beginning of a map collection.
     * @param {Thrift.Type} keyType - The data type of the key.
     * @param {Thrift.Type} valType - The data type of the value.
     * @param {number} [size] - The number of elements in the map (ignored).
     */
    writeMapBegin(keyType: number, valType: number, size?: number): void;

    /**
     * Serializes the end of a map.
     */
    writeMapEnd(): void;

    /**
     * Serializes the beginning of a list collection.
     * @param {Thrift.Type} elemType - The data type of the elements.
     * @param {number} size - The number of elements in the list.
     */
    writeListBegin(elemType: number, size: number): void;

    /**
     * Serializes the end of a list.
     */
    writeListEnd(): void;

    /**
     * Serializes the beginning of a set collection.
     * @param {Thrift.Type} elemType - The data type of the elements.
     * @param {number} size - The number of elements in the list.
     */
    writeSetBegin(elemType: number, size: number): void;

    /**
     * Serializes the end of a set.
     */
    writeSetEnd(): void;

    /** Serializes a boolean */
    writeBool(value: boolean): void;

    /** Serializes a number */
    writeByte(i8: number): void;

    /** Serializes a number */
    writeI16(i16: number): void;

    /** Serializes a number */
    writeI32(i32: number): void;

    /** Serializes a number */
    writeI64(i64: number): void;

    /** Serializes a number */
    writeDouble(dbl: number): void;

    /** Serializes a string */
    writeString(str: string): void;

    /** Serializes a string */
    writeBinary(str: string): void;

    /**
       @class
       @name AnonReadMessageBeginReturn
       @property {string} fname - The name of the service method.
       @property {Thrift.MessageType} mtype - The type of message call.
       @property {number} rseqid - The sequence number of the message (0 in Thrift RPC).
     */
    /**
     * Deserializes the beginning of a message.
     * @returns {AnonReadMessageBeginReturn}
     */
    readMessageBegin(): { fname: string; mtype: number; rseqid: number };

    /** Deserializes the end of a message. */
    readMessageEnd(): void;

    /**
     * Deserializes the beginning of a struct.
     * @param {string} [name] - The name of the struct (ignored).
     * @returns {object} - An object with an empty string fname property.
     */
    readStructBegin(name?: string): { fname: string };

    /** Deserializes the end of a struct. */
    readStructEnd(): void;

    /**
       @class
       @name AnonReadFieldBeginReturn
       @property {string} fname - The name of the field (always '').
       @property {Thrift.Type} ftype - The data type of the field.
       @property {number} fid - The unique identifier of the field.
     */
    /**
     * Deserializes the beginning of a field.
     * @returns {AnonReadFieldBeginReturn}
     */
    readFieldBegin(): { fname: string; ftype: number; fid: number };

    /** Deserializes the end of a field. */
    readFieldEnd(): void;

    /**
       @class
       @name AnonReadMapBeginReturn
       @property {Thrift.Type} ktype - The data type of the key.
       @property {Thrift.Type} vtype - The data type of the value.
       @property {number} size - The number of elements in the map.
     */
    /**
     * Deserializes the beginning of a map.
     * @returns {AnonReadMapBeginReturn}
     */
    readMapBegin(): { ktype: number; vtype: number; size: number };

    /** Deserializes the end of a map. */
    readMapEnd(): void;

    /**
       @class
       @name AnonReadColBeginReturn
       @property {Thrift.Type} etype - The data type of the element.
       @property {number} size - The number of elements in the collection.
     */
    /**
     * Deserializes the beginning of a list.
     * @returns {AnonReadColBeginReturn}
     */
    readListBegin(): { etype: number; size: number };

    /** Deserializes the end of a list. */
    readListEnd(): void;

    /**
     * Deserializes the beginning of a set.
     * @param {Thrift.Type} elemType - The data type of the elements (ignored).
     * @param {number} size - The number of elements in the list (ignored).
     * @returns {AnonReadColBeginReturn}
     */
    readSetBegin(elemType?: number, size?: number): { etype: number; size: number };

    /** Deserializes the end of a set. */
    readSetEnd(): void;

    /** Returns an object with a value property set to
     *  False unless the next number in the protocol buffer
     *  is 1, in which case the value property is True. */
    readBool(): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readByte(): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readI16(): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readI32(f?: any): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readI64(): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readDouble(): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readString(): Object;

    /** Returns an object with a value property set to the
     next value found in the protocol buffer. */
    readBinary(): Object;

    /**
     * Method to arbitrarily skip over data (not implemented).
     */
    skip(type: number): void;
  }

  /**
   * Old alias of the TXHRTransport for backwards compatibility.
   */
  class Protocol extends TJSONProtocol {}

  class MultiplexProtocol extends TJSONProtocol {
    serviceName: string;

    /**
     * Initializes a MutilplexProtocol Implementation as a Wrapper for Thrift.Protocol.
     * @param {string} srvName
     * @param {Thrift.Transport} trans
     * @param {any} [strictRead]
     * @param {any} [strictWrite]
     */
    constructor(srvName: string, trans: Object, strictRead?: any, strictWrite?: any);

    /**
     * Override writeMessageBegin method of prototype
     * Serializes the beginning of a Thrift RPC message.
     * @param {string} name - The service method to call.
     * @param {Thrift.MessageType} messageType - The type of method call.
     * @param {number} seqid - The sequence number of this call (always 0 in Apache Thrift).
     */
    writeMessageBegin(name: string, type: number, seqid: number): void;
  }

  class Multiplexer {
    seqid: number;

    /**
     * Instantiates a multiplexed client for a specific service.
     * @param {String} serviceName - The transport to serialize to/from.
     * @param {Thrift.ServiceClient} SCl - The Service Client Class.
     * @param {Thrift.Transport} transport - Thrift.Transport instance which provides remote host:port.
     */
    createClient(serviceName: string, SCl: any, transport: Object): any;
  }
}
