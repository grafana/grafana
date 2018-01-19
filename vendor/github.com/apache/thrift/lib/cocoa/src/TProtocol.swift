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


public extension TProtocol {
  
  public func readMessageBegin() throws -> (String, TMessageType, Int) {
    
    var name : NSString?
    var type : Int32 = -1
    var sequenceID : Int32 = -1
    
    try readMessageBeginReturningName(&name, type: &type, sequenceID: &sequenceID)
    
    return (name as String!, TMessageType(rawValue: type)!, Int(sequenceID))
  }
  
  public func writeMessageBeginWithName(name: String, type: TMessageType, sequenceID: Int) throws {
    try writeMessageBeginWithName(name, type: type.rawValue, sequenceID: Int32(sequenceID))
  }
  
  public func readStructBegin() throws -> (String?) {
    
    var name : NSString? = nil
    
    try readStructBeginReturningName(&name)
    
    return (name as String?)
  }
  
  public func readFieldBegin() throws -> (String?, TType, Int) {
    
    var name : NSString? = nil
    var type : Int32 = -1
    var fieldID : Int32 = -1
    
    try readFieldBeginReturningName(&name, type: &type, fieldID: &fieldID)
    
    return (name as String?, TType(rawValue: type)!, Int(fieldID))
  }
  
  public func writeFieldBeginWithName(name: String, type: TType, fieldID: Int) throws {
    try writeFieldBeginWithName(name, type: type.rawValue, fieldID: Int32(fieldID))
  }
  
  public func readMapBegin() throws -> (TType, TType, Int32) {
    
    var keyType : Int32 = -1
    var valueType : Int32 = -1
    var size : Int32 = 0
    
    try readMapBeginReturningKeyType(&keyType, valueType: &valueType, size: &size)
    
    return (TType(rawValue: keyType)!, TType(rawValue: valueType)!, size)
  }
  
  public func writeMapBeginWithKeyType(keyType: TType, valueType: TType, size: Int) throws {
    try writeMapBeginWithKeyType(keyType.rawValue, valueType: valueType.rawValue, size: Int32(size))
  }
  
  public func readSetBegin() throws -> (TType, Int32) {
    
    var elementType : Int32 = -1
    var size : Int32 = 0
    
    try readSetBeginReturningElementType(&elementType, size: &size)
    
    return (TType(rawValue: elementType)!, size)
  }
  
  public func writeSetBeginWithElementType(elementType: TType, size: Int) throws {
    try writeSetBeginWithElementType(elementType.rawValue, size: Int32(size))
  }
  
  public func readListBegin() throws -> (TType, Int32) {
    
    var elementType : Int32 = -1
    var size : Int32 = 0
    
    try readListBeginReturningElementType(&elementType, size: &size)
    
    return (TType(rawValue: elementType)!, size)
  }
  
  public func writeListBeginWithElementType(elementType: TType, size: Int) throws {
    try writeListBeginWithElementType(elementType.rawValue, size: Int32(size))
  }
  
  public func writeFieldValue<T: TSerializable>(value: T, name: String, type: TType, id: Int32) throws {
    try writeFieldBeginWithName(name, type: type.rawValue, fieldID: id)
    try writeValue(value)
    try writeFieldEnd()
  }
  
  public func readValue<T: TSerializable>() throws -> T {
    return try T.readValueFromProtocol(self)
  }
  
  public func writeValue<T: TSerializable>(value: T) throws {
    try T.writeValue(value, toProtocol: self)
  }
  
  public func readResultMessageBegin() throws {
    
    let (_, type, _) = try readMessageBegin();
    
    if type == .EXCEPTION {
      let x = try readException()
      throw x
    }
    
    return
  }
  
  public func validateValue(value: Any?, named name: String) throws {
    
    if value == nil {
      throw NSError(
        domain: TProtocolErrorDomain,
        code: Int(TProtocolError.Unknown.rawValue),
        userInfo: [TProtocolErrorFieldNameKey: name])
    }
    
  }
  
  public func readException() throws -> ErrorType {
    
    var reason : String?
    var type = TApplicationError.Unknown
    
    try readStructBegin()
    
    fields: while (true) {
      
      let (_, fieldType, fieldID) = try readFieldBegin()
      
      switch (fieldID, fieldType) {
      case (_, .STOP):
        break fields
        
      case (1, .STRING):
        reason = try readValue() as String
        
      case (2, .I32):
        let typeVal = try readValue() as Int32
        if let tmp = TApplicationError(rawValue: typeVal) {
          type = tmp
        }
        
      case let (_, unknownType):
        try skipType(unknownType)
      }
      
      try readFieldEnd()
    }
    
    try readStructEnd()
    
    return NSError(type:type, reason:reason ?? "")
  }
  
  public func writeExceptionForMessageName(name: String, sequenceID: Int, ex: NSError) throws {
    try writeMessageBeginWithName(name, type: .EXCEPTION, sequenceID: sequenceID)
    try ex.write(self)
    try writeMessageEnd()
  }
  
  public func skipType(type: TType) throws {
    try TProtocolUtil.skipType(type.rawValue, onProtocol: self)
  }
  
}
