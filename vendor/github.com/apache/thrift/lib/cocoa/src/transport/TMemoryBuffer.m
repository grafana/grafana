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

#import "TMemoryBuffer.h"
#import "TTransportError.h"


#define GARBAGE_BUFFER_SIZE 4096 // 4KiB


@interface TMemoryBuffer ()

@property(strong, nonatomic) NSMutableData *buffer;
@property(assign, nonatomic) UInt32 bufferOffset;

@end


@implementation TMemoryBuffer

-(id) init
{
  if ((self = [super init])) {
    _buffer = [NSMutableData new];
    _bufferOffset = 0;
  }
  return self;
}

-(id) initWithData:(NSData *)data
{
  if (self = [super init]) {
    _buffer = [data mutableCopy];
    _bufferOffset = 0;
  }
  return self;
}

-(id) initWithDataNoCopy:(NSMutableData *)data
{
  if (self = [super init]) {
    _buffer = data;
    _bufferOffset = 0;
  }
  return self;
}

-(BOOL) readAll:(UInt8 *)outBuffer offset:(UInt32)outBufferOffset length:(UInt32)length error:(NSError *__autoreleasing *)error
{
  UInt32 got = [self readAvail:outBuffer offset:outBufferOffset maxLength:length error:error];
  if (got != length) {

    // Report underflow only if readAvail didn't report error already
    if (error && !*error) {
      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorEndOfFile
                               userInfo:nil];
    }

    return NO;
  }

  return YES;
}

-(UInt32) readAvail:(UInt8 *)outBuffer offset:(UInt32)outBufferOffset maxLength:(UInt32)maxLength error:(NSError *__autoreleasing *)error
{
  UInt32 avail = (UInt32)_buffer.length - _bufferOffset;
  if (avail == 0) {
    return 0;
  }

  NSRange range;
  range.location = _bufferOffset;
  range.length = MIN(maxLength, avail);

  [_buffer getBytes:outBuffer + outBufferOffset range:range];
  _bufferOffset += range.length;

  if (_bufferOffset >= GARBAGE_BUFFER_SIZE) {
    [_buffer replaceBytesInRange:NSMakeRange(0, _bufferOffset) withBytes:NULL length:0];
    _bufferOffset = 0;
  }

  return (UInt32)range.length;
}

-(BOOL) write:(const UInt8 *)inBuffer offset:(UInt32)inBufferOffset length:(UInt32)length error:(NSError *__autoreleasing *)error
{
  [_buffer appendBytes:inBuffer + inBufferOffset length:length];

  return YES;
}

-(NSData *) buffer
{
  return _buffer;
}

-(BOOL) flush:(NSError *__autoreleasing *)error
{
  return YES;
}

@end
