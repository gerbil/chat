const MESSAGE_COUNT = 7

function divEscapedContentElement(message, name, avatar) {
    removeOldMessages();
    var result = false;
    if (message.length > 0) {
        var time = new Date();
        var timestamp = ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2) + ":" + ("0" + time.getSeconds()).slice(-2);
        result = $('<li class="message"></li>').html('<img class="avatar" src="' + avatar + '"/><span class="nick">' + name + '</span><span class="time">' + timestamp + '</span><div class="message">' + message + '</div>');
    }
    return result;
}
function divSystemContentElement(message) {
    removeOldMessages();
    var result = false;
    if (message.length > 0) {
        var time = new Date();
        var timestamp = ("0" + time.getHours()).slice(-2) + ":" + ("0" + time.getMinutes()).slice(-2) + ":" + ("0" + time.getSeconds()).slice(-2);
        result = $('<li class="message"></li>').html('<img class="avatar" src="images/system.png"/><span class="nick">SYSTEM</span><span class="time">' + timestamp + '</span><div class="message"><i>' + message + '</i></div>');
    }
    return result;
}

// Не более 7 сообщений всего на экране
// TODO: Запилить конфиг для количества сообщений (require js + coffee.script.cfg)
function removeOldMessages() {
    if ($('li.message').size() >= MESSAGE_COUNT) {
        $('.message:eq(0)').remove()
    }
}

function processUserInput(chatApp, socket, message) {
    // Проверяем localStorage на наличие аватара
    // Если есть аватар, меняем на него
    if ('localStorage' in window && localStorage.getItem('avatar')) {
        avatarImg = localStorage.getItem('avatar');
        if (typeof avatarImg != "undefined") {
            var avatarImg = avatarImg;
        }
    }

    if (typeof avatarImg != 'undefined') {
        var message = {
            text: $('#send-message').val(),
            avatar: avatarImg
        }
    } else {
        var message = {
            text: $('#send-message').val(),
            avatar: '../default.jpg'
        }
    }

    // Если это системное сообщение
    if (message.text.charAt(0) == '/') {
        // Вызывает разбор команды nick / join и посылает всем в этой комнате
        chatApp.processCommand(message.text);
    } else {
        // Вот тут петрушка..
        // Если же это обычное сообщение оно тоже должно всем посылаться
        chatApp.sendMessage($('#room').text(), message.text, message.avatar);
        //console.log(socket.id);
    }
    $('#send-message').val('');

    $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
}

var socket = io.connect();

