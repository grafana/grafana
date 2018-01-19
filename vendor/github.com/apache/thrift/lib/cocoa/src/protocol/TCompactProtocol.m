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

#import "TCompactProtocol.h"
#import "TProtocolError.h"

static const UInt8 COMPACT_PROTOCOL_ID = 0x82;
static const UInt8 COMPACT_VERSION = 1;
static const UInt8 COMPACT_VERSION_MASK = 0x1F; // 0001 1111
static const UInt8 COMPACT_TYPE_MASK = 0xE0; // 1110 0000
static const UInt8 COMPACT_TYPE_BITS = 0x07; // 0000 0111
static const int COMPACT_TYPE_SHIFT_AMOUNT = 5;

enum {
  TCType_STOP = 0x00,
  TCType_BOOLEAN_TRUE = 0x01,
  TCType_BOOLEAN_FALSE = 0x02,
  TCType_BYTE = 0x03,
  TCType_I16 = 0x04,
  TCType_I32 = 0x05,
  TCType_I64 = 0x06,
  TCType_DOUBLE = 0x07,
  TCType_BINARY = 0x08,
  TCType_LIST = 0x09,
  TCType_SET = 0x0A,
  TCType_MAP = 0x0B,
  TCType_STRUCT = 0x0C,
};

@implementation TCompactProtocolFactory

+(TCompactProtocolFactory *) sharedFactory
{
  static TCompactProtocolFactory *gSharedFactory = nil;
  if (gSharedFactory == nil) {
    gSharedFactory = [[TCompactProtocolFactory alloc] init];
  }

  return gSharedFactory;
}

-(NSString *) protocolName
{
  return @"compact";
}

-(TCompactProtocol *) newProtocolOnTransport:(id <TTransport>)transport
{
  return [[TCompactProtocol alloc] initWithTransport:transport];
}

@end


@interface TCompactProtocol ()

@property(strong, nonatomic) id <TTransport> transport;

@property(strong, nonatomic) NSMutableArray *lastField;
@property(assign, nonatomic) short lastFieldId;

@property(strong, nonatomic) NSString *boolFieldName;
@property(strong, nonatomic) NSNumber *boolFieldType;
@property(strong, nonatomic) NSNumber *boolFieldId;
@property(strong, nonatomic) NSNumber *booleanValue;

@property(strong, nonatomic) NSString *currentMessageName;

@end


@implementation TCompactProtocol

-(id) init
{
  self = [super init];

  if (self != nil) {
    _lastField = [[NSMutableArray alloc] init];
  }

  return self;
}

-(id) initWithTransport:(id <TTransport>)aTransport
{
  self = [self init];

  if (self != nil) {
    _transport = aTransport;
  }

  return self;
}

-(id <TTransport>) transport
{
  return _transport;
}

