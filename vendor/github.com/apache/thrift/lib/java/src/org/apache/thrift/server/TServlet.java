package org.apache.thrift.server;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.thrift.TException;
import org.apache.thrift.TProcessor;
import org.apache.thrift.protocol.TProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.transport.TIOStreamTransport;
import org.apache.thrift.transport.TTransport;

/**
 * Servlet implementation class ThriftServer
 */
public class TServlet extends HttpServlet {

  private final TProcessor processor;

  private final TProtocolFactory inProtocolFactory;

  private final TProtocolFactory outProtocolFactory;

  private final Collection<Map.Entry<String, String>> customHeaders;

  /**
   * @see HttpServlet#HttpServlet()
   */
  public TServlet(TProcessor processor, TProtocolFactory inProtocolFactory,
      TProtocolFactory outProtocolFactory) {
    super();
    this.processor = processor;
    this.inProtocolFactory = inProtocolFactory;
    this.outProtocolFactory = outProtocolFactory;
    this.customHeaders = new ArrayList<Map.Entry<String, String>>();
  }

  /**
   * @see HttpServlet#HttpServlet()
   */
  public TServlet(TProcessor processor, TProtocolFactory protocolFactory) {
    this(processor, protocolFactory, protocolFactory);
  }

  /**
   * @see HttpServlet#doPost(HttpServletRequest request, HttpServletResponse
   *      response)
   */
  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {

    TTransport inTransport = null;
    TTransport outTransport = null;

    try {
      response.setContentType("application/x-thrift");

      if (null != this.customHeaders) {
        for (Map.Entry<String, String> header : this.customHeaders) {
          response.addHeader(header.getKey(), header.getValue());
        }
      }
      InputStream in = request.getInputStream();
      OutputStream out = response.getOutputStream();

      TTransport transport = new TIOStreamTransport(in, out);
      inTransport = transport;
      outTransport = transport;

      TProtocol inProtocol = inProtocolFactory.getProtocol(inTransport);
      TProtocol outProtocol = outProtocolFactory.getProtocol(outTransport);

      processor.process(inProtocol, outProtocol);
      out.flush();
    } catch (TException te) {
      throw new ServletException(te);
    }
  }

  /**
   * @see HttpServlet#doGet(HttpServletRequest request, HttpServletResponse
   *      response)
   */
  protected void doGet(HttpServletRequest request, HttpServletResponse response)
      throws ServletException, IOException {
    doPost(request, response);
  }

  public void addCustomHeader(final String key, final String value) {
    this.customHeaders.add(new Map.Entry<String, String>() {
      public String getKey() {
        return key;
      }

      public String getValue() {
        return value;
      }

      public String setValue(String value) {
        return null;
      }
    });
  }

  public void setCustomHeaders(Collection<Map.Entry<String, String>> headers) {
    this.customHeaders.clear();
    this.customHeaders.addAll(headers);
  }
}
