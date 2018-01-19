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

import Foundation


public protocol TSerializable : Hashable {
  
  static var thriftType : TType { get }
  
  init()
  
  static func readValueFromProtocol(proto: TProtocol) throws -> Self
  
  static func writeValue(value: Self, toProtocol proto: TProtocol) throws
  
}



infix operator ?== {}

public func ?==<T: TSerializable>(lhs: T?, rhs: T?) -> Bool {
  if let l = lhs, r = rhs {
    return l == r
  }
  return lhs == rhs
}

public func ?==<T: TSerializable>(lhs: T, rhs: T) -> Bool {
  return lhs == rhs
}



extension Bool : TSerializable {
  
  public static let thriftType = TType.BOOL
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Bool {
    var value : ObjCBool = false
    try proto.readBool(&value)
    return value.boolValue
  }
  
  public static func writeValue(value: Bool, toProtocol proto: TProtocol) throws {
    try proto.writeBool(value)
  }
  
}

extension Int8 : TSerializable {
  
  public static let thriftType = TType.BYTE
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Int8 {
    var value = UInt8()
    try proto.readByte(&value)
    return Int8(value)
  }
  
  public static func writeValue(value: Int8, toProtocol proto: TProtocol) throws {
    try proto.writeByte(UInt8(value))
  }
  
}

extension Int16 : TSerializable {
  
  public static let thriftType = TType.I16
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Int16 {
    var value = Int16()
    try proto.readI16(&value)
    return value
  }
  
  public static func writeValue(value: Int16, toProtocol proto: TProtocol) throws {
    try proto.writeI16(value)
  }
  
}

extension Int : TSerializable {
  
  public static let thriftType = TType.I32
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Int {
    var value = Int32()
    try proto.readI32(&value)
    return Int(value)
  }
  
  public static func writeValue(value: Int, toProtocol proto: TProtocol) throws {
    try proto.writeI32(Int32(value))
  }
  
}

extension Int32 : TSerializable {
  
  public static let thriftType = TType.I32
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Int32 {
    var value = Int32()
    try proto.readI32(&value)
    return value
  }
  
  public static func writeValue(value: Int32, toProtocol proto: TProtocol) throws {
    try proto.writeI32(value)
  }
  
}

extension Int64 : TSerializable {
  
  public static let thriftType = TType.I64
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Int64 {
    var value = Int64()
    try proto.readI64(&value)
    return value
  }
  
  public static func writeValue(value: Int64, toProtocol proto: TProtocol) throws {
    try proto.writeI64(value)
  }
  
}

extension Double : TSerializable {
  
  public static let thriftType = TType.DOUBLE
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> Double {
    var value = Double()
    try proto.readDouble(&value)
    return value
  }
  
  public static func writeValue(value: Double, toProtocol proto: TProtocol) throws {
    try proto.writeDouble(value)
  }
  
}

extension String : TSerializable {
  
  public static let thriftType = TType.STRING
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> String {
    var value : NSString?
    try proto.readString(&value)
    return value as! String
  }
  
  public static func writeValue(value: String, toProtocol proto: TProtocol) throws {
    try proto.writeString(value)
  }
  
}
