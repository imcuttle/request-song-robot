/**
 * Created by Moyu on 16/8/19.
 */
const URL = require('url')

const util = require('../utils')

const GET_SONG_URL = "http://music.163.com/weapi/cloudsearch/get/web?csrf_token="
const GET_SONGURL_URL = "http://music.163.com/weapi/song/enhance/player/url?csrf_token="
const crypto = util.Crypto
// getSongs('Sugar Maroon').then(console.log)
function getSongs(text) {
    return util
            .spider({
                url: GET_SONG_URL,
                method: 'POST',
                headers: {
                    'Referer': 'http://music.163.com/search/'
                },
                form: crypto.aesRsaEncrypt( JSON.stringify({s: text, type: '1'}))
            }, 'json')
            .then(json => {
                if(json.code==200) {
                    json.result = json.result.songs.map((song) => {
                        return {
                            name: song.name,
                            id: song.id,
                            pic: song.al,
                            author: song.ar.map(art=>{
                                return art.name
                            }).join(','),
                            mv: song.mv>0 ? song.mv : null
                        }
                    })
                }
                return json
            })
            .catch(console.error)
}

function getSongUrl(id) {
    return util.spider({
            url: GET_SONGURL_URL,
            method: 'POST',
            headers: {
                'Referer': 'http://music.163.com/search/'
            },
            form: crypto.aesRsaEncrypt( JSON.stringify({ids: [id], br: 128000}))
        }, 'json')
        .then(json => {
            if(json.code==200) {
                json.data = {
                    url: json.data[0].url,
                    id: json.data[0].id
                }
            }
            return json
        })
}

function getStream(ops) {

    return util.spiderStream(ops)
}


// getLyric(426502151).then(x=>console.log(x))
function getLyric(songid) {
    return util.spider({
        url: `http://music.163.com/weapi/song/lyric?csrf_token=`,
        method: 'POST',
        form: crypto.aesRsaEncrypt( JSON.stringify({id: songid, os:'osx', lv: -1, kv: -1, tv: 1}))
    }, 'json')
    .then(x => {
        if(x.code == 200 && !x.nolyric)
            return {
                code: 200,
                lrc: x.lrc.lyric
                // tlrc: x.tlyric.lyric
            }
        return {
            code: 500
        }
    })
}

function getMvUrl(id) {
    return util.spider({
        url: `http://music.163.com/mv?id=${id}`,
        method: 'GET',
        headers: {
            Referer: 'http://music.163.com/'
        }
    }, 'jq').then($ => {
        let json = {}
        let embed = $('embed')
        if(embed.length!=0){
            embed.attr('flashvars').split('&').forEach(x=>{
                let i = x.indexOf('=')
                json[x.substring(0, i)] = x.substring(i+1)
            })
        }
        return json
    })
}
//coverImg=http://p3.music.126.net/go6fIIio9GgTcUw4V9tfYg==/2495891495054232.jpg
// "hurl=http://v4.music.126.net/20160820235551/2cdb91ea93917fb668cb58394a3097f9/web/cloudmusic/YDAwIDVgJTQwNDUgICEwIQ==/mv/==/288118/d200ceeb902399e0f503374c6e792eb3.mp4&amp;" +
// "murl=http://v4.music.126.net/20160820235551/ece7b823f0e9dd4575ec7d704238eda9/web/cloudmusic/YDAwIDVgJTQwNDUgICEwIQ==/mv/288118/174cdc4bf70d5830521ee06c560ade56.mp4&amp;

function getSongSuggest(s) {
    return util.spider({
        url: "http://music.163.com/weapi/search/suggest/web?csrf_token=",
        method: 'POST',
        headers: {
            Referer: 'http://music.163.com/search/'
        },
        form: crypto.aesRsaEncrypt(JSON.stringify({s: s}))
    }, 'json').then(json=>{
        if(json.code == 200) {
            json.songs = json.result.songs
            delete json.result
            json.songs.map(x=>{
                return {
                    name: x.name,
                    id: x.id,
                    mv: x.mvid,
                    author: x.artists.map(art=>{
                        return art.name
                    }).join(',')
                }
            })
        }
        return json;
    })
}

function forwardRequest (req, res, url) {
    var urlAsg = URL.parse(url, true);
    var headers = req.headers;
    var urlOptions = {
        host: urlAsg.host,
        port: urlAsg.port || 80,
        path: urlAsg.path,
        method: req.method,
        headers: { range: headers.range }
        // rejectUnauthorized: false
    };

    var forward_request = require('http').request(urlOptions, function(response) {
        var code = response.statusCode;
        if(code === 302 || code === 301) {
            var location = response.headers.location;
            console.log('location', location);
            response.destroy();
            forward_request.abort();
            forwardRequest(req, res, location);
            return;
        }
        res.writeHead(code, response.headers);
        response.pipe(res, {end: false})
    });

    forward_request.on('error', function(e) {
        console.error('problem with request: ' + e.message);
    });

    req.pipe(forward_request)
}

module.exports = {
    getSongs,
    getSongUrl: getSongUrl,
    getMvUrl,
    getStream,
    getSongSuggest,
    getLyric,
    forwardRequest
}
