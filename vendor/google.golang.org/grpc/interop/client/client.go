/*
 *
 * Copyright 2014 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package main

import (
	"flag"
	"net"
	"strconv"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/oauth"
	"google.golang.org/grpc/grpclog"
	"google.golang.org/grpc/interop"
	testpb "google.golang.org/grpc/interop/grpc_testing"
	"google.golang.org/grpc/testdata"
)

var (
	caFile                = flag.String("ca_file", "", "The file containning the CA root cert file")
	useTLS                = flag.Bool("use_tls", false, "Connection uses TLS if true, else plain TCP")
	testCA                = flag.Bool("use_test_ca", false, "Whether to replace platform root CAs with test CA as the CA root")
	serviceAccountKeyFile = flag.String("service_account_key_file", "", "Path to service account json key file")
	oauthScope            = flag.String("oauth_scope", "", "The scope for OAuth2 tokens")
	defaultServiceAccount = flag.String("default_service_account", "", "Email of GCE default service account")
	serverHost            = flag.String("server_host", "localhost", "The server host name")
	serverPort            = flag.Int("server_port", 10000, "The server port number")
	tlsServerName         = flag.String("server_host_override", "", "The server name use to verify the hostname returned by TLS handshake if it is not empty. Otherwise, --server_host is used.")
	testCase              = flag.String("test_case", "large_unary",
		`Configure different test cases. Valid options are:
        empty_unary : empty (zero bytes) request and response;
        large_unary : single request and (large) response;
        client_streaming : request streaming with single response;
        server_streaming : single request with response streaming;
        ping_pong : full-duplex streaming;
        empty_stream : full-duplex streaming with zero message;
        timeout_on_sleeping_server: fullduplex streaming on a sleeping server;
        compute_engine_creds: large_unary with compute engine auth;
        service_account_creds: large_unary with service account auth;
        jwt_token_creds: large_unary with jwt token auth;
        per_rpc_creds: large_unary with per rpc token;
        oauth2_auth_token: large_unary with oauth2 token auth;
        cancel_after_begin: cancellation after metadata has been sent but before payloads are sent;
        cancel_after_first_response: cancellation after receiving 1st message from the server;
        status_code_and_message: status code propagated back to client;
        custom_metadata: server will echo custom metadata;
        unimplemented_method: client attempts to call unimplemented method;
        unimplemented_service: client attempts to call unimplemented service.`)
)

func main() {
	flag.Parse()
	serverAddr := net.JoinHostPort(*serverHost, strconv.Itoa(*serverPort))
	var opts []grpc.DialOption
	if *useTLS {
		var sn string
		if *tlsServerName != "" {
			sn = *tlsServerName
		}
		var creds credentials.TransportCredentials
		if *testCA {
			var err error
			if *caFile == "" {
				*caFile = testdata.Path("ca.pem")
			}
			creds, err = credentials.NewClientTLSFromFile(*caFile, sn)
			if err != nil {
				grpclog.Fatalf("Failed to create TLS credentials %v", err)
			}
		} else {
			creds = credentials.NewClientTLSFromCert(nil, sn)
		}
		opts = append(opts, grpc.WithTransportCredentials(creds))
		if *testCase == "compute_engine_creds" {
			opts = append(opts, grpc.WithPerRPCCredentials(oauth.NewComputeEngine()))
		} else if *testCase == "service_account_creds" {
			jwtCreds, err := oauth.NewServiceAccountFromFile(*serviceAccountKeyFile, *oauthScope)
			if err != nil {
				grpclog.Fatalf("Failed to create JWT credentials: %v", err)
			}
			opts = append(opts, grpc.WithPerRPCCredentials(jwtCreds))
		} else if *testCase == "jwt_token_creds" {
			jwtCreds, err := oauth.NewJWTAccessFromFile(*serviceAccountKeyFile)
			if err != nil {
				grpclog.Fatalf("Failed to create JWT credentials: %v", err)
			}
			opts = append(opts, grpc.WithPerRPCCredentials(jwtCreds))
		} else if *testCase == "oauth2_auth_token" {
			opts = append(opts, grpc.WithPerRPCCredentials(oauth.NewOauthAccess(interop.GetToken(*serviceAccountKeyFile, *oauthScope))))
		}
	} else {
		opts = append(opts, grpc.WithInsecure())
	}
	opts = append(opts, grpc.WithBlock())
	conn, err := grpc.Dial(serverAddr, opts...)
	if err != nil {
		grpclog.Fatalf("Fail to dial: %v", err)
	}
	defer conn.Close()
	tc := testpb.NewTestServiceClient(conn)
	switch *testCase {
	case "empty_unary":
		interop.DoEmptyUnaryCall(tc)
		grpclog.Println("EmptyUnaryCall done")
	case "large_unary":
		interop.DoLargeUnaryCall(tc)
		grpclog.Println("LargeUnaryCall done")
	case "client_streaming":
		interop.DoClientStreaming(tc)
		grpclog.Println("ClientStreaming done")
	case "server_streaming":
		interop.DoServerStreaming(tc)
		grpclog.Println("ServerStreaming done")
	case "ping_pong":
		interop.DoPingPong(tc)
		grpclog.Println("Pingpong done")
	case "empty_stream":
		interop.DoEmptyStream(tc)
		grpclog.Println("Emptystream done")
	case "timeout_on_sleeping_server":
		interop.DoTimeoutOnSleepingServer(tc)
		grpclog.Println("TimeoutOnSleepingServer done")
	case "compute_engine_creds":
		if !*useTLS {
			grpclog.Fatalf("TLS is not enabled. TLS is required to execute compute_engine_creds test case.")
		}
		interop.DoComputeEngineCreds(tc, *defaultServiceAccount, *oauthScope)
		grpclog.Println("ComputeEngineCreds done")
	case "service_account_creds":
		if !*useTLS {
			grpclog.Fatalf("TLS is not enabled. TLS is required to execute service_account_creds test case.")
		}
		interop.DoServiceAccountCreds(tc, *serviceAccountKeyFile, *oauthScope)
		grpclog.Println("ServiceAccountCreds done")
	case "jwt_token_creds":
		if !*useTLS {
			grpclog.Fatalf("TLS is not enabled. TLS is required to execute jwt_token_creds test case.")
		}
		interop.DoJWTTokenCreds(tc, *serviceAccountKeyFile)
		grpclog.Println("JWTtokenCreds done")
	case "per_rpc_creds":
		if !*useTLS {
			grpclog.Fatalf("TLS is not enabled. TLS is required to execute per_rpc_creds test case.")
		}
		interop.DoPerRPCCreds(tc, *serviceAccountKeyFile, *oauthScope)
		grpclog.Println("PerRPCCreds done")
	case "oauth2_auth_token":
		if !*useTLS {
			grpclog.Fatalf("TLS is not enabled. TLS is required to execute oauth2_auth_token test case.")
		}
		interop.DoOauth2TokenCreds(tc, *serviceAccountKeyFile, *oauthScope)
		grpclog.Println("Oauth2TokenCreds done")
	case "cancel_after_begin":
		interop.DoCancelAfterBegin(tc)
		grpclog.Println("CancelAfterBegin done")
	case "cancel_after_first_response":
		interop.DoCancelAfterFirstResponse(tc)
		grpclog.Println("CancelAfterFirstResponse done")
	case "status_code_and_message":
		interop.DoStatusCodeAndMessage(tc)
		grpclog.Println("StatusCodeAndMessage done")
	case "custom_metadata":
		interop.DoCustomMetadata(tc)
		grpclog.Println("CustomMetadata done")
	case "unimplemented_method":
		interop.DoUnimplementedMethod(conn)
		grpclog.Println("UnimplementedMethod done")
	case "unimplemented_service":
		interop.DoUnimplementedService(testpb.NewUnimplementedServiceClient(conn))
		grpclog.Println("UnimplementedService done")
	default:
		grpclog.Fatal("Unsupported test case: ", *testCase)
	}
}
