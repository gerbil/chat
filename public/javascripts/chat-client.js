var Chat = function(socket) {
    this.socket = socket;
};

Chat.prototype.sendMessage = function (room, text, avatar) {
    var message = {
        room: room,
        text: text,
        avatar: avatar
    };

    this.socket.emit('message', message);
    //console.log("Normal message sent -> " + message.room + " : " + message.text);
};

Chat.prototype.changeRoom = function(room) {
    this.socket.emit('join', {
        newRoom: room
    });
};


Chat.prototype.processCommand = function(command) {
    var words = command.split(' ');
    var command = words[0]
        .substring(1, words[0].length)
        .toLowerCase();
    var message = false;
    switch(command) {
        case 'join':
            words.shift();
            var room = words.join(' ');
            this.changeRoom(room);
            break;
        case 'nick':
            words.shift();
            var name = words.join(' ');
            // Вызывает handleNameChangeAttempts на сервере
            this.socket.emit('nameAttempt', name);
            break;
        default:
            message = 'Unrecognized command.';
            break;
    }
    return message;
};