$(document).ready(function () {
    var chatApp = new Chat(socket);

    // Проверяем localStorage на наличие рума
    // Если есть рум то меняем на него
    if ('localStorage' in window && localStorage.getItem('room')) {
        var room = localStorage.getItem('room');
        if (room != "Lobby") {
            chatApp.processCommand('/join ' + room);
        }
    }

    // Проверяем localStorage на наличие ника
    // Если ник не Guest*, то меняем на него
    if ('localStorage' in window && localStorage.getItem('nickname')) {
        var nickname = localStorage.getItem('nickname');
        if (nickname.indexOf('Guest') != 0) {
            chatApp.processCommand('/nick ' + nickname);
        }
    }

    // Проверяем localStorage на наличие аватара
    // Если есть аватар, меняем на него
    if ('localStorage' in window && localStorage.getItem('avatar')) {
        var avatar = localStorage.getItem('avatar');
        if (typeof avatar != "undefined") {
            chatApp.processCommand('/avatar ' + avatar);
        }
    }

    socket.on('nameResult', function (result) {
        if (result.success) {
            localStorage.setItem('nickname', result.name);
            var message = 'You are now known as <strong>' + result.name + '</strong>.';
        } else {
            message = result.message;
        }
        $('#messages ul.chat').append(divSystemContentElement(message));
    });

    socket.on('joinResult', function (result) {
        localStorage.setItem('room', result.room);
        $('#room').text(result.room);
        $('#messages ul.chat').append(divSystemContentElement('Room changed to <strong>' + result.room + '</strong>.'));
    });

    socket.on('message', function (message) {
        $('#messages ul.chat').append(divEscapedContentElement(message.text, message.name, message.avatar));
        //console.log("Normal message received -> " + message.text + " : " + message.name);
    });

    socket.on('systemMessage', function (message) {
        $('#messages ul.chat').append(divSystemContentElement(message.text));
        // console.log("System message received -> " + message.text);
    });


    // ROOM LIST **************************************************************************************************
    socket.on('roomsUpdate', function (rooms) {
        $('#room-list ul').empty();
        for (var i = 0; i < rooms.length; i++) {
            $('#room-list ul').append('<li>' + rooms[i] + '</li>');
        }
    });
    setInterval(function () {
        socket.emit('rooms');
    }, 2000);
    $('#room-list ul').on('click', 'li', function () {
        chatApp.processCommand('/join ' + $(this).text());
    });
    // END ROOM LIST

    // USER LIST ***************************************************************************************************
    socket.on('users', function (users) {
        users.forEach(function (user) {
            $('#user-list').html('<div class="user"><img src="/images/avatars/' + user.avatar + '"><div class="nick">' + user.name + '</div></div>');
        });
    });
    // Возвращаем всех юзеров в этой комнате сразу при запуске
    // Крутим каждую секунду
    function getUsersFromCurrentRoom() {
        var currentRoom = $('#room').text();
        socket.emit('users', currentRoom);
    }
    setInterval(function () {
        getUsersFromCurrentRoom();
    }, 1000);
    // END USER LIST

    $('#send-message').focus();

    $('#send-form').submit(function () {
        processUserInput(chatApp, socket);
        return false;
    });

    // Менюшка настройки *********************************************************************************************
    //$('#actions ul').hide(); // Прячем менюшку
    $('form#changeNick').hide();  // Прячем кнопки
    $('form#changeRoom').hide(); // Прячем кнопки
    $('form#changeAvatar').hide(); // Прячем кнопки
    $('li#changeAvatar .progressBar').hide();

    // Вешаем на иконку триггер дёргать менюшку
    $('#actions img').on('click', function () {
        $('#actions ul').toggle();
    });

    // Меняем ник
    $('#actions ul li#changeNick').bind("click", function () {
        $('form#changeNick').show();
        $('form#changeRoom').hide();
        $('form#changeAvatar').hide();
        $('#actions ul li#changeNick input').focus()
    });

    $('#actions ul li#changeNick').bind("submit", function () {
        $('form#changeNick').hide();
        chatApp.processCommand('/nick ' + $('input#changeNick').val());
        return false;
    });

    // Меняем рум
    $('#actions ul li#changeRoom').bind("click", function () {
        $('form#changeRoom').show();
        $('form#changeNick').hide();
        $('form#changeAvatar').hide();
        $('#actions ul li#changeRoom input').focus()
    });
    $('#actions ul li#changeRoom').bind("submit", function () {
        $('form#changeRoom').hide();
        chatApp.processCommand('/join ' + $('input#changeRoom').val());
        return false;
    });

    // Меняем аватар
    $('#actions ul li#changeAvatar').bind("click", function () {
        $('form#changeAvatar').show();
        $('form#changeRoom').hide();
        $('form#changeNick').hide();
    })

    $('#actions ul li#changeAvatar').bind("submit", function () {
        //console.log("Uploading " + $('input#changeAvatar').prop('files')[0]['name']);
        var file_data = $('input#changeAvatar').prop('files')[0];

        if (typeof file_data != 'undefined') {

            var form_data = new FormData();
            form_data.append('file', file_data);

            $.ajax({
                    url: '/chat/upload',
                    type: 'POST',
                    contentType: false,
                    processData: false,
                    data: form_data,
                    cache: false,
                    success: function (response) {
                        console.log(response);
                    },
                    beforeSend: function () {
                        $('form#changeAvatar').hide();
                        $('li#changeAvatar .progressBar').show();
                    },
                    xhr: function () {
                        var xhr = jQuery.ajaxSettings.xhr();
                        if (xhr instanceof window.XMLHttpRequest) {
                            xhr.upload.addEventListener('progress', function () {
                                var percent = 0;
                                var position = event.loaded || event.position;
                                var total = event.total;
                                if (event.lengthComputable) {
                                    percent = Math.ceil(position / total * 100);
                                }

                                var percentVal = percent + '%';
                                //console.log(percentVal);
                                $('li#changeAvatar .progressBar .inner').css('width', percentVal);
                            }, false);
                        }
                        return xhr;
                    },
                    success: function (data) {
                        $('li#changeAvatar .progressBar').hide();
                        localStorage.setItem('avatar', file_data.name);
                        var currentRoom = $('#room').text();
                        socket.emit('avatarChange', file_data.name, currentRoom);
                        var message = 'Your avatar now changed.';
                        $('#messages ul.chat').append(divSystemContentElement(message));
                    }
                }
            )
        }

        return false;
    });

    // Скролим в самый низ с задержкой, чтоб точно прогрузилось окно
    function scroll() {
        // Скролим в самый низ
        $("#messages")[0].scrollTop = $("#messages")[0].scrollHeight;
    }

    setTimeout(scroll, 1000);

});