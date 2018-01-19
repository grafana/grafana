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

#import <Foundation/Foundation.h>


NS_ASSUME_NONNULL_BEGIN


@protocol TTransport <NSObject>

/**
 * Guarantees that all of len bytes are read
 *
 * @param buf Buffer to read into
 * @param off Index in buffer to start storing bytes at
 * @param len Maximum number of bytes to read
 * @return YES if succeeded, NO if failed
 * @throws TTransportError if there was an error reading data
 */
-(BOOL) readAll:(UInt8 *)buf offset:(UInt32)off length:(UInt32)len error:(NSError *__autoreleasing *)error;

-(UInt32) readAvail:(UInt8 *)buf offset:(UInt32)off maxLength:(UInt32)maxLen error:(NSError *__autoreleasing *)error;

-(BOOL) write:(const UInt8 *)data offset:(UInt32)offset length:(UInt32)length error:(NSError *__autoreleasing *)error;

-(BOOL) flush:(NSError *__autoreleasing *)error;

@end


NS_ASSUME_NONNULL_END
