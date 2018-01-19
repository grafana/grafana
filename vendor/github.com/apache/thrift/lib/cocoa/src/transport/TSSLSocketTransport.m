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
#import <CoreFoundation/CoreFoundation.h>
#import "TSSLSocketTransport.h"
#import "TSSLSocketTransportError.h"
#include <sys/socket.h>
#include <netinet/in.h>
#include <netdb.h>

#if !TARGET_OS_IPHONE
#import <CoreServices/CoreServices.h>
#else
#import <CFNetwork/CFNetwork.h>
#endif

@interface TSSLSocketTransport ()

@property(strong, nonatomic) NSString *sslHostname;
@property(assign, nonatomic) int sd;

@end


@implementation TSSLSocketTransport

-(id) initWithHostname:(NSString *)hostname
                  port:(int)port
                 error:(NSError **)error
{
  _sslHostname = hostname;
  CFReadStreamRef readStream = NULL;
  CFWriteStreamRef writeStream = NULL;


  /* create a socket structure */
  struct sockaddr_in pin;
  struct hostent *hp = NULL;
  for (int i = 0; i < 10; i++) {



    if ((hp = gethostbyname([hostname UTF8String])) == NULL) {
      NSLog(@"failed to resolve hostname %@", hostname);
      herror("resolv");
      if (i == 9) {
        if (error) {
          *error = [NSError errorWithDomain:TSSLSocketTransportErrorDomain
                                       code:TSSLSocketTransportErrorHostanameResolution
                                   userInfo:nil];
        }
        return nil;
      }
      [NSThread sleepForTimeInterval:0.2];
    }
    else {
      break;
    }
  }

  memset(&pin, 0, sizeof(pin));
  pin.sin_family = AF_INET;
  memcpy(&pin.sin_addr, hp->h_addr, sizeof(struct in_addr));
  pin.sin_port = htons(port);

  /* create the socket */
  if ((_sd = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) == -1) {
    NSLog(@"failed to create socket for host %@:%d", hostname, port);
    if (error) {
      *error = [NSError errorWithDomain:TSSLSocketTransportErrorDomain
                                   code:TSSLSocketTransportErrorSocketCreate
                               userInfo:nil];
    }
    return nil;
  }

  /* open a connection */
  if (connect(_sd, (struct sockaddr *)&pin, sizeof(pin)) == -1) {
    NSLog(@"failed to create conenct to host %@:%d", hostname, port);
    if (error) {
      *error = [NSError errorWithDomain:TSSLSocketTransportErrorDomain
                                   code:TSSLSocketTransportErrorConnect
                               userInfo:nil];
    }
    return nil;
  }
  CFStreamCreatePairWithSocket(kCFAllocatorDefault, _sd, &readStream, &writeStream);

  CFReadStreamSetProperty(readStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);
  CFWriteStreamSetProperty(writeStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);

  NSInputStream *inputStream;
  NSOutputStream *outputStream;

  if (readStream && writeStream) {

    CFReadStreamSetProperty(readStream,
                            kCFStreamPropertySocketSecurityLevel,
                            kCFStreamSocketSecurityLevelTLSv1);

    NSDictionary *settings = @{(__bridge NSString *)kCFStreamSSLValidatesCertificateChain: @YES};

    CFReadStreamSetProperty((CFReadStreamRef)readStream,
                            kCFStreamPropertySSLSettings,
                            (CFTypeRef)settings);

    CFWriteStreamSetProperty((CFWriteStreamRef)writeStream,
                             kCFStreamPropertySSLSettings,
                             (CFTypeRef)settings);

    inputStream = (__bridge NSInputStream *)readStream;
    [inputStream setDelegate:self];
    [inputStream scheduleInRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
    [inputStream open];

    outputStream = (__bridge NSOutputStream *)writeStream;
    [outputStream setDelegate:self];
    [outputStream scheduleInRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
    [outputStream open];

    CFRelease(readStream);
    CFRelease(writeStream);
  }

  self = [super initWithInputStream:inputStream outputStream:outputStream];

  return self;
}

-(void) dealloc
{
  [self close];
}

#pragma mark -
#pragma mark NSStreamDelegate

-(void) stream:(NSStream *)aStream
   handleEvent:(NSStreamEvent)eventCode
{
  switch (eventCode) {
  case NSStreamEventNone:
    break;

  case NSStreamEventHasBytesAvailable:
    break;

  case NSStreamEventOpenCompleted:
    break;

  case NSStreamEventHasSpaceAvailable: {

    BOOL proceed = NO;
    SecTrustResultType trustResult = kSecTrustResultInvalid;
    CFMutableArrayRef newPolicies = NULL;

    do {

      SecTrustRef trust = (__bridge SecTrustRef)[aStream propertyForKey:(NSString *)kCFStreamPropertySSLPeerTrust];

      // Add new policy to current list of policies
      SecPolicyRef policy = SecPolicyCreateSSL(NO, (__bridge CFStringRef)(_sslHostname));
      if (!policy) {
        break;
      }

      CFArrayRef policies;
      if (SecTrustCopyPolicies(trust, &policies) != errSecSuccess) {
        CFRelease(policy);
        break;
      }

      newPolicies = CFArrayCreateMutableCopy(NULL, 0, policies);
      CFArrayAppendValue(newPolicies, policy);

      CFRelease(policies);
      CFRelease(policy);

      // Update trust policies
      if (SecTrustSetPolicies(trust, newPolicies) != errSecSuccess) {
        break;
      }

      // Evaluate the trust chain
      if (SecTrustEvaluate(trust, &trustResult) != errSecSuccess) {
        break;
      }

      switch (trustResult) {
      case kSecTrustResultProceed:
        // NSLog(@"Trusted by USER");
        proceed = YES;
        break;

      case kSecTrustResultUnspecified:
        // NSLog(@"Trusted by OS");
        proceed = YES;
        break;

      case kSecTrustResultRecoverableTrustFailure:
        proceed = recoverFromTrustFailure(trust, trustResult);
        break;

      case kSecTrustResultDeny:
        // NSLog(@"Deny");
        break;

      case kSecTrustResultFatalTrustFailure:
        // NSLog(@"FatalTrustFailure");
        break;

      case kSecTrustResultOtherError:
        // NSLog(@"OtherError");
        break;

      case kSecTrustResultInvalid:
        // NSLog(@"Invalid");
        break;

      default:
        // NSLog(@"Default");
        break;
      }

    }
    while (NO);

    if (!proceed) {
      NSLog(@"TSSLSocketTransport: Cannot trust certificate. Result: %u", trustResult);
      [aStream close];
    }

    if (newPolicies) {
      CFRelease(newPolicies);
    }

  }
  break;

  case NSStreamEventErrorOccurred: {
    NSLog(@"TSSLSocketTransport: Error occurred opening stream: %@", [aStream streamError]);
    break;
  }

  case NSStreamEventEndEncountered:
    break;
  }
}

BOOL recoverFromTrustFailure(SecTrustRef myTrust, SecTrustResultType lastTrustResult)
{
  CFAbsoluteTime trustTime = SecTrustGetVerifyTime(myTrust);
  CFAbsoluteTime currentTime = CFAbsoluteTimeGetCurrent();

  CFAbsoluteTime timeIncrement = 31536000;
  CFAbsoluteTime newTime = currentTime - timeIncrement;

  if (trustTime - newTime) {

    CFDateRef newDate = CFDateCreate(NULL, newTime);
    SecTrustSetVerifyDate(myTrust, newDate);
    CFRelease(newDate);

    if (SecTrustEvaluate(myTrust, &lastTrustResult) != errSecSuccess) {
      return NO;
    }

  }

  if (lastTrustResult == kSecTrustResultProceed || lastTrustResult == kSecTrustResultUnspecified) {
    return YES;
  }

  NSLog(@"TSSLSocketTransport: Unable to recover certificate trust failure");
  return YES;
}

-(BOOL) isOpen
{
  if (_sd > 0) {
    return TRUE;
  }
  else {
    return FALSE;
  }
}

@end