-(BOOL) writeByteDirect:(UInt8)n error:(NSError *__autoreleasing *)error
{
  if (![_transport write:(UInt8 *)&n offset:0 length:1 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }
  return YES;
}

-(BOOL) writeVarint32:(UInt32)n error:(NSError *__autoreleasing *)error
{
  UInt8 i32buf[5] = {0};
  UInt32 idx = 0;

  while (true) {
    if ((n & ~0x7F) == 0) {
      i32buf[idx++] = (UInt8)n;
      break;
    }
    else {
      i32buf[idx++] = (UInt8)((n & 0x7F) | 0x80);
      n >>= 7;
    }
  }

  if (![_transport write:i32buf offset:0 length:idx error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}

-(BOOL) writeMessageBeginWithName:(NSString *)name
                             type:(SInt32)messageType
                       sequenceID:(SInt32)sequenceID
                            error:(NSError *__autoreleasing *)error
{
  if (![self writeByteDirect:COMPACT_PROTOCOL_ID error:error]) {
    return NO;
  }
  if (![self writeByteDirect:(UInt8)((COMPACT_VERSION & COMPACT_VERSION_MASK) |
                                     ((((UInt32)messageType) << COMPACT_TYPE_SHIFT_AMOUNT) & COMPACT_TYPE_MASK)) error:error])
  {
    return NO;
  }
  if (![self writeVarint32:(UInt32)sequenceID error:error]) {
    return NO;
  }
  if (![self writeString:name error:error]) {
    return NO;
  }

  _currentMessageName = name;

  return YES;
}

-(BOOL) writeStructBeginWithName:(NSString *)name error:(NSError *__autoreleasing *)error
{
  [_lastField addObject:@(_lastFieldId)];
  _lastFieldId = 0;
  return YES;
}

-(BOOL) writeStructEnd:(NSError *__autoreleasing *)error
{
  _lastFieldId = [_lastField.lastObject shortValue];
  [_lastField removeLastObject];
  return YES;
}

-(BOOL) writeFieldBeginWithName:(NSString *)name
                           type:(SInt32)fieldType
                        fieldID:(SInt32)fieldID
                          error:(NSError *__autoreleasing *)error
{
  if (fieldType == TTypeBOOL) {
    _boolFieldName = [name copy];
    _boolFieldType = @(fieldType);
    _boolFieldId = @(fieldID);
    return YES;
  }
  else {
    return [self writeFieldBeginInternalWithName:name
                                            type:fieldType
                                         fieldID:fieldID
                                    typeOverride:0xFF
                                           error:error];
  }
}

-(BOOL) writeFieldBeginInternalWithName:(NSString *)name
                                   type:(SInt32)fieldType
                                fieldID:(SInt32)fieldID
                           typeOverride:(UInt8)typeOverride
                                  error:(NSError *__autoreleasing *)error
{
  UInt8 typeToWrite = typeOverride == 0xFF ? [self compactTypeForTType:fieldType] : typeOverride;

  // check if we can use delta encoding for the field id
  if (fieldID > _lastFieldId && fieldID - _lastFieldId <= 15) {
    // Write them together
    if (![self writeByteDirect:(fieldID - _lastFieldId) << 4 | typeToWrite error:error]) {
      return NO;
    }
  }
  else {
    // Write them separate
    if (![self writeByteDirect:typeToWrite error:error]) {
      return NO;
    }
    if (![self writeI16:fieldID error:error]) {
      return NO;
    }
  }

  _lastFieldId = fieldID;

  return YES;
}

-(BOOL) writeFieldStop:(NSError *__autoreleasing *)error
{
  return [self writeByteDirect:TCType_STOP error:error];
}

-(BOOL) writeMapBeginWithKeyType:(SInt32)keyType
                       valueType:(SInt32)valueType
                            size:(SInt32)size
                           error:(NSError *__autoreleasing *)error
{
  if (size == 0) {
    if (![self writeByteDirect:0 error:error]) {
      return NO;
    }
  }
  else {
    if (![self writeVarint32:(UInt32)size error:error]) {
      return NO;
    }
    if (![self writeByteDirect:[self compactTypeForTType:keyType] << 4 | [self compactTypeForTType:valueType] error:error]) {
      return NO;
    }
  }
  return YES;
}

-(BOOL) writeListBeginWithElementType:(SInt32)elementType
                                 size:(SInt32)size
                                error:(NSError *__autoreleasing *)error
{
  return [self writeCollectionBeginWithElementType:elementType size:size error:error];
}

-(BOOL) writeSetBeginWithElementType:(SInt32)elementType
                                size:(SInt32)size
                               error:(NSError *__autoreleasing *)error
{
  return [self writeCollectionBeginWithElementType:elementType size:size error:error];
}

-(BOOL) writeBool:(BOOL)b error:(NSError *__autoreleasing *)error
{
  BOOL result;
  if (_boolFieldId != nil && _boolFieldName != nil && _boolFieldType != nil) {
    // we haven't written the field header yet
    result = [self writeFieldBeginInternalWithName:_boolFieldName
                                              type:_boolFieldType.intValue
                                           fieldID:_boolFieldId.intValue
                                      typeOverride:b ? TCType_BOOLEAN_TRUE : TCType_BOOLEAN_FALSE
                                             error:error];
    _boolFieldId = nil;
    _boolFieldName = nil;
    _boolFieldType = nil;
  }
  else {
    // we're not part of a field, so just Write the value.
    result = [self writeByteDirect:b ? TCType_BOOLEAN_TRUE : TCType_BOOLEAN_FALSE error:error];
  }
  return result;
}

-(BOOL) writeByte:(UInt8)value error:(NSError *__autoreleasing *)error
{
  return [self writeByteDirect:value error:error];
}

-(BOOL) writeI16:(SInt16)value error:(NSError *__autoreleasing *)error
{
  return [self writeVarint32:[self i32ToZigZag:value] error:error];
}

-(BOOL) writeI32:(SInt32)value error:(NSError *__autoreleasing *)error
{
  return [self writeVarint32:[self i32ToZigZag:value] error:error];
}

-(BOOL) writeI64:(SInt64)value error:(NSError *__autoreleasing *)error
{
  return [self writeVarint64:[self i64ToZigZag:value] error:error];
}

-(BOOL) writeDouble:(double)value error:(NSError *__autoreleasing *)error
{
  // Safe bit-casting double->uint64

  UInt64 bits = 0;
  memcpy(&bits, &value, 8);

  bits = OSSwapHostToLittleInt64(bits);

  if (![_transport write:(UInt8 *)&bits offset:0 length:8 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}

-(BOOL) writeString:(NSString *)value error:(NSError *__autoreleasing *)error
{
  return [self writeBinary:[value dataUsingEncoding:NSUTF8StringEncoding] error:error];
}

-(BOOL) writeBinary:(NSData *)data error:(NSError *__autoreleasing *)error
{
  if (![self writeVarint32:(UInt32)data.length error:error]) {
    return NO;
  }
  if (![_transport write:data.bytes offset:0 length:(UInt32)data.length error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }
  return YES;
}

-(BOOL) writeMessageEnd:(NSError *__autoreleasing *)error
{
  _currentMessageName = nil;
  return YES;
}

-(BOOL) writeMapEnd:(NSError *__autoreleasing *)error
{
  return YES;
}

-(BOOL) writeListEnd:(NSError *__autoreleasing *)error
{
  return YES;
}

-(BOOL) writeSetEnd:(NSError *__autoreleasing *)error
{
  return YES;
}

-(BOOL) writeFieldEnd:(NSError *__autoreleasing *)error
{
  return YES;
}

-(BOOL) writeCollectionBeginWithElementType:(SInt32)elementType
                                       size:(SInt32)size
                                      error:(NSError *__autoreleasing *)error
{
  UInt8 ctypeElement = [self compactTypeForTType:elementType];

  if (size <= 14) {
    if (![self writeByteDirect:size << 4 | ctypeElement error:error]) {
      return NO;
    }
  }
  else {
    if (![self writeByteDirect:0xf0 | ctypeElement error:error]) {
      return NO;
    }
    if (![self writeVarint32:(UInt32)size error:error]) {
      return NO;
    }
  }
  return YES;
}

-(BOOL) writeVarint64:(UInt64)n error:(NSError *__autoreleasing *)error
{
  UInt8 varint64out[10] = {0};
  int idx = 0;

  while (true) {
    if ((n & ~0x7FL) == 0) {
      varint64out[idx++] = (UInt8)n;
      break;
    }
    else {
      varint64out[idx++] = (UInt8)((n & 0x7F) | 0x80);
      n >>= 7;
    }
  }

  if (![_transport write:varint64out offset:0 length:idx error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}

-(UInt32) i32ToZigZag:(SInt32)n
{
  /*
     ZigZag encoding maps signed integers to unsigned integers so that
     numbers with a small absolute value (for instance, -1) have
     a small varint encoded value too. It does this in a way that
     "zig-zags" back and forth through the positive and negative integers,
     so that -1 is encoded as 1, 1 is encoded as 2, -2 is encoded as 3, and so
         on
   */
  return (UInt32)(n << 1) ^ (UInt32)(n >> 31);
}

-(UInt64) i64ToZigZag:(SInt64)n
{
  return (UInt64)(n << 1) ^ (UInt64)(n >> 63);
}

-(BOOL) readMessageBeginReturningName:(NSString **)pname
                                 type:(SInt32 *)ptype
                           sequenceID:(SInt32 *)psequenceID
                                error:(NSError *__autoreleasing *)error
{
  UInt8 protocolId;
  if (![self readByte:&protocolId error:error]) {
    return NO;
  }

  if (protocolId != COMPACT_PROTOCOL_ID) {
    if (error) {
      *error = [NSError errorWithDomain:TProtocolErrorDomain
                                   code:TProtocolErrorUnknown
                               userInfo:@{TProtocolErrorExtendedErrorKey: @(TProtocolExtendedErrorMismatchedProtocol),
                                          TProtocolErrorExpectedIdKey: @(COMPACT_PROTOCOL_ID)}];
    }
    return NO;
  }

  UInt8 versionAndType;
  if (![self readByte:&versionAndType error:error]) {
    return NO;
  }

  UInt8 version = versionAndType & COMPACT_VERSION_MASK;
  if (version != COMPACT_VERSION) {
    if (error) {
      *error = [NSError errorWithDomain:TProtocolErrorDomain
                                   code:TProtocolErrorBadVersion
                               userInfo:@{TProtocolErrorExpectedVersionKey: @(COMPACT_VERSION)}];
    }
    return NO;
  }

  int type = (versionAndType >> COMPACT_TYPE_SHIFT_AMOUNT) & COMPACT_TYPE_BITS;
  UInt32 sequenceID;
  if (![self readVarint32:&sequenceID error:error]) {
    return NO;
  }
  NSString *name;
  if (![self readString:&name error:error]) {
    return NO;
  }

  if (ptype != NULL) {
    *ptype = type;
  }
  if (psequenceID != NULL) {
    *psequenceID = sequenceID;
  }
  if (pname != NULL) {
    *pname = name;
  }
  return YES;
}

-(BOOL) readStructBeginReturningName:(NSString **)pname error:(NSError *__autoreleasing *)error
{
  [_lastField addObject:@(_lastFieldId)];
  _lastFieldId = 0;

  if (pname != NULL) {
    *pname = @"";
  }

  return YES;
}

-(BOOL) readStructEnd:(NSError *__autoreleasing *)error
{
  _lastFieldId = [_lastField.lastObject shortValue];
  [_lastField removeLastObject];
  return YES;
}

-(BOOL) readFieldBeginReturningName:(NSString **)pname
                               type:(SInt32 *)pfieldType
                            fieldID:(SInt32 *)pfieldID
                              error:(NSError *__autoreleasing *)error
{
  UInt8 byte;
  if (![self readByte:&byte error:error]) {
    return NO;
  }

  UInt8 type = byte & 0x0f;

  // if it's a stop, then we can return immediately, as the struct is over.
  if (type == TCType_STOP) {
    if (pname != NULL) {
      *pname = @"";
    }
    if (pfieldType != NULL) {
      *pfieldType = TTypeSTOP;
    }
    if (pfieldID != NULL) {
      *pfieldID = 0;
    }
    return YES;
  }

  short fieldId = 0;

  // mask off the 4 MSB of the type header. it could contain a field id delta.
  short modifier = (byte & 0xf0) >> 4;
  if (modifier == 0) {
    // not a delta. look ahead for the zigzag varint field id.
    if (![self readI16:&fieldId error:error]) {
      return NO;
    }
  }
  else {
    // has a delta. add the delta to the last Read field id.
    fieldId = _lastFieldId + modifier;
  }

  UInt8 fieldType;
  if (![self ttype:&fieldType forCompactType:type error:error]) {
    return NO;
  }

  if (pname != NULL) {
    *pname = @"";
  }
  if (pfieldType != NULL) {
    *pfieldType = fieldType;
  }
  if (pfieldID != NULL) {
    *pfieldID = fieldId;
  }

  // if this happens to be a boolean field, the value is encoded in the type
  if (type == TCType_BOOLEAN_TRUE ||
      type == TCType_BOOLEAN_FALSE)
  {
    // save the boolean value in a special instance variable.
    _booleanValue = [NSNumber numberWithBool:type == TCType_BOOLEAN_TRUE];
  }

  // push the new field onto the field stack so we can keep the deltas going.
  _lastFieldId = fieldId;

  return YES;
}

-(BOOL) readMapBeginReturningKeyType:(SInt32 *)pkeyType
                           valueType:(SInt32 *)pvalueType
                                size:(SInt32 *)psize
                               error:(NSError *__autoreleasing *)error
{
  UInt8 keyAndValueType = 0;
  UInt32 size;
  if (![self readVarint32:&size error:error]) {
    return NO;
  }
  if (size != 0) {
    if (![self readByte:&keyAndValueType error:error]) {
      return NO;
    }
  }

  UInt8 keyType;
  if (![self ttype:&keyType forCompactType:keyAndValueType >> 4 error:error]) {
    return NO;
  }

  UInt8 valueType;
  if (![self ttype:&valueType forCompactType:keyAndValueType & 0xf error:error]) {
    return NO;
  }

  if (pkeyType != NULL) {
    *pkeyType = keyType;
  }
  if (pvalueType != NULL) {
    *pvalueType = valueType;
  }
  if (psize != NULL) {
    *psize = size;
  }

  return YES;
}

-(BOOL) readListBeginReturningElementType:(SInt32 *)pelementType
                                     size:(SInt32 *)psize
                                    error:(NSError *__autoreleasing *)error
{
  UInt8 sizeAndType;
  if (![self readByte:&sizeAndType error:error]) {
    return NO;
  }

  UInt32 size = (sizeAndType >> 4) & 0x0f;
  if (size == 15) {
    if (![self readVarint32:&size error:error]) {
      return NO;
    }
  }

  UInt8 elementType;
  if (![self ttype:&elementType forCompactType:sizeAndType & 0x0f error:error]) {
    return NO;
  }

  if (pelementType != NULL) {
    *pelementType = elementType;
  }
  if (psize != NULL) {
    *psize = size;
  }

  return YES;
}

-(BOOL) readSetBeginReturningElementType:(SInt32 *)pelementType
                                    size:(SInt32 *)psize
                                   error:(NSError *__autoreleasing *)error
{
  return [self readListBeginReturningElementType:pelementType size:psize error:error];
}

-(BOOL) readBool:(BOOL *)value error:(NSError *__autoreleasing *)error
{
  if (_booleanValue != nil) {

    BOOL result = _booleanValue.boolValue;
    _booleanValue = nil;

    *value = result;
  }
  else {

    UInt8 result;
    if (![self readByte:&result error:error]) {
      return NO;
    }

    *value = result == TCType_BOOLEAN_TRUE;
  }

  return YES;
}

-(BOOL) readByte:(UInt8 *)value error:(NSError *__autoreleasing *)error
{
  if (![_transport readAll:value offset:0 length:1 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }
  return YES;
}

-(BOOL) readI16:(SInt16 *)value error:(NSError *__autoreleasing *)error
{
  UInt32 v;
  if (![self readVarint32:&v error:error]) {
    return NO;
  }

  if (value) {
    *value = (SInt16)[self zigZagToi32:v];
  }

  return YES;
}

-(BOOL) readI32:(SInt32 *)value error:(NSError *__autoreleasing *)error
{
  UInt32 v;
  if (![self readVarint32:&v error:error]) {
    return NO;
  }

  if (value) {
    *value = [self zigZagToi32:v];
  }

  return YES;
}

-(BOOL) readI64:(SInt64 *)value error:(NSError *__autoreleasing *)error
{
  UInt64 v;
  if (![self readVarint64:&v error:error]) {
    return NO;
  }

  if (value) {
    *value = [self zigZagToi64:v];
  }

  return YES;
}

-(BOOL) readDouble:(double *)value error:(NSError *__autoreleasing *)error
{
  UInt64 bits;
  if (![_transport readAll:(UInt8 *)&bits offset:0 length:8 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }

  bits = OSSwapLittleToHostInt64(bits);

  if (value) {
    memcpy(value, &bits, sizeof(bits));
  }

  return YES;
}

-(BOOL) readString:(NSString *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  UInt32 length;
  if (![self readVarint32:&length error:error]) {
    return NO;
  }

  NSString *result;

  if (length != 0) {

    NSData *data;
    if (![self readBinaryOfLength:length data:&data error:error]) {
      return NO;
    }

    result = [[NSString alloc] initWithData:data
                                   encoding:NSUTF8StringEncoding];
  }
  else {
    result = @"";
  }

  if (value) {
    *value = result;
  }

  return YES;
}

-(BOOL) readBinary:(NSData *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  UInt32 length;
  if (![self readVarint32:&length error:error]) {
    return NO;
  }

  return [self readBinaryOfLength:length data:value error:error];
}

-(BOOL) readBinaryOfLength:(UInt32)length data:(NSData *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  NSData *result;

  if (length != 0) {

    NSMutableData *buf = [NSMutableData dataWithLength:length];
    if (![_transport readAll:buf.mutableBytes offset:0 length:length error:error]) {
      PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
    }

    result = buf;
  }
  else {

    result = [NSData data];

  }

  if (value) {
    *value = result;
  }

  return YES;
}

-(BOOL) readMessageEnd:(NSError *__autoreleasing *)error
{
  return YES;
}
-(BOOL) readFieldEnd:(NSError *__autoreleasing *)error
{
  return YES;
}
-(BOOL) readMapEnd:(NSError *__autoreleasing *)error
{
  return YES;
}
-(BOOL) readListEnd:(NSError *__autoreleasing *)error
{
  return YES;
}
-(BOOL) readSetEnd:(NSError *__autoreleasing *)error
{
  return YES;
}

-(BOOL) readVarint32:(UInt32 *)value error:(NSError *__autoreleasing *)error
{
  UInt32 result = 0;
  int shift = 0;

  while (true) {

    UInt8 byte;
    if (![self readByte:&byte error:error]) {
      return NO;
    }

    result |= (UInt32)(byte & 0x7f) << shift;
    if (!(byte & 0x80)) {
      break;
    }

    shift += 7;
  }

  if (value) {
    *value = result;
  }

  return YES;
}

-(BOOL) readVarint64:(UInt64 *)value error:(NSError *__autoreleasing *)error
{
  int shift = 0;
  UInt64 result = 0;

  while (true) {

    UInt8 byte;
    if (![self readByte:&byte error:error]) {
      return NO;
    }

    result |= (UInt64)(byte & 0x7f) << shift;
    if (!(byte & 0x80)) {
      break;
    }

    shift += 7;
  }

  if (value) {
    *value = result;
  }

  return YES;
}

-(SInt32) zigZagToi32:(UInt32)n
{
  return (SInt32)(n >> 1) ^ (-(SInt32)(n & 1));
}

-(SInt64) zigZagToi64:(UInt64)n
{
  return (SInt64)(n >> 1) ^ (-(SInt64)(n & 1));
}

-(BOOL) ttype:(UInt8 *)ttype forCompactType:(UInt8)ctype error:(NSError *__autoreleasing *)error
{
  switch (ctype & 0x0f) {
  case TCType_STOP:
    *ttype = TTypeSTOP;
    return YES;

  case TCType_BOOLEAN_FALSE:
  case TCType_BOOLEAN_TRUE:
    *ttype = TTypeBOOL;
    return YES;

  case TCType_BYTE:
    *ttype = TTypeBYTE;
    return YES;

  case TCType_I16:
    *ttype = TTypeI16;
    return YES;

  case TCType_I32:
    *ttype = TTypeI32;
    return YES;

  case TCType_I64:
    *ttype = TTypeI64;
    return YES;

  case TCType_DOUBLE:
    *ttype = TTypeDOUBLE;
    return YES;

  case TCType_BINARY:
    *ttype = TTypeSTRING;
    return YES;

  case TCType_LIST:
    *ttype = TTypeLIST;
    return YES;

  case TCType_SET:
    *ttype = TTypeSET;
    return YES;

  case TCType_MAP:
    *ttype = TTypeMAP;
    return YES;

  case TCType_STRUCT:
    *ttype = TTypeSTRUCT;
    return YES;

  default:
    if (error) {
      *error = [NSError errorWithDomain:TProtocolErrorDomain
                                   code:TProtocolErrorUnknown
                               userInfo:@{TProtocolErrorTypeKey: @((UInt8)(ctype & 0x0F))}];
    }
    return NO;
  }
}

-(UInt8) compactTypeForTType:(UInt8)ttype
{
  static UInt8 ttypeToCompactType[] = {
    [TTypeSTOP] = TCType_STOP,
    [TTypeBOOL] = TCType_BOOLEAN_FALSE,
    [TTypeBYTE] = TCType_BYTE,
    [TTypeDOUBLE] = TCType_DOUBLE,
    [TTypeI16] = TCType_I16,
    [TTypeI32] = TCType_I32,
    [TTypeI64] = TCType_I64,
    [TTypeSTRING] = TCType_BINARY,
    [TTypeSTRUCT] = TCType_STRUCT,
    [TTypeMAP] = TCType_MAP,
    [TTypeSET] = TCType_SET,
    [TTypeLIST] = TCType_LIST
  };

  return ttypeToCompactType[ttype];
}

@end
