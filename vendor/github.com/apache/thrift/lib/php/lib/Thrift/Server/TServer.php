<?php

namespace Thrift\Server;

use Thrift\Factory\TTransportFactory;
use Thrift\Factory\TProtocolFactory;

/**
 * Generic class for a Thrift server.
 *
 * @package thrift.server
 */
abstract class TServer
{
  /**
   * Processor to handle new clients
   *
   * @var TProcessor
   */
  protected $processor_;

  /**
   * Server transport to be used for listening
   * and accepting new clients
   *
   * @var TServerTransport
   */
  protected $transport_;

  /**
   * Input transport factory
   *
   * @var TTransportFactory
   */
  protected $inputTransportFactory_;

  /**
   * Output transport factory
   *
   * @var TTransportFactory
   */
  protected $outputTransportFactory_;

  /**
   * Input protocol factory
   *
   * @var TProtocolFactory
   */
  protected $inputProtocolFactory_;

  /**
   * Output protocol factory
   *
   * @var TProtocolFactory
   */
  protected $outputProtocolFactory_;

  /**
   * Sets up all the factories, etc
   *
   * @param object $processor
   * @param TServerTransport $transport
   * @param TTransportFactory $inputTransportFactory
   * @param TTransportFactory $outputTransportFactory
   * @param TProtocolFactory $inputProtocolFactory
   * @param TProtocolFactory $outputProtocolFactory
   * @return void
   */
  public function __construct($processor,
                              TServerTransport $transport,
                              TTransportFactory $inputTransportFactory,
                              TTransportFactory $outputTransportFactory,
                              TProtocolFactory $inputProtocolFactory,
                              TProtocolFactory $outputProtocolFactory) {
    $this->processor_ = $processor;
    $this->transport_ = $transport;
    $this->inputTransportFactory_ = $inputTransportFactory;
    $this->outputTransportFactory_ = $outputTransportFactory;
    $this->inputProtocolFactory_ = $inputProtocolFactory;
    $this->outputProtocolFactory_ = $outputProtocolFactory;
  }

  /**
   * Serves the server. This should never return
   * unless a problem permits it to do so or it
   * is interrupted intentionally
   *
   * @abstract
   * @return void
   */
  abstract public function serve();

  /**
   * Stops the server serving
   *
   * @abstract
   * @return void
   */
  abstract public function stop();
}
