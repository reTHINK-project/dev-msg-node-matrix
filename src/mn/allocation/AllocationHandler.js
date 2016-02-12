
import MNManager from '../common/MNManager';

export default class AllocationHandler {

  constructor(domain) {
    this.OBJECT_SCHEMES = ["connection", "comm", "ctxt"];
    this._domain = domain;
    this._mnManager = MNManager.getInstance();
    this._msgPrefix = "domain://msg-node." + this._domain + "/";
    this._allocationKeyMap = new Map();
  }

  isAllocationMessage(m) {
    return (m.to === (this._msgPrefix + "hyperty-address-allocation") ) ||
           (m.to === (this._msgPrefix + "object-address-allocation") );
  }

  /*
  */
  handleAllocationMessage(m, wsHandler) {
    let number;
    let key;
    let scheme;
    let mtype  = m.type ? m.type.toUpperCase() : null;
    let type   = m.to.endsWith("hyperty-address-allocation") ? "hyperty" : null;
    if ( ! type )
      type = m.to.endsWith("object-address-allocation") ? "object" : type;

    if ( m.body.value ) {
      number = m.body.value.number ? m.body.value.number : 1;
      key    = m.body.value.allocationKey ? m.body.value.allocationKey : null;
      scheme = (type === "object") && m.body.value.scheme ? m.body.value.scheme : "hyperty";
    }

    switch (mtype) {
      case "CREATE":
        if ( type === "object" && this.OBJECT_SCHEMES.indexOf(scheme) < 0 ) {
          // return with "BAD REQUEST" response, if the scheme is invalid
          wsHandler.sendWSMsg( this.sendResponse(m, 400, null) );
          return;
        }
        console.log("ADDRESS ALLOCATION request with %d %s address allocations requested", type, number);
        let addresses = this._mnManager.allocateAddresses(wsHandler, type, number, scheme);

        // add the allocated addresses to the allocationKeyMap to allow later block-deletion by key
        if ( key )
          this._allocationKeyMap.set(key, addresses);

        wsHandler.sendWSMsg( this.createResponse(m, 200, addresses) );
        break;

      case "DELETE":
        let allocationKey = m.body.resource;
        let childrenResources = m.body.childrenResources;

        // BAD REQUEST ?
        if ( ! allocationKey && ! childrenResources ) {
          wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
          return;
        }

        // delete Block of allocations by key
        if ( allocationKey ) {
          let addresses = this._allocationKeyMap.get(allocationKey);
          if ( addresses ) {
            addresses.forEach((key, i, arr) => {
              this._mnManager.removeHandlerMapping(key);
            });
          }
        }

        // delete dedicated address(es)
        if ( childrenResources ) {
          childrenResources.forEach((key, i, arr) => {
            this._mnManager.removeHandlerMapping(key);
          });
        }
        // if the key does not exist, we ignore this and send a 200 response
        wsHandler.sendWSMsg( this.createResponse(m, 200, null) );
        break;
      default:

    }
  }

  createResponse(m, code, addresses) {
    let content = { "code": code };
    if ( addresses )
      content.value = { "allocated" : addresses };
    return {
      id:   m.id,
      type: "RESPONSE",
      from: m.to,
      to:   m.from,
      body: content
    };
  }

}
