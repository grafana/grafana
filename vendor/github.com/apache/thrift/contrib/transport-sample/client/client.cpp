// client->cpp : Defines the entry point for the console application.
//
// sample client command line app using Thrift IPC.
// Quick n Dirty example, may not have very robust error handling
// for the sake of simplicity.

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

void ClientListenerThreadProc();
bool bSocket = false;
bool bAnonPipe = false;
int srvPort;
std::string pipename;
std::string pipename_client;
#ifdef _WIN32
 HANDLE hConsole;
#endif

//Customized version of printf that changes the text color
//This depends on hConsole global being initialized
void hlprintf(const char* _Format, ...)
{
#ifdef _WIN32
	SetConsoleTextAttribute(hConsole, 0xE);
#endif
	va_list ap;
	int r;
	va_start (ap, _Format);
	r = vprintf (_Format, ap);
	va_end (ap);
#ifdef _WIN32
	SetConsoleTextAttribute(hConsole, 7);
#endif
}

//-----------------------------------------------------------------------------
// Client-side RPC implementations: Called by the server to the client for 
// bidirectional eventing.
//
class SampleCallbackHandler : virtual public SampleCallbackIf {
 public:
  SampleCallbackHandler() {
    // initialization goes here
  }

  void pingclient()
  {
    hlprintf("<<<Ping received from server (server-to-client event).\n");
  }

};
//-----------------------------------------------------------------------------


#ifdef _WIN32
int _tmain(int argc, _TCHAR* argv[])
#else
int main(int argc, char **argv)
#endif
{
	//Process cmd line args to determine named vs anon pipes.
	bool usage = false;
#ifdef _WIN32
	HANDLE ReadPipe, WritePipe;
	hConsole = GetStdHandle(STD_OUTPUT_HANDLE);
#endif

	//Process command line params
	if(argc > 1)
	{
		if(_tcscmp(argv[1], TEXT("-sp")) == 0)
		{	//Socket Port specified
			srvPort = _tstoi(argv[2]);
			bSocket = true;
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
			pipename_client = pipename + "_client";
		}
		else if(argc == 3)
		{	//Anonymous Pipe specified
#ifdef _WIN32
			ReadPipe  = (HANDLE)_tstoi(argv[1]);
			WritePipe = (HANDLE)_tstoi(argv[2]);
			bAnonPipe = true;
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
		hlprintf("Thrift sample client usage:\n\n");
		hlprintf("Socket Port to connect to: -sp <port#>\n");
		hlprintf("Named Pipe to connect to:  -np <pipename> (e.g. affpipe)\n");
		hlprintf("Anonymous Pipe (must be launched by anon pipe creator):\n");
		hlprintf("                           <Read Handle> <Write Handle>\n");
		return 0;
	}

	//Client side connection to server.
	boost::shared_ptr<SampleServiceClient> client; //Client class from Thrift-generated code.
	boost::shared_ptr<TTransport> transport;

	if(bSocket)
	{	//Socket transport
#ifdef _WIN32
		TWinsockSingleton::create();
#endif
		hlprintf("Using socket transport port %d\n", srvPort);
		thriftcommon::ConnectToServer<SampleServiceClient, TTransport>(client, transport, srvPort);
	}
	else if(!bAnonPipe)
	{
		hlprintf("Using Named Pipe %s\n", pipename.c_str());
		thriftcommon::ConnectToServer<SampleServiceClient, TTransport>(client, transport, pipename);
	}
	else
	{
#ifdef _WIN32
		hlprintf("Using Anonymous Pipe transport\n");
		thriftcommon::ConnectToServer<SampleServiceClient, TTransport>(client, transport, ReadPipe, WritePipe);
#endif
	}

#ifdef _WIN32
	//Start a thread to receive inbound connection from server for 2-way event signaling.
	boost::thread ClientListenerThread(ClientListenerThreadProc);
#endif

	try {
		transport->open();

		//Notify server what to connect back on.
		if(bSocket)
			client->ClientSideListenPort(srvPort + 1); //Socket
		else if(!bAnonPipe)
			client->ClientSidePipeName(pipename_client); //Named Pipe

		//Run some more RPCs
		std::string hellostr = "Hello how are you?";
		std::string returnstr;
		client->HelloThere(returnstr, hellostr);
		hlprintf("\n>>>Sent: %s\n", hellostr.c_str());
		hlprintf("<<<Received: %s\n", returnstr.c_str());

		hlprintf("\n>>>Calling ServerDoSomething() which delays for 5 seconds.\n");
		client->ServerDoSomething();
		hlprintf(">>>ServerDoSomething() done.\n\n");

		transport->close();
	} catch (TException &tx) {
		hlprintf("ERROR: %s\n", tx.what());
	}

	return 0;
}


//Thread Routine
void ClientListenerThreadProc()
{
	if(bSocket)
		thriftcommon::RunThriftServer<SampleCallbackHandler, SampleCallbackProcessor>(1, srvPort + 1);
	else if(!bAnonPipe)
		thriftcommon::RunThriftServer<SampleCallbackHandler, SampleCallbackProcessor>(1, pipename_client);
}
