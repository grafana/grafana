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

#import "TMultiplexedProtocol.h"

#import "TProtocol.h"

NSString *TMultiplexedProtocolSeperator = @":";


@interface TMultiplexedProtocol ()

@property(strong, nonatomic) NSString *serviceName;

@end


@implementation TMultiplexedProtocol

-(id) initWithProtocol:(id <TProtocol>)protocol
           serviceName:(NSString *)name
{
  self = [super initWithProtocol:protocol];
  if (self) {
    _serviceName = name;
  }
  return self;
}

-(BOOL) writeMessageBeginWithName:(NSString *)name
                             type:(SInt32)messageType
                       sequenceID:(SInt32)sequenceID
                            error:(NSError *__autoreleasing *)error
{
  switch (messageType) {
  case TMessageTypeCALL:
  case TMessageTypeONEWAY: {
    NSMutableString *serviceFunction = [[NSMutableString alloc] initWithString:_serviceName];
    [serviceFunction appendString:TMultiplexedProtocolSeperator];
    [serviceFunction appendString:name];
    return [super writeMessageBeginWithName:serviceFunction type:messageType sequenceID:sequenceID error:error];
  }
  break;

  default:
    return [super writeMessageBeginWithName:name type:messageType sequenceID:sequenceID error:error];
  }
}

@end
