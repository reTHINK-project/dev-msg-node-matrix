//import MatrixClient from "../client/MatrixClient";
import MNManager from '../common/MNManager';
//import '../registry/RegistryConnector';
var RegistryConnector = require('../registry/RegistryConnector');
let URL = require('url');
let Promise = require('promise');


/**
 * This class implements a handler for a single WebSocket connection from a stub.
 * This connection can either be a domain-internal or -external connection.
 * In case of an internal stub-connection we attempt a Login to the Matrix HS with
 * the given credentials.
 * In case of an external stub-connection, we handover the handling to the RethinkBridge,
 * which is able to act on behalf of non-matrix users.
 **/
export default class WSHandler {

  /**
   * Constructs a new WSHandler for one dedicated Websocket connection.
   * @param wsCon {WebSocketConnection} .. the websocket connection to handle
   **/
  constructor(config, wsCon, userId) {
    this.runtimeURL = wsCon.runtimeURL;
    this._config = config;
    this._wsCon = wsCon;
    this._userId = userId;
    this._client;
    this._roomId;
    this._userId;
    this._mnManager = MNManager.getInstance();
    this.registry = null;
  }

  initialize(bridge) {

    return new Promise((resolve, reject) => {
      bridge.getInitializedClient(this._userId, (e, room) => {
        this._handleMatrixMessage(e, room)
      }).then((client) => {
        // console.log("+++ got client for userId %s with roomId", this._userId, client.roomId);
        this._client = client;
        this._roomId = client.roomId;
        resolve();
      });
    });
  }


  _handleMatrixMessage(event, room) {
    let e = event.event;
    if (!this._wsCon) {
      console.log("\n Disconnected client received a timelineEvent with id %s --> ignoring ...", event.event.event_id);
      return;
    }
    // only interested in events coming from real internal matrix Users
    if (e.type == "m.room.message" && e.user_id.indexOf(this._mnManager.USER_PREFIX) === 0 && e.content.sender === this._mnManager.AS_NAME) {
      console.log("\n+++++++ client received timelineEvent of type m.room.message: %s, event_id: %s", e.user_id, e.event_id, JSON.stringify(e));
      let m = e.content.body;
      try {
        // try to parse
        m = JSON.parse(e.content.body);
      } catch (e) {}
      let wsHandler = this._mnManager.getHandlerByAddress(m.to);
      if (wsHandler) {
        // console.log("+++++++ forwarding this message to the stub via corresponding wsHandler");
        wsHandler.sendWSMsg(m);
      } else {
        console.log("+++++++ no corresponding wsHandler found for to-address %s ", m.to);
      }
    }
  }

  releaseCon() {
    this._wsCon = null;
  }

  updateCon(con) {
    this._wsCon = con;
  }

  /**
   * Performs all necessary actions to clean up this WSHandler instance before it can be destroyed.
   **/
  cleanup() {
    console.log("\ncleaning up WSHandler for: " + this.runtimeURL);
    // stop the internal Matrix Client and release the intent
    try {
      if (this._client)
        this._client.stopClient();
      this._client = null;
    } catch (e) {
      console.log("ERROR while stopping MatrixClient and releasing Intent!")
    }
  }

  /**
   * Sends a message to the handled WebSocket.
   * The message is stringified before it is sent out.
   * @param msg {Object} ... The message to be sent.
   **/
  sendWSMsg(msg) {
    if (this._wsCon) {
      let s = JSON.stringify(msg);
      console.log(">>> WSHandler for id %s sends via websocket", this.runtimeURL, msg);
      this._wsCon.send(s);
    } else {
      console.log("WSHandler: connection is inactive --> not sending msg");
    }
  }

  getMatrixId() {
    return this._userId;
  }


  /**
   * Handles a message coming in from an external stub.
   * @param msg {reThink message}
   **/
  handleStubMessage(m) {
    console.log("WSHandler: handle stub msg =======================================================================\n", m);

    // TODO: utility to validate retHINK message
    if (!m || !m.to || !m.from) {
      console.log("+++++++ this is not a reTHINK message --> ignoring ...");
      return;
    }

    let destination = m.to.split(".");

    // The following code will filter out rethink messages from normal msg flow.
    // These messages must be handled by the MN directly and will not be forwarded.

    // Do not handle messages on this node when this node isn't addressed.
    if (m.to === "domain://msg-node." + this._config.domain + "/hyperty-address-allocation") {
      let number = m.body.number ? m.body.number : 1;
      let addresses = this._mnManager.allocateHypertyAddresses(this, number);
      console.log("ADDRESS ALLOCATION request with %d address allocations requested", number);
      this.sendWSMsg({
        id:   m.id,
        type: "response",
        from: m.to,
        to:   m.from,
        body: {
          code: 200,
          allocated: addresses
        }
      });
    } else if (destination[0] == "domain://registry") {
      if (!m.body) {
        console.log("The message has no body and cannot be processed.");
        return;
      }
      this.registry ? console.log("connector already present") : this.registry = new RegistryConnector(this, 'http://dev-registry-domain:4567');
      this.registry.handleStubMessage(m);
    } else {
      this._routeMessage(m); // route through Matrix
    }
  }


  _routeMessage(m) {
    let from = m.from;
    let to = m.to;

    // is to-address in our domain?
    // does this message address a peer in the own domain?
    // let toDomain = URL.parse(to).hostname;
    // let fromDomain = URL.parse(from).hostname;

    // if session was initiated from external domain, then we must add a handler mapping for the external address
    // otherwise we can't route the response later on
    // if (this._config.domain !== fromDomain) {
      this._mnManager.addHandlerMapping(from, this);
    // }

    // console.log("+++++ comparing localDomain %s with toDomain %s ", this._config.domain, toDomain);
    // route only messages to addresses that have establised message flows already (i.e. we have a mapping)
    if (this._mnManager.getHandlerByAddress(to) !== null) {

      // sufficient to send this message to the clients individual room
      // the AS will intercept this message and forward to the receivers individual room
      let content = {
        "body": JSON.stringify(m),
        "msgtype": "m.text"
      };
      this._client.sendMessage(this._roomId, content);
      console.log(">>>>> sent message to roomid %s ", this._roomId);

    } else {
      console.log("+++++++ client side Protocol-on-the-fly NOT implemented yet!");
    }
  }

}
