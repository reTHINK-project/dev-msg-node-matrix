import expect from 'expect.js';
import ProtoStubMatrix from '../src/stub/ProtoStubMatrix';

describe('Matrix-Stub address allocation and domain external messaging', function() {

  this.timeout(5000);

  let address1 = null;
  let addressExternal = "hyperty://vertx.pt/a7c5e056-a2c0-4504-9808-62a1425418";
  let stub1 = null;
  let stub2 = null;
  let seq1 = 0;
  let seq2 = 0;

  let connectStub = (bus, stubId, stubConfig) => {

    return new Promise((resolve, reject) => {
      let stub = new ProtoStubMatrix('hyperty-runtime://matrix.docker/protostub/' + stubId, bus, stubConfig);

      stub.connect(stubConfig.identity ? stubConfig.identity : null).then((validatedToken) => {
        resolve(stub);

      }, (err) => {
        expect.fail();
        reject();
      });
    })
  };

  let cleanup = () => {
    stub1.disconnect();
    stub2.disconnect();
  }


  /**
   * Tests the connection of a stub internally in a Matrix Domain.
   * This test uses an idToken to authenticate against the Matrix Domain.
   */
  it('connect internal and external stub, send external PING and expect PONG back', function(done) {

    // prepare and connect stub1 with an identity token
    let config1 = {
      identity: {
        user: "@horst:matrix.docker",
        pwd: "horst1"
      },
      messagingnode: "ws://localhost:8001/stub/connect"
    }

    // let send1;
    let bus1 = {
      postMessage: (m) => {
        seq1++;
        // console.log("stub 1 (internal) got message no " + seq1 + " : " + JSON.stringify(m));
        if (seq1 === 1) {
          expect(m).to.eql("SYNC COMPLETE");
          this.send({
            "id": "1",
            "type": "CREATE",
            "from": "hyperty-runtime://matrix.docker/runsteffen/registry/allocation",
            "to": "domain://msg-node.matrix.docker/hyperty-address-allocation",
            "body": {
              "number": 1
            }
          });
        } else if (seq1 === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("1");
          expect(m.type).to.eql("RESPONSE");
          expect(m.from).to.eql("domain://msg-node.matrix.docker/hyperty-address-allocation");
          expect(m.to).to.eql("hyperty-runtime://matrix.docker/runsteffen/registry/allocation");
          expect(m.body.message).not.to.be.null;
          expect(m.body.allocated.length).to.be(1);
          // store address1
          address1 = m.body.allocated[0];
          console.log("allocated address for domain internal hyperty: " + address1);

          // run external stub, after hyperty allocation is done
          connectExternalStub(done).then( (stub) => {
            stub2 = stub;
            // send msg from addressExternal via external stub2 to address1
            stub._bus.send({
              "id": "2",
              "type": "PING",
              "from": addressExternal,
              "to": address1,
              "body": {
                "message": "Hello from external Domain"
              }
            });

          });

        } else if (seq1 === 3) {
          // this msg is expected to be the the text sent from address1 via stub2 to address1 via stub1
          expect(m.id).to.eql("2");
          expect(m.type).to.eql("PING");
          expect(m.from).to.eql(addressExternal);
          expect(m.to).to.eql(address1);
          expect(m.body.message).to.be.eql("Hello from external Domain");

          this.send({
            "id": "3",
            "type": "PONG",
            "from": address1,
            "to": addressExternal,
            "body": {
              "message": "Thanks and hello back from 1 to external Domain"
            }
          });

        }
      },
      addListener: (url, callback) => {
        this["send"] = callback;
      }
    }
    connectStub(bus1, 1, config1).then((stub) => {
      stub1 = stub;
    });

  });

  let bus2;
  let connectExternalStub = (done) => {

    return new Promise((resolve, reject) => {
      // don't provide any credentials --> stub must be treated as External (from another domain)
      let config2 = {
        messagingnode: "ws://localhost:8001/stub/connect"
      }

      bus2 = {
        postMessage: (m) => {
          seq2++;
          // console.log("external stub got message no " + seq2 + " : " + JSON.stringify(m));
          if (seq2 == 1) {
            // this msg is expected to be the the text sent from address1 via stub2 to address1 via stub1
            expect(m.id).to.eql("3");
            expect(m.type).to.eql("PONG");
            expect(m.from).to.eql(address1);
            expect(m.to).to.eql(addressExternal);
            expect(m.body.message).to.be.eql("Thanks and hello back from 1 to external Domain");
            // We are done --> cleaning up
            cleanup();
            done();
          }
        },
        addListener: (url, callback) => {
          bus2["send"] = callback;
        }
      };

      connectStub(bus2, 2, config2).then((stub) => {
        resolve(stub);
      })
    });
  }

});
