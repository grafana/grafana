#define BOOST_TEST_MODULE TQTcpServerTest
#include <QTest>
#include <iostream>

#include <QTcpServer>
#include <QTcpSocket>
#include <QHostAddress>
#include <QThread>

#ifndef Q_MOC_RUN
  #include <boost/smart_ptr.hpp>
  #include "thrift/protocol/TBinaryProtocol.h"
  #include "thrift/async/TAsyncProcessor.h"
  #include "thrift/qt/TQTcpServer.h"
  #include "thrift/qt/TQIODeviceTransport.h"
  
  #include "gen-cpp/ParentService.h"
#endif

using namespace apache::thrift;

struct AsyncHandler : public test::ParentServiceCobSvIf {
  std::vector<std::string> strings;
  virtual void addString(tcxx::function<void()> cob, const std::string& s) {
    strings.push_back(s);
    cob();
  }
  virtual void getStrings(tcxx::function<void(std::vector<std::string> const& _return)> cob) {
    cob(strings);
  }

  // Overrides not used in this test
  virtual void incrementGeneration(tcxx::function<void(int32_t const& _return)> cob) {}
  virtual void getGeneration(tcxx::function<void(int32_t const& _return)> cob) {}
  virtual void getDataWait(tcxx::function<void(std::string const& _return)> cob,
                           const int32_t length) {}
  virtual void onewayWait(tcxx::function<void()> cob) {}
  virtual void exceptionWait(
      tcxx::function<void()> cob,
      tcxx::function<void(::apache::thrift::TDelayedException* _throw)> /* exn_cob */,
      const std::string& message) {}
  virtual void unexpectedExceptionWait(tcxx::function<void()> cob, const std::string& message) {}
};

class TQTcpServerTest : public QObject {
  Q_OBJECT

private slots:
  void initTestCase();
  void cleanupTestCase();
  void test_communicate();

private:
  boost::shared_ptr<QThread> serverThread;
  boost::shared_ptr<async::TQTcpServer> server;
  boost::shared_ptr<test::ParentServiceClient> client;
};

void TQTcpServerTest::initTestCase() {
  // setup server
  boost::shared_ptr<QTcpServer> serverSocket = boost::make_shared<QTcpServer>();
  server.reset(new async::TQTcpServer(serverSocket,
                                      boost::make_shared<test::ParentServiceAsyncProcessor>(
                                          boost::make_shared<AsyncHandler>()),
                                      boost::make_shared<protocol::TBinaryProtocolFactory>()));
  QVERIFY(serverSocket->listen(QHostAddress::LocalHost));
  int port = serverSocket->serverPort();
  QVERIFY(port > 0);

  //setup server thread and move server to it
  serverThread.reset(new QThread());
  serverSocket->moveToThread(serverThread.get());
  server->moveToThread(serverThread.get());
  serverThread->start();

  // setup client
  boost::shared_ptr<QTcpSocket> socket = boost::make_shared<QTcpSocket>();
  client.reset(new test::ParentServiceClient(boost::make_shared<protocol::TBinaryProtocol>(
      boost::make_shared<transport::TQIODeviceTransport>(socket))));
  socket->connectToHost(QHostAddress::LocalHost, port);
  QVERIFY(socket->waitForConnected());
}

void TQTcpServerTest::cleanupTestCase() {
  //first, stop the thread which holds the server
  serverThread->quit();
  serverThread->wait();
  // now, it is safe to delete the server
  server.reset();
  // delete thread now
  serverThread.reset();

  // cleanup client
  client.reset();
}

void TQTcpServerTest::test_communicate() {
  client->addString("foo");
  client->addString("bar");

  std::vector<std::string> reply;
  client->getStrings(reply);
  QCOMPARE(QString::fromStdString(reply[0]), QString("foo"));
  QCOMPARE(QString::fromStdString(reply[1]), QString("bar"));
}


#if (QT_VERSION >= QT_VERSION_CHECK(5, 0, 0))
QTEST_GUILESS_MAIN(TQTcpServerTest);
#else
#undef QT_GUI_LIB
QTEST_MAIN(TQTcpServerTest);
#endif
#include "TQTcpServerTest.moc"
