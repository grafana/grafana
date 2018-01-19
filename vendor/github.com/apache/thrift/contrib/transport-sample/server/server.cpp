// server.cpp : Defines the entry point for the console application.
//
// sample server command line app using Thrift IPC.
//
// This is a simple demonstration of full duplex RPC. That is, each
// side runs both a client and server to enable bidirectional event 
// signaling.
//

#ifdef _WIN32
#  include "stdafx.h"
#else
#  include "config.h"
#endif

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//Include this before the generated includes
#include "ThriftCommon.h"
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//Tailor these to your generated files
#include "../gen-cpp/SampleService.h"
#include "../gen-cpp/SampleCallback.h"

using namespace Sample; //declared in .thrift file
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

int16_t ClientPort_;
std::string ClientPipeName_;
void S2CThreadProc();

//-----------------------------------------------------------------------------
// RPC implementations
//
class SampleServiceHandler : virtual public SampleServiceIf {
 public:
  SampleServiceHandler() {
    // Your initialization goes here
  }

  void HelloThere(std::string& _return, const std::string& HelloString) {
    // Your implementation goes here
    printf("<<<HelloThere() received string: %s\n", HelloString.c_str());
	_return = "Good thank you.";
  }

  void ServerDoSomething() {
    // Your implementation goes here
    printf("ServerDoSomething(): Simulating work for 5 seconds\n");
    Sleep(5000);
    printf("ServerDoSomething(): Done\n");
  }

  void ClientSideListenPort(const int16_t ClientListenPort)
  {
	ClientPort_ = ClientListenPort;
	ClientPipeName_ = "";
#ifdef _WIN32
	printf(">>>Connecting to client on port %d\n", ClientPort_);
	boost::thread Connect2ClientThread(S2CThreadProc);
#endif
  }

  void ClientSidePipeName(const std::string& ClientPipeName)
  {
	ClientPipeName_ = ClientPipeName;
	ClientPort_ = 0;
#ifdef _WIN32
	printf(">>>Connecting to client pipe %s\n", ClientPipeName_.c_str());
	boost::thread Connect2ClientThread(S2CThreadProc);
#endif
  }
};
//-----------------------------------------------------------------------------

#ifdef _WIN32
int _tmain(int argc, _TCHAR* argv[])
#else
int main(int argc, char **argv)
#endif
{
	int port;
	std::string pipename; //e.g. "affpipe"

	bool usage = false;

	//Process command line params
	if(argc > 1)
	{
		if(_tcscmp(argv[1], TEXT("-sp")) == 0)
		{	//Socket Port specified
			port = _tstoi(argv[2]);
#ifdef _WIN32
			TWinsockSingleton::create();
#endif
			// Start the thrift server which is a blocking call.
			thriftcommon::RunThriftServer<SampleServiceHandler, SampleServiceProcessor>(10, port);
		}
		else if(_tcscmp(argv[1], TEXT("-np")) == 0)
		{	//Named Pipe specified
#ifdef _WIN32
			std::wstring wpipe(argv[2]);
			pipename.resize(wpipe.length());
			std::copy(wpipe.begin(), wpipe.end(), pipename.begin());
#else
			pipename = argv[2];
#endif
			printf("Using Named Pipe %s\n", pipename.c_str());

			//Thrift over Named Pipe.
			thriftcommon::RunThriftServer<SampleServiceHandler, SampleServiceProcessor>(10, pipename);
		}
		else if(_tcscmp(argv[1], TEXT("-ap")) == 0)
		{	//Anonymous Pipe specified
			//This is more involved because the child needs to be launched 
			//after the transport is created but before the blocking server 
			//call.
#ifdef _WIN32
			boost::shared_ptr<TServerTransport> transport(new TPipeServer()); //Anonymous pipe
			thriftcommon::LaunchAnonPipeChild(".\\client.exe", transport);
			boost::shared_ptr<SampleServiceHandler> handler(new SampleServiceHandler());
			thriftcommon::RunThriftServer<SampleServiceHandler, SampleServiceProcessor>(handler, 10, transport);
#else
			printf("Anonymous pipes not (yet) supported under *NIX\n");
#endif
		}
		else
			usage = true;
	}
	else
		usage = true;

	if(usage)
	{
		printf("Thrift sample server usage:\n\n");
		printf("Socket Port :   -sp <port#>\n");
		printf("Named Pipe :    -np <pipename> (e.g. affpipe)\n");
		printf("Anonymous Pipe: -ap\n");
	}
	return 0;
}


//Thread Routine that connects to the 'client'.
void S2CThreadProc()
{
	//Master server's connection to client-side's server.
	boost::shared_ptr<SampleCallbackClient> clientsrv; //Client class from Thrift-generated code.
	boost::shared_ptr<TTransport> transport;
	if(ClientPort_ != 0)
		thriftcommon::ConnectToServer<SampleCallbackClient, TTransport>(clientsrv, transport, ClientPort_);
	if(!ClientPipeName_.empty())
		thriftcommon::ConnectToServer<SampleCallbackClient, TTransport>(clientsrv, transport, ClientPipeName_);

	try {
		transport->open();

		clientsrv->pingclient();
		Sleep(1500);
		clientsrv->pingclient();
		Sleep(1500);
		clientsrv->pingclient();

		transport->close();
	} catch (TException &tx) {
		printf("ERROR: %s\n", tx.what());
	}
}

