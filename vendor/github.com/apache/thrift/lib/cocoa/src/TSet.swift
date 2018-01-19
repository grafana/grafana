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


public struct TSet<Element : TSerializable> : CollectionType, ArrayLiteralConvertible, TSerializable {
  
  public static var thriftType : TType { return .SET }
  
  public typealias Index = Storage.Index
  
  typealias Storage = Set<Element>
  
  private var storage : Storage
  
  public init() {
    storage = Storage()
  }
  
  public init(arrayLiteral elements: Element...) {
    storage = Storage(elements)
  }
  
  public init<S : SequenceType where S.Generator.Element == Element>(_ sequence: S) {
    storage = Storage(sequence)    
  }
  
  public var startIndex : Index { return storage.startIndex }
  
  public var endIndex : Index { return storage.endIndex }
  
  public mutating func insert(member: Element) {
    return storage.insert(member)
  }
  
  public mutating func remove(element: Element) -> Element? {
    return storage.remove(element)
  }
  
  public mutating func removeAll(keepCapacity keepCapacity: Bool = false) {
    return storage.removeAll(keepCapacity: keepCapacity)
  }
  
  public mutating func removeAtIndex(index: SetIndex<Element>) -> Element {
    return storage.removeAtIndex(index)
  }
  
  public subscript (position: SetIndex<Element>) -> Element {
    return storage[position]
  }
  
  public func union(other: TSet) -> TSet {
    return TSet(storage.union(other))
  }
  
  public func intersect(other: TSet) -> TSet {
    return TSet(storage.intersect(other))
  }
  
  public func exclusiveOr(other: TSet) -> TSet {
    return TSet(storage.exclusiveOr(other))
  }
  
  public func subtract(other: TSet) -> TSet {
    return TSet(storage.subtract(other))
  }
  
  public mutating func intersectInPlace(other: TSet) {
    storage.intersectInPlace(other)
  }

  public mutating func exclusiveOrInPlace(other: TSet) {
    storage.exclusiveOrInPlace(other)
  }

  public mutating func subtractInPlace(other: TSet) {
    storage.subtractInPlace(other)
  }  

  public func isSubsetOf(other: TSet) -> Bool {
    return storage.isSubsetOf(other)
  }

  public func isDisjointWith(other: TSet) -> Bool {
    return storage.isDisjointWith(other)
  }
  
  public func isSupersetOf(other: TSet) -> Bool {
    return storage.isSupersetOf(other)
  }

  public var isEmpty: Bool { return storage.isEmpty }

  public var hashValue : Int {
    let prime = 31
    var result = 1
    for element in storage {
      result = prime * result + element.hashValue
    }
    return result
  }
  
  public static func readValueFromProtocol(proto: TProtocol) throws -> TSet {
    let (elementType, size) = try proto.readSetBegin()
    if elementType != Element.thriftType {
      throw NSError(
        domain: TProtocolErrorDomain,
        code: Int(TProtocolError.InvalidData.rawValue),
        userInfo: [TProtocolErrorExtendedErrorKey: NSNumber(int: elementType.rawValue)])
    }
    var set = TSet()
    for _ in 0..<size {
      let element = try Element.readValueFromProtocol(proto)
      set.storage.insert(element)
    }
    try proto.readSetEnd()
    return set
  }
  
  public static func writeValue(value: TSet, toProtocol proto: TProtocol) throws {
    try proto.writeSetBeginWithElementType(Element.thriftType, size: value.count)
    for element in value.storage {
      try Element.writeValue(element, toProtocol: proto)
    }
    try proto.writeSetEnd()
  }
  
}

extension TSet : CustomStringConvertible, CustomDebugStringConvertible {
  
  public var description : String {
    return storage.description
  }
  
  public var debugDescription : String {
    return storage.debugDescription
  }
  
}

public func ==<Element>(lhs: TSet<Element>, rhs: TSet<Element>) -> Bool {
  return lhs.storage == rhs.storage
}
