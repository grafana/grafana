package {
  import flash.display.Sprite;
  import flash.text.TextField;
  import flash.text.TextFieldType;
  import flash.events.MouseEvent;
  import flash.system.Security;

  import org.apache.thrift.transport.TSocket;
  import org.apache.thrift.transport.TTransport;
  import org.apache.thrift.protocol.TProtocol;
  import org.apache.thrift.protocol.TBinaryProtocol;

  /**
   * Simple interface and connection logic implementation for tutorial.
   */
  public class CalculatorUI extends Sprite {
    public static const BUTTON_PADDING:uint = 5;

    private var mCalculatorClient:Calculator; // we use calculator through interface
    private var mTransport:TTransport; // Transport, used to comunicate with server

    private var mAddButton:Sprite;
    private var mLeft:TextField;
    private var mRight:TextField;
    private var mResult:TextField;

    private var pingButton:Sprite;

    public function CalculatorUI() {
      buildInterface();
      initSecurity();
      initConnection();
    }

    private function initSecurity():void {
      Security.loadPolicyFile("xmlsocket://127.0.0.1:9092");
    }

    /**
     * Example of initializing connection.
     */
    private function initConnection():void {
      mTransport = new TSocket("127.0.0.1", 9090); // we connect to server
      mTransport.open();
      // initialize protocol:
      var protocol:TProtocol = new TBinaryProtocol(mTransport, false, false);
      mCalculatorClient = new CalculatorImpl(protocol); // finally, we create calculator client instance
    }

    private function onPingClick(me:MouseEvent):void {
      if(!mTransport.isOpen()) return;
      mCalculatorClient.ping(onPingError, onPingSuccess);
    }

    private function onPingError(error:Error):void {
      trace("Error, while requesting ping.");
      throw error;
    }

    private function onPingSuccess():void {
      trace("Ping returned successfully");
    }

    private function onAddClick(me:MouseEvent):void {
      if(!mTransport.isOpen()) return;
      var num1:Number = Number(mLeft.text);
      var num2:Number = Number(mRight.text);
      mResult.text = "Processing...";
      mCalculatorClient.add(num1, num2, onAddError, onAddSuccess);
    }

    private function onAddError(error:Error):void {
      trace("Error, while requesting add.");
      throw error;
    }

    private function onAddSuccess(res:Number):void {
      mResult.text = String(res);
    }

    private function buildInterface():void {
      addChild(pingButton = buildButton("PING"));
      pingButton.x = (stage.stageWidth - pingButton.width) / 2;
      pingButton.y = 10;
      pingButton.addEventListener(MouseEvent.CLICK, onPingClick);

      var top:Number = pingButton.y + pingButton.height + 20;
      addChild(mLeft = buildDigitInput());
      mLeft.x = 15;
      mLeft.y = top + BUTTON_PADDING;
      addChild(mRight = buildDigitInput());
      mRight.x = mLeft.x + mLeft.width + 15;
      mRight.y = top + BUTTON_PADDING;
      addChild(mAddButton = buildButton("ADD"));
      mAddButton.x = mRight.x + mRight.width + 15;
      mAddButton.y = top;
      mAddButton.addEventListener(MouseEvent.CLICK, onAddClick);
      addChild(mResult = buildDigitInput());
      mResult.x = mAddButton.x + mAddButton.width + 15;
      mResult.y = top + BUTTON_PADDING;
    }

    /**
     * Simple digit-only input field.
     */
    private function buildDigitInput():TextField {
      var textField:TextField = new TextField;
      textField.width = 75;
      textField.height = 20;
      textField.restrict = "0987654321.";
      textField.type = TextFieldType.INPUT;
      textField.background = true;
      textField.backgroundColor = 0xaaaaff;
      textField.textColor = 0xffff00;
      return textField;
    }

    /**
     * Simple button drawing.
     */
    private function buildButton(text:String):Sprite {
      var button:Sprite = new Sprite;
      var textField:TextField = new TextField;
      textField.width = 4000;
      textField.text = text;
      textField.textColor = 0xffff00;
      textField.width = textField.textWidth + 4;
      textField.height = textField.textHeight + 4;
      textField.mouseEnabled = false;
      button.graphics.beginFill(0x0000ff);
      button.graphics.lineStyle(0, 0x000000);
      button.graphics.drawRoundRect(0, 0, textField.width + BUTTON_PADDING * 2,
                                    textField.height + BUTTON_PADDING * 2, BUTTON_PADDING);
      button.graphics.endFill();
      button.addChild(textField);
      textField.x = BUTTON_PADDING;
      textField.y = BUTTON_PADDING;
      button.useHandCursor = button.buttonMode = true;
      return button;
    }
  }
}
