var express = require('express');
var redis = require('redis');
var busboy = require('connect-busboy'); //middleware for form/file upload
var fs = require('fs-extra'); //File System - for file manipulation
var easyimg = require('easyimage'); //Image resize

var router = express.Router();
var redisClient = redis.createClient('6379', '127.0.0.1') // DB server connect

// File upload settings
router.use(busboy({
    limits: {
        fileSize: 10 * 1024 * 1024
    }
}));

router.use(express.static('public/'));

/* GET chat page. */
router.get('/', function(req, res) {
    // Берём из базочки последние 100 сообщений
    var messages = redisClient.lrange('messages', 0, 99, function(err, reply) {
        if(!err) {
            var result = [];
            // Loop through the list, parsing each item into an object
            for(var msg in reply) result.push(JSON.parse(reply[msg]));
            // Pass the message list to the view
            //console.log(result);
            //console.log("**********************************");
            res.render('chat', { messages: result, title: 'Ninja chat' });
        } else res.render('chat', { title: 'Ninja chat' });
    });
});

/* POST upload avatar */
router.post('/upload', function (req, res) {
        var fstream;
        var avatarFolder = 'public/images/avatars/';
        var progressPercent = 0;
        var chunkSize = 0;
        var fileFullSize = req.headers['content-length'];
        var fileFullSizeOnePercent = fileFullSize / 100;

        req.pipe(req.busboy);

        req.busboy.on('file', function (fieldname, file, filename) {
            var avatarImg = avatarFolder + filename;
            fstream = fs.createWriteStream(avatarImg);
            file.pipe(fstream);
            file.on('data', function(data) {
                chunkSize += data.length;
                progressPercent = Math.round(chunkSize / fileFullSizeOnePercent);
               // console.log('progress ' + progressPercent + ' %');
            });
            fstream.on('close', function () {
                //For AJAX
                res.writeHead(200, { 'Content-Type': 'text/plain'});
                res.write('ok');  //response ok
                res.end();

                easyimg.resize({
                    src: avatarImg,
                    dst: avatarImg,
                    width: 50,
                    height: 50
                });

            });
        });
});

module.exports = router;