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

#import "TBaseClient.h"
#import "TApplicationError.h"


@interface TBaseClient ()
@end


@implementation TBaseClient

-(NSError *) checkIncomingMessageException:(id<TProtocol>)inProtocol
{
  NSError *thriftError;

  SInt32 msgType = 0;
  if (![inProtocol readMessageBeginReturningName:nil type:&msgType sequenceID:NULL error:&thriftError]) {
    return thriftError;
  }

  if (msgType == TMessageTypeEXCEPTION) {

    thriftError = [NSError read:inProtocol];

    [inProtocol readMessageEnd:NULL];

    return thriftError;
  }

  return nil;
}

@end
