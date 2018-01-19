// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements. See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership. The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

library thrift.test.transport.t_json_protocol_test;

import 'dart:async';
import 'dart:convert' show UTF8;
import 'dart:typed_data' show Uint8List;

import 'package:test/test.dart';
import 'package:thrift/thrift.dart';

void main() {
  final message = new TMessage('my message', TMessageType.ONEWAY, 123);

  TProtocol protocol;

  Primitive getPrimitive(int tType) {
    switch (tType) {
      case TType.BOOL:
        return new Primitive(protocol.readBool, protocol.writeBool, false);

      case TType.BYTE:
        return new Primitive(protocol.readByte, protocol.writeByte, 0);

      case TType.I16:
        return new Primitive(protocol.readI16, protocol.writeI16, 0);

      case TType.I32:
        return new Primitive(protocol.readI32, protocol.writeI32, 0);

      case TType.I64:
        return new Primitive(protocol.readI64, protocol.writeI64, 0);

      case TType.DOUBLE:
        return new Primitive(protocol.readDouble, protocol.writeDouble, 0);

      case TType.STRING:
        return new Primitive(protocol.readString, protocol.writeString, '');

      default:
        throw new UnsupportedError("Unsupported TType $tType");
    }
  }

  Future primitiveTest(Primitive primitive, input) async {
    primitive.write(input);
    protocol.writeMessageEnd();

    await protocol.transport.flush();

    protocol.readMessageBegin();
    var output = primitive.read();

    expect(output, input);
  }

  Future primitiveNullTest(Primitive primitive) async {
    primitive.write(null);
    protocol.writeMessageEnd();

    await protocol.transport.flush();

    protocol.readMessageBegin();
    var output = primitive.read();

    expect(output, primitive.defaultValue);
  }

  var sharedTests = () {
    test('Test message', () async {
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      var subject = protocol.readMessageBegin();

      expect(subject.name, message.name);
      expect(subject.type, message.type);
      expect(subject.seqid, message.seqid);
    });

    test('Test struct', () async {
      var input = new TStruct();

      protocol.writeStructBegin(input);
      protocol.writeStructEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      var output = protocol.readStructBegin();

      // name is not serialized, see C# version for reference
      expect(output, isNotNull);
    });

    test('Test field', () async {
      var input = new TField('my field', TType.MAP, 123);

      protocol.writeFieldBegin(input);
      protocol.writeFieldEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      var output = protocol.readFieldBegin();

      // name is not serialized, see C# version for reference
      expect(output.type, input.type);
      expect(output.id, input.id);
    });

    test('Test map', () async {
      var input = new TMap(TType.STRING, TType.STRUCT, 123);

      protocol.writeMapBegin(input);
      protocol.writeMapEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      var output = protocol.readMapBegin();

      expect(output.keyType, input.keyType);
      expect(output.valueType, input.valueType);
      expect(output.length, input.length);
    });

    test('Test list', () async {
      var input = new TList(TType.STRING, 123);

      protocol.writeListBegin(input);
      protocol.writeListEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      var output = protocol.readListBegin();

      expect(output.elementType, input.elementType);
      expect(output.length, input.length);
    });

    test('Test set', () async {
      var input = new TSet(TType.STRING, 123);

      protocol.writeSetBegin(input);
      protocol.writeSetEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      var output = protocol.readListBegin();

      expect(output.elementType, input.elementType);
      expect(output.length, input.length);
    });

    test('Test bool', () async {
      await primitiveTest(getPrimitive(TType.BOOL), true);
    });

    test('Test bool null', () async {
      await primitiveNullTest(getPrimitive(TType.BOOL));
    });

    test('Test byte', () async {
      await primitiveTest(getPrimitive(TType.BYTE), 64);
    });

    test('Test byte null', () async {
      await primitiveNullTest(getPrimitive(TType.BYTE));
    });

    test('Test I16', () async {
      await primitiveTest(getPrimitive(TType.I16), 32767);
    });

    test('Test I16 null', () async {
      await primitiveNullTest(getPrimitive(TType.I16));
    });

    test('Test I32', () async {
      await primitiveTest(getPrimitive(TType.I32), 2147483647);
    });

    test('Test I32 null', () async {
      await primitiveNullTest(getPrimitive(TType.I32));
    });

    test('Test I64', () async {
      await primitiveTest(getPrimitive(TType.I64), 9223372036854775807);
    });

    test('Test I64 null', () async {
      await primitiveNullTest(getPrimitive(TType.I64));
    });

    test('Test double', () async {
      await primitiveTest(getPrimitive(TType.DOUBLE), 3.1415926);
    });

    test('Test double null', () async {
      await primitiveNullTest(getPrimitive(TType.DOUBLE));
    });

    test('Test string', () async {
      var input = 'There are only two hard things in computer science: '
          'cache invalidation, naming things, and off-by-one errors.';
      await primitiveTest(getPrimitive(TType.STRING), input);
    });

    test('Test string null', () async {
      await primitiveNullTest(getPrimitive(TType.STRING));
    });

    test('Test binary', () async {
      var input = new Uint8List.fromList(new List.filled(100, 123));

      protocol.writeBinary(input);
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      var output = protocol.readBinary();

      expect(output.length, input.length);
      expect(output.every((i) => i == 123), isTrue);
    });

    test('Test complex struct', () async {
      // {1: {10: 20}, 2: {30: 40}}
      protocol.writeStructBegin(new TStruct());
      protocol.writeFieldBegin(new TField('success', TType.MAP, 0));
      protocol.writeMapBegin(new TMap(TType.I32, TType.MAP, 2));

      protocol.writeI32(1); // key
      protocol.writeMapBegin(new TMap(TType.I32, TType.I32, 1));
      protocol.writeI32(10); // key
      protocol.writeI32(20); // value
      protocol.writeMapEnd();

      protocol.writeI32(2); // key
      protocol.writeMapBegin(new TMap(TType.I32, TType.I32, 1));
      protocol.writeI32(30); // key
      protocol.writeI32(40); // value
      protocol.writeMapEnd();

      protocol.writeMapEnd();
      protocol.writeFieldEnd();
      protocol.writeFieldStop();
      protocol.writeStructEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      protocol.readStructBegin();
      expect(protocol.readFieldBegin().type, TType.MAP);
      expect(protocol.readMapBegin().length, 2);

      expect(protocol.readI32(), 1); // key
      expect(protocol.readMapBegin().length, 1);
      expect(protocol.readI32(), 10); // key
      expect(protocol.readI32(), 20); // value
      protocol.readMapEnd();

      expect(protocol.readI32(), 2); // key
      expect(protocol.readMapBegin().length, 1);
      expect(protocol.readI32(), 30); // key
      expect(protocol.readI32(), 40); // value
      protocol.readMapEnd();

      protocol.readMapEnd();
      protocol.readFieldEnd();
      protocol.readStructEnd();
      protocol.readMessageEnd();
    });

    test('Test nested maps and lists', () async {
      // {1: [{10: 20}], 2: [{30: 40}]}
      protocol.writeMapBegin(new TMap(TType.I32, TType.LIST, 2));

      protocol.writeI32(1); // key
      protocol.writeListBegin(new TList(TType.MAP, 1));
      protocol.writeMapBegin(new TMap(TType.I32, TType.I32, 1));
      protocol.writeI32(10); // key
      protocol.writeI32(20); // value
      protocol.writeMapEnd();
      protocol.writeListEnd();

      protocol.writeI32(2); // key
      protocol.writeListBegin(new TList(TType.MAP, 1));
      protocol.writeMapBegin(new TMap(TType.I32, TType.I32, 1));
      protocol.writeI32(30); // key
      protocol.writeI32(40); // value
      protocol.writeMapEnd();
      protocol.writeListEnd();

      protocol.writeMapEnd();
      protocol.writeMessageEnd();

      await protocol.transport.flush();

      protocol.readMessageBegin();
      expect(protocol.readMapBegin().length, 2);

      expect(protocol.readI32(), 1); // key
      expect(protocol.readListBegin().length, 1);
      expect(protocol.readMapBegin().length, 1);
      expect(protocol.readI32(), 10); // key
      expect(protocol.readI32(), 20); // value
      protocol.readMapEnd();
      protocol.readListEnd();

      expect(protocol.readI32(), 2); // key
      expect(protocol.readListBegin().length, 1);
      expect(protocol.readMapBegin().length, 1);
      expect(protocol.readI32(), 30); // key
      expect(protocol.readI32(), 40); // value
      protocol.readMapEnd();
      protocol.readListEnd();

      protocol.readMapEnd();
      protocol.readMessageEnd();
    });
  };

  group('JSON', () {
    setUp(() {
      protocol = new TJsonProtocol(new TBufferedTransport());
      protocol.writeMessageBegin(message);
    });

    test('Test escaped unicode', () async {
      /*
         KOR_KAI
           UTF-8:  0xE0 0xB8 0x81
           UTF-16: 0x0E01
         G clef:
           UTF-8:  0xF0 0x9D 0x84 0x9E
           UTF-16: 0xD834 0xDD1E
       */
      var buffer = UTF8.encode(r'"\u0001\u0e01 \ud834\udd1e"');
      var transport = new TBufferedTransport();
      transport.writeAll(buffer);

      var protocol = new TJsonProtocol(transport);

      await protocol.transport.flush();

      var subject = protocol.readString();
      expect(subject,
          UTF8.decode([0x01, 0xE0, 0xB8, 0x81, 0x20, 0xF0, 0x9D, 0x84, 0x9E]));
    });

    group('shared tests', sharedTests);
  });

  group('binary', () {
    setUp(() {
      protocol = new TBinaryProtocol(new TBufferedTransport());
      protocol.writeMessageBegin(message);
    });

    group('shared tests', sharedTests);
  });

  group('compact', () {
    setUp(() {
      protocol = new TCompactProtocol(new TBufferedTransport());
      protocol.writeMessageBegin(message);
    });

    group('shared tests', sharedTests);
  });
}

class Primitive {
  final Function read;
  final Function write;
  final defaultValue;

  Primitive(this.read, this.write, this.defaultValue);
}
