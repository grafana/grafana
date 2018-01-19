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


public struct TBinary : TSerializable {
  
  public static var thriftType : TType { return .STRING }
  
  private var storage : NSData
  
  public init() {
    self.storage = NSData()
  }
  
  public init(contentsOfFile file: String, options: NSDataReadingOptions = []) throws {
    self.storage = try NSData(contentsOfFile: file, options: options)
  }
  
  public init(contentsOfURL URL: NSURL, options: NSDataReadingOptions = []) throws {
    self.storage = try NSData(contentsOfURL: URL, options: options)
  }
  
  public init?(base64EncodedData base64Data: NSData, options: NSDataBase64DecodingOptions = []) {
    guard let storage = NSData(base64EncodedData: base64Data, options: options) else {
      return nil
    }
    self.storage = storage
  }
  
  public init(data: NSData) {
    self.storage = data
  }
  
  public var length : Int {
    return storage.length
  }
  
  public var hashValue : Int {
    return storage.hashValue
  }
  
  public var bytes : UnsafePointer<Void> {
    return storage.bytes
  }
  
  public func getBytes(buffer: UnsafeMutablePointer<Void>, length: Int) {
    storage.getBytes(buffer, length: length)
  }
  
  public func getBytes(buffer: UnsafeMutablePointer<Void>, range: Range<Int>) {
    storage.getBytes(buffer, range: NSRange(range))
  }
  
  public func subBinaryWithRange(range: Range<Int>) -> TBinary {
    return TBinary(data: storage.subdataWithRange(NSRange(range)))
  }
  
  public func writeToFile(path: String, options: NSDataWritingOptions = []) throws {
    try storage.writeToFile(path, options: options)
  }
  
  public func writeToURL(url: NSURL, options: NSDataWritingOptions = []) throws {
    try storage.writeToURL(url, options: options)
  }
  
  public func rangeOfData(dataToFind data: NSData, options: NSDataSearchOptions, range: Range<Int>) -> Range<Int>? {
    return storage.rangeOfData(data, options: options, range: NSRange(range)).toRange()
  }
  
  public func enumerateByteRangesUsingBlock(block: (UnsafePointer<Void>, Range<Int>, inout Bool) -> Void) {
    storage.enumerateByteRangesUsingBlock { bytes, range, stop in
      var stopTmp = Bool(stop.memory)
      block(bytes, range.toRange()!, &stopTmp)
      stop.memory = ObjCBool(stopTmp)
    }
  }
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> TBinary {
    var data : NSData?
    try proto.readBinary(&data)
    return TBinary(data: data!)
  }
  
  public static func writeValue(value: TBinary, toProtocol proto: TProtocol) throws {
    try proto.writeBinary(value.storage)
  }
  
}

extension TBinary : CustomStringConvertible, CustomDebugStringConvertible {
  
  public var description : String {
    return storage.description
  }
  
  public var debugDescription : String {
    return storage.debugDescription
  }
  
}

public func ==(lhs: TBinary, rhs: TBinary) -> Bool {
  return lhs.storage == rhs.storage
}
