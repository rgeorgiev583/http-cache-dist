'use strict';

var kad = require('kademlia-dht');
var io = require('socket.io');

function error(code, message) {
    var err = new Error(message);
    err.code = code;
    return err;
}

function onConnection(socket) {
    this.handlers.forEach(function (handler, message) {
        socket.on(message, function (data) {
            if (data.callback == undefined) {
                socket.emit('error ' + message,
                        {error: error('ENOCB', 'no callback')});
                return;
            }

            if (data.payload == undefined) {
                socket.emit('error ' + message,
                        {error: error('ENOPLD', 'no payload'), callback: data.callback});
                return;
            }

            var newPayload = handler(data.payload);
            socket.emit('success ' + message,
                    {payload: newPayload, callback: data.callback});
        });

        socket.on('success ' + message, function (data) {
            data.callback(null, data.payload);
        });

        socket.on('error ' + message, function (data) {
            if (data.error != 'no callback') {
                data.callback(data.error, null);
            }
        });
    });
}

function DhtNode() {
    var socketio = io(80);
    socketio.on('connection', onConnection.bind(this));
    this.io = socketio;
    this.handlers = new Map();
    this.peers = new Map();
}

Object.defineProperty(DhtNode, 'TIMEOUT', {value: 500});

DhtNode.spawnDht = function (seedAddresses) {
    var node = new DhtNode();
    var seeds = seedAddresses.map(function (address) {
        return io.connect(address);
    });

    var spawnDht = new Promise(
        function (resolve, reject) {
            dht.spawn(node, seeds, function (err, dht) {
                if (err) {
                    reject(err);
                }

                resolve(dht);
            });
        }
    );

    spawnDht.then(
        function (dht) {
            node.dht = dht;
            return dht;
        }
    ).catch(
        function (err) {
            return err;
        }
    );

    return null;
}

DhtNode.prototype.peer = function (socket) {
    if (!this.peers.has(socket.id)) {
        this.peers.set(socket.id, socket);
    }

    return socket;
}

DhtNode.prototype.send = function (message, endpoint, payload, cb) {
    setTimeout(function onTimeout() {
        cb(error('ETIMEOUT', 'timed out'));
    }, DhtNode.TIMEOUT);

    endpoint.emit(message, {payload: payload, callback: cb});
}

DhtNode.prototype.receive = function (message, handler) {
    if (!this.handlers.has(message)) {
        this.handlers.set(message, handler);
    }
}

DhtNode.prototype.close = function () {
    this.io.sockets.disconnect(true);
}

module.exports = DhtNode;
