var socketio = require('socket.io');
var redis = require('redis');
var _ = require('underscore');

var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var rooms = [];
var currentRoom = {};
var namespace = '/';
var redisClient = redis.createClient('6379', '127.0.0.1'); // DB server connect

exports.listen = function (server) {
    io = socketio.listen(server);
    io.sockets.on('connection', function (socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        joinRoom(socket, 'Lobby');
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        handleRoomsList(socket);
        handleAvatarChange(socket);
        handleUserList(socket);
        handleClientDisconnection(socket, nickNames);
    });
};


// При получении команды 'rooms' сервер должен отдавать список всех комнат.
function handleRoomsList(socket) {
    socket.on('rooms', function () {
        // Список клиентов
        var connectedIds = Object.keys(io.sockets.connected)
        // Список комнат + клиентов
        var rooms = Object.keys(io.nsps[namespace].adapter.rooms)
        // Список комнат
        for (var i = 0; i < connectedIds.length; i++) {
            rooms = _.without(rooms, connectedIds[i].toString())
        }
        socket.emit('roomsUpdate', rooms)
    })
}

// Меняем аватар по запросу
function handleAvatarChange(socket) {
    socket.on('avatarChange', function (avatar, room) {
        // Удаляем старую запись из объекта юзеров
        // Добавляем новую с аватаром
        delete nickNames[socket.id].avatar;
        nickNames[socket.id].avatar = avatar;
        socket.broadcast.to(room).emit('systemMessage', {
            text: nickNames[socket.id].name + ' has changed avatar.'
        });
    })
}

function handleUserList(socket) {
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
}

// При коннекте юзер получает ник автоматом
function assignGuestName(socket, guestNumber, nickNames) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = { name: name, avatar: 'default.jpg' };
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    return guestNumber + 1;
};


// При смене комнаты меняет комнату и посылает joinResult всем в команате.
// После этого посылает message в комнату с текстом has join room
function joinRoom(socket, room) {
    // Добавляем новый рум в список румов только если его там нет
    if (rooms.indexOf(room) == -1) {
        rooms.push(room);
    }
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit('joinResult', {room: room});
    socket.broadcast.to(room).emit('systemMessage', {
        text: nickNames[socket.id].name + ' has joined <strong>' + room + '</strong>.'
    });
};

// При смене ника previousName меняется на name пришедшее в nameAttempt
function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on('nameAttempt', function (name) {
        // Достаём все имена из объекта юзеров
        namesUsed = [];
        var keys = Object.keys(nickNames);
        for (var i = 0; i < keys.length; i++) {
            namesUsed.push(nickNames[keys[i]].name);
        }

        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: '<strong>Names cannot begin with "Guest"</strong>.'
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                var previousName = nickNames[socket.id].name;
                name = name.substring(0, 6); //Ник не длиннее 6 символов
                namesUsed.push(name);
                nickNames[socket.id].name = name;
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
                name: nickNames[socket.id].name,
                time: timestamp,
                avatar: 'images/avatars/' + message.avatar
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
        delete nickNames[socket.id];
    });
}




