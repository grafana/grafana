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
#import "TProtocolFactory.h"
#import "TProcessorFactory.h"

#if !TARGET_OS_IPHONE
#import <CoreServices/CoreServices.h>
#else
#import <CFNetwork/CFNetwork.h>
#endif

NS_ASSUME_NONNULL_BEGIN


extern NSString *const TSocketServerClientConnectionFinished;
extern NSString *const TSocketServerProcessorKey;
extern NSString *const TSockerServerTransportKey;


@interface TSocketServer : NSObject

-(instancetype) initWithPort:(int)port
             protocolFactory:(id <TProtocolFactory>)protocolFactory
            processorFactory:(id <TProcessorFactory>)processorFactory;

@end


NS_ASSUME_NONNULL_END
