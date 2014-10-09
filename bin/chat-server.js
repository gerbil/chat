var socketio = require('socket.io');
var redis = require('redis');

var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};
var namespace = '/';

exports.listen = function (server) {
    io = socketio.listen(server);

    io.sockets.on('connection', function (socket) {
        //console.log(Object.keys(io.nsps[namespace].adapter.rooms));

        guestNumber = assignGuestName(socket, guestNumber,nickNames, namesUsed);
        joinRoom(socket, 'Lobby');
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);

        // При получении команды 'rooms' сервер должен отдавать список всех комнат.
        socket.on('rooms', function () {
           socket.emit('rooms', Object.keys(io.nsps[namespace].adapter.rooms));
        });

        // Возвращаем новый список юзерков текущей комнаты
        socket.on('users', function (room) {
            var clients = io.sockets.adapter.rooms[room];
            var users = [];
            for (var clientId in clients) {
                users.push(nickNames[io.sockets.connected[clientId].id]);
            }
            //console.log(users);
            socket.emit('users', users);
        });

        handleClientDisconnection(socket, nickNames, namesUsed);
    });

};

// При коннекте юзер получает ник автоматом
function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    namesUsed.push(name);
    return guestNumber + 1;
};


// При смене комнаты меняет комнату и посылает joinResult всем в команате.
// После этого посылает message в комнату с текстом has join room
function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit('joinResult', {room: room});
    socket.broadcast.to(room).emit('systemMessage', {
        text: nickNames[socket.id] + ' has joined <strong>' + room + '</strong>.'
    });
};

// При смене ника previousName меняется на name пришедшее в nameAttempt
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function (name) {
        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: '<strong>Names cannot begin with "Guest"</strong>.'
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);
                name = name.substring(0,6); //Ник не длиннее 6 символов
                namesUsed.push(name);
                nickNames[socket.id] = name;
                delete namesUsed[previousNameIndex];
                socket.emit('nameResult', {
                    success: true,
                    name: name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit('systemMessage', {
                    text: previousName + ' is now known as <strong>' + name + '</strong>.'
                });
            } else {
                socket.emit('nameResult', {
                    success: false,
                    message: '<strong>That name is already in use.</strong>'
                });
            }
        }
    });
};

// DB server connect
var redisClient = redis.createClient('6379', '127.0.0.1');

function handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
        var messageFull = '';
        //console.log("Server received message -> " + nickNames[socket.id] + ': ' + message.text + " -> " + message.room);
        if (message.text.length > 0) {

            var time = new Date();
            var timestamp = ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2) + ":" + ("0" + time.getSeconds()).slice(-2);

            messageFull = {
                room: message.room,
                text: message.text,
                name: nickNames[socket.id],
                avatar: 'images/avatar2.jpg',
                time: timestamp
            };

            // Передать сообщение вместе с ником сообщаюшего всем в комнате
            socket.emit('message', messageFull);
            //console.log("Server sent from server -> " + name + ': ' + text + " -> " + room);
            // Передать сообщение вместе с ником сообщаюшего всем в комнате, но НЕ самому отправителю
            socket.broadcast.to(message.room).emit('message', messageFull);

            // Запиливаем в базу базочку до ста сообщений к ряду
            redisClient.lpush('messages', JSON.stringify(messageFull));
            redisClient.ltrim('messages', 0, 99);
        }
    });
}

function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}
