/**
* Copyright 2016 PT Inovação e Sistemas SA
* Copyright 2016 INESC-ID
* Copyright 2016 QUOBIS NETWORKS SL
* Copyright 2016 FRAUNHOFER-GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG E.V
* Copyright 2016 ORANGE SA
* Copyright 2016 Deutsche Telekom AG
* Copyright 2016 Apizee
* Copyright 2016 TECHNISCHE UNIVERSITAT BERLIN
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**/

var RegistryConnector = function(registryURL) {
  var RequestWrapper = require('./js-request');
  this._request = new RequestWrapper();
  this._registryURL = registryURL
  // this.wsHandler = wsHandler;
};

RegistryConnector.prototype.handleStubMessage = function (m, callback) {
  // CREATE hyperties for allocation here or in the registry
  if (m.type.toLowerCase() === "create") {
    this.addHyperty(m.body.value.user, m.body.value.hypertyURL, m.body.value.hypertyDescriptorURL, callback);
  }

  // READ
  else if (m.type.toLowerCase() === "read"){
    console.log("+[RegistryConnector] [handleStubMessage] READ message received on WSHandler");

    // // error handling
    // if (!m.body.user) {
    //   console.log("This is not a read message.");
    //   callback({code: 422})
    // }

    // It must be a USER GET request if no hypertyURL is given.
    // if (m.body.user && !m.body.hypertyURL) {
      this.getUser(m.body.resource, callback);
      // this.getUser(m.body.user, callback);
      //   (response) => {
      //   console.log("SUCCESS GET USER from REGISTRY", response);
      //   this.wsHandler.sendWSMsg({
      //     id  : m.id,
      //     type: "RESPONSE",
      //     from: m.to,
      //     to  : m.from,
      //     body: response
      //   });
      // })
    // }

    // // It has to be a HYPERTY GET request when a hypertyURL is given.
    // // TODO: check for correctness with documentation
    // // TODO: clearify why every hypertyURL is returned instead of the one wanted
    // else if (m.body.user && m.body.hypertyURL) {
    //   this.getHyperty(m.body.user, m.body.hypertyURL, (response) => {
    //     console.log("SUCCESS GET HYPERTY from REGISTRY", response);
    //     this.wsHandler.sendWSMsg({
    //       id  : m.id,
    //       type: "RESPONSE",
    //       from: m.to,
    //       to  : m.from,
    //       body: response
    //     });
    //   });
    // }
  }

  // UNKNOWN
  else {
    console.error("+[RegistryConnector] [handleStubMessage] ERROR: message type unknown");
  }
};

RegistryConnector.prototype.getUser = function(userid, callback) {
  this._request.get(this._registryURL + '/hyperty/user/' + encodeURIComponent(userid), function(err, response) {
    console.log("+[RegistryConnector] [getUser] response: " + response);
    callback(response);
  });
};

RegistryConnector.prototype.createUser = function(userid, callback) {
  this._request.put(this._registryURL + '/hyperty/user/' + encodeURIComponent(userid), "", function(err, response) {
    console.log("+[RegistryConnector] [createUser] response: " + response);
    callback(response);
  });
};

RegistryConnector.prototype.getHyperty = function(userid, hypertyid, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);

  this._request.get(this._registryURL + endpoint, function(err, response) {
    console.log("+[RegistryConnector] [getHyperty] response: ", response);
    callback(response);
  });
};

RegistryConnector.prototype.addHyperty = function(userid, hypertyid, hypertyDescriptor, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);
  var data = { 'descriptor': hypertyDescriptor };
  // console.log("[][][][][][][][][][][][][][][][][][][][][][][][][][]");
  // console.log("userid: ", userid);
  // console.log("userid urlencoded: " , encodeURIComponent(userid));
  // console.log("endpoint: ");console.log(this._registryURL + endpoint);
  // console.log("data: ");console.log(data);
  this._request.put(this._registryURL + endpoint, data, function(err, response) {
    console.log("+[RegistryConnector] [addHyperty] response: ", response);
    callback(response);
  });
};


module.exports = RegistryConnector;
