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

library thrift.test.serializer.serializer_test;

import 'package:thrift/thrift.dart';

/// TestTObject is a simple test struct
class TestTObject implements TBase {
  static final TStruct _STRUCT_DESC = new TStruct("TestTObject");
  static final TField _I_FIELD_DESC = new TField("i", TType.I32, 1);
  static final TField _D_FIELD_DESC = new TField("d", TType.DOUBLE, 2);
  static final TField _S_FIELD_DESC = new TField("s", TType.STRING, 3);
  static final TField _L_FIELD_DESC = new TField("l", TType.LIST, 4);
  static final TField _B_FIELD_DESC = new TField("b", TType.BOOL, 5);

  int _i;
  static const int I = 1;
  double _d;
  static const int D = 2;
  String _s;
  static const int S = 3;
  List<String> _l;
  static const int L = 4;
  bool _b;
  static const int B = 5;

  bool __isset_i = false;
  bool __isset_d = false;
  bool __isset_b = false;

  TestTObject() {
  }

  // i
  int get i => this._i;

  set i(int i) {
    this._i = i;
    this.__isset_i = true;
  }

  bool isSetI() => this.__isset_i;

  unsetI() {
    this.__isset_i = false;
  }

  // d
  double get d => this._d;

  set d(double d) {
    this._d = d;
    this.__isset_d = true;
  }

  bool isSetD() => this.__isset_d;

  unsetD() {
    this.__isset_d = false;
  }

  // s
  String get s => this._s;

  set s(String s) {
    this._s = s;
  }

  bool isSetS() => this.s != null;

  unsetS() {
    this.s = null;
  }

  // l
  List<String> get l => this._l;

  set l(List<String> l) {
    this._l = l;
  }

  bool isSetL() => this.l != null;

  unsetL() {
    this.l = null;
  }

  // b
  bool get b => this._b;

  set b(bool b) {
    this._b = b;
    this.__isset_b = true;
  }

  bool isSetB() => this.__isset_b;

  unsetB() {
    this.__isset_b = false;
  }

  getFieldValue(int fieldID) {
    switch (fieldID) {
      case I:
        return this.i;
      case D:
        return this.d;
      case S:
        return this.s;
      case L:
        return this.l;
      case B:
        return this.b;
      default:
        throw new ArgumentError("Field $fieldID doesn't exist!");
    }
  }

  setFieldValue(int fieldID, Object value) {
    switch (fieldID) {
      case I:
        if (value == null) {
          unsetI();
        } else {
          this.i = value;
        }
        break;

      case D:
        if (value == null) {
          unsetD();
        } else {
          this.d = value;
        }
        break;

      case S:
        if (value == null) {
          unsetS();
        } else {
          this.s = value;
        }
        break;

      case L:
        if (value == null) {
          unsetL();
        } else {
          this.l = value as List<String>;
        }
        break;

      case B:
        if (value == null) {
          unsetB();
        } else {
          this.b = value;
        }
        break;

      default:
        throw new ArgumentError("Field $fieldID doesn't exist!");
    }
  }

  // Returns true if field corresponding to fieldID is set (has been assigned a value) and false otherwise
  bool isSet(int fieldID) {
    switch (fieldID) {
      case I:
        return isSetI();
      case D:
        return isSetD();
      case S:
        return isSetS();
      case L:
        return isSetL();
      case B:
        return isSetB();
      default:
        throw new ArgumentError("Field $fieldID doesn't exist!");
    }
  }

  read(TProtocol iprot) {
    TField field;
    iprot.readStructBegin();
    while (true) {
      field = iprot.readFieldBegin();
      if (field.type == TType.STOP) {
        break;
      }
      switch (field.id) {
        case I:
          if (field.type == TType.I32) {
            this.i = iprot.readI32();
            this.__isset_i = true;
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;
        case D:
          if (field.type == TType.DOUBLE) {
            this.d = iprot.readDouble();
            this.__isset_d = true;
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;
        case S:
          if (field.type == TType.STRING) {
            this.s = iprot.readString();
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;
        case L:
          if (field.type == TType.LIST) {
            {
              TList _list74 = iprot.readListBegin();
              this.l = new List<String>();
              for (int _i75 = 0; _i75 < _list74.length; ++_i75) {
                String _elem76;
                _elem76 = iprot.readString();
                this.l.add(_elem76);
              }
              iprot.readListEnd();
            }
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;
        case B:
          if (field.type == TType.BOOL) {
            this.b = iprot.readBool();
            this.__isset_b = true;
          } else {
            TProtocolUtil.skip(iprot, field.type);
          }
          break;
        default:
          TProtocolUtil.skip(iprot, field.type);
          break;
      }
      iprot.readFieldEnd();
    }
    iprot.readStructEnd();

    // check for required fields of primitive type, which can't be checked in the validate method
    validate();
  }

  write(TProtocol oprot) {
    validate();

    oprot.writeStructBegin(_STRUCT_DESC);
    oprot.writeFieldBegin(_I_FIELD_DESC);
    oprot.writeI32(this.i);
    oprot.writeFieldEnd();
    oprot.writeFieldBegin(_D_FIELD_DESC);
    oprot.writeDouble(this.d);
    oprot.writeFieldEnd();
    if (this.s != null) {
      oprot.writeFieldBegin(_S_FIELD_DESC);
      oprot.writeString(this.s);
      oprot.writeFieldEnd();
    }
    if (this.l != null) {
      oprot.writeFieldBegin(_L_FIELD_DESC);
      {
        oprot.writeListBegin(new TList(TType.STRING, this.l.length));
        for (var elem77 in this.l) {
          oprot.writeString(elem77);
        }
        oprot.writeListEnd();
      }
      oprot.writeFieldEnd();
    }
    oprot.writeFieldBegin(_B_FIELD_DESC);
    oprot.writeBool(this.b);
    oprot.writeFieldEnd();
    oprot.writeFieldStop();
    oprot.writeStructEnd();
  }

  String toString() {
    StringBuffer ret = new StringBuffer("TestTObject(");

    ret.write("i:");
    ret.write(this.i);

    ret.write(", ");
    ret.write("d:");
    ret.write(this.d);

    ret.write(", ");
    ret.write("s:");
    if (this.s == null) {
      ret.write("null");
    } else {
      ret.write(this.s);
    }

    ret.write(", ");
    ret.write("l:");
    if (this.l == null) {
      ret.write("null");
    } else {
      ret.write(this.l);
    }

    ret.write(", ");
    ret.write("b:");
    ret.write(this.b);

    ret.write(")");

    return ret.toString();
  }

  validate() {
    // check for required fields
    // check that fields of type enum have valid values
  }

}
