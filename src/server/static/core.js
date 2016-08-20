/**
 * Created by Moyu on 16/8/19.
 */

!function (w, d) {
    var socket = io();
    var ipt = d.querySelector('.ipt-container input')
    var tip = d.querySelector('.tips')
    var container = d.querySelector('.container')
    var msgs = d.querySelector('.msg-items')
    var songs = d.querySelector('.songs-items')
    var videoC = d.querySelector('.video-c')
    var audio = d.querySelector('audio')
    var video = d.querySelector('video')
    var currentPlay = d.querySelector('#currentPlay')
    var suggest = d.querySelector('.suggest')
    var time = d.querySelector('#musicBox span')
    var musicBox = d.querySelector('#musicBox')
    var range = d.querySelector('#musicBox input')

    /* common begin */
    function appendBullet(val, isSelf) {
        function randDuration() {
            return 3.5 + (Math.random()*1.5);
        }
        function randTop() {
            var bound = container.clientHeight - 20
            var low = 10
            return low + (Math.random()*(bound - low));
        }
        var span = d.createElement('span')
        span.className = 'bullet-text ' + (isSelf?'isSelf':'')
        span.innerText = val
        if(!video.paused && !video.ended) {
            videoC.appendChild(span)
        } else
            container.appendChild(span)
        span.style.animationDuration = randDuration()+'s'
        span.style.top = randTop()+'px'
    }
    function setTip(v) {
        tip.innerText = v
        tip.timer!=null && clearTimeout(tip.timer)
        tip.timer = setTimeout(function () {
            tip.innerText = ''
        }, 2000)
    }
    function setCurrentPlay(song) {
        var s = song ? '正在播放: ' + song.name + ' - ' + song.author : ''
        currentPlay.innerText = s
    }
    function appendMsg(msg) {
        function mkP(text) {
            var span = d.createElement('p')
            // span.className = cls
            span.innerText = text
            return span
        }
        var li = d.createElement('li')
        li.appendChild(mkP(msg.name+': '+msg.text))
        msgs.appendChild(li)
        msgs.scrollTop = msgs.scrollHeight
    }
    function appendSong(song) {
        function mkP(text, id, close) {
            var span = d.createElement('p')
            span.innerText = text
            span.id = 'p'+id;
            if(close) {
                var s = d.createElement('span')
                s.className = 'btn-close'
                span.appendChild(s)
                s.innerText = 'X'
            }
            return span
        }
        var li = d.createElement('li')
        li.appendChild(mkP(song.username+' 点歌 '+song.name+' - '+song.author, song.id, song.isSelf))
        songs.appendChild(li)
        songs.scrollTop = songs.scrollHeight
    }
    function removeSelector(el, parent) {
        parent = parent || d
        var ele = parent.querySelector(el)
        ele && ele.remove()
    }
    function toggleMiniVideo() {
        videoC.classList.toggle('mini')
        var mini = videoC.querySelector('.mini')
        mini.classList.toggle('vertical')
        videoC.querySelector('.mini.second').classList.toggle('show')
    }
    function fixVideoCloseBtn() {
        videoC.style.height = w.getComputedStyle(video).height
    }
    function playSong(song) {
        if(!song.id)
            return
        setCurrentPlay(song)
        if(song.mv>0) {
            videoC.style.display = 'block'
            musicBox.style.display = 'none'
            video.src = song.mvurl
            video.dataset['sid'] = song.id
            if(song.pic) {
                video.poster = song.pic.picUrl
                container.style.backgroundImage='url("'+song.pic.picUrl+'")'
            }
            if(song.curTime)
                video.currentTime = song.curTime
            video.play()
        } else {
            videoC.style.display = 'none'
            musicBox.style.display = 'block'
            audio.src = song.url
            audio.dataset['sid'] = song.id
            if(song.curTime)
                audio.currentTime = song.curTime
            audio.play()
            container.style.backgroundImage='url("'+song.pic.picUrl+'")'
        }
        let hl = songs.querySelector('.hl')
        let active = songs.querySelector('#p'+song.id)
        hl && hl!==active && hl.remove()
        songs.querySelector('#p'+song.id)
            .classList.add('hl')
    }
    var SUG_URL = '/api/sug'
    function get(url, callback, type) {
        var xhr = new XMLHttpRequest()
        xhr.open('GET', url, true)
        xhr.send(null)
        xhr.onreadystatechange = function() {
            if (xhr.readyState==4 && xhr.status==200) {
                var t = xhr.responseText
                switch (type) {
                    case 'json':
                        t = JSON.parse(t)
                        break
                }
                callback(t)
            }
        }
    }
    function setSuggests(songs) {
        suggest.innerHTML = ''
        function createLi(song, active) {
            var li = d.createElement('li')
            li.innerText = song.name+' - '+song.author
            li.props = song
            li.className = active?'active':''
            return li
        }
        songs.forEach(function (x, i) {
            suggest.appendChild(createLi(x, i==0))
        })
    }
    function suggestIsShow () {
        return suggest.style.visibility=='visible'
    }
    function getTimeStr(sec) {
        var m = parseInt(sec/60)
        var s = parseInt(sec - m*60)
        return m+':'+s
    }
    function showSuggest (val) {
        if(val=='') return;
        if(/^点歌 (.+)$/.test(val)) {
            val =  RegExp.$1.trim()
            get(SUG_URL+'?s='+val, function (json) {
                if(json.code!=200)
                    setTip(json.message)
                else {
                    suggest.style.visibility = 'visible'
                    setSuggests(json.result)
                }
            }, 'json')
        }
    }
    /* common end */
    /* events begin */
    ipt.addEventListener('keydown', function (e) {
        var val = this.value.trim()
        if(e.keyCode === 13) {
            var active = suggest.querySelector('li.active')
            if(active && suggestIsShow())
                socket.emit('reqsong', active.props)
            else {
                socket.emit('bullet', {val: val})
            }
            suggest.style.visibility = 'hidden'
        } else if((e.keyCode === 40 || e.keyCode === 38) && suggestIsShow()){ // down
            e.preventDefault()
            var active = suggest.querySelector('li.active')
            var l = suggest.children.length
            var next = 0
            var find = [].slice.call(suggest.children).findIndex(function (li) {
                return li === active
            })
            if(find>=0)
                next = ( find + (e.keyCode==38?-1:1) ) % l
            else
                next = 0
            next = next>=0?next:l+next
            active && active.classList.remove('active')
            if(suggest.children[next]) {
                var h = [].slice.call(suggest.children, 0, next).reduce((p,n)=>{
                    return p+n.clientHeight
                }, 0)
                suggest.scrollTop = h
                suggest.children[next].classList.add('active')
            }
        }
    })
    ipt.addEventListener('blur', function () {
        setTimeout(function () {
            suggest.style.visibility = 'hidden'
        }, 100)
    })
    ipt.addEventListener('focus', function () {
        var val = this.value.trim()
        showSuggest(val)
    })
    ipt.addEventListener('input', function (e) {
        var val = this.value.trim()
        showSuggest(val)
    })

    audio.addEventListener('ended', function (e) {
        audio.ended = audio.paused = true
        audio.src = ''
        musicBox.style.display = 'none'
        setCurrentPlay(null)
        container.style.backgroundImage = ''
        socket.emit('playEnd', audio.dataset.sid)
        removeSelector('.hl', songs)
    })
    audio.addEventListener('timeupdate', function (e) {
        musicBox.style.display = 'block'
        var s = getTimeStr(audio.currentTime) + ' - ' + getTimeStr(audio.duration)
        time.innerText = s
    })
    video.addEventListener('ended', function (e) {
        video.ended = video.paused = true
        video.src = ''
        videoC.style.display = 'none'
        setCurrentPlay(null)
        container.style.backgroundImage = ''
        socket.emit('playEnd', video.dataset.sid)
        removeSelector('.hl', songs)
    })
    videoC.addEventListener('click', function(e) {
        var target = e.target
        if(target.classList.contains('btn-close') || target.parentElement.classList.contains('btn-close')) {
            toggleMiniVideo()
            fixVideoCloseBtn()
        }
    })
    w.addEventListener('resize', function (e) {
        fixVideoCloseBtn()
    })
    video.addEventListener('resize', function (e) {
        fixVideoCloseBtn()
    })
    songs.addEventListener('click', function (e) {
        var t = e.target
        if(t.classList.contains('btn-close')) {
            var sid = t.parentElement.id.substring(1)
            socket.emit('deleteSong', sid)
        }
    })
    suggest.addEventListener('click', function (e) {
        var t = e.target
        if(t.tagName == 'LI') {
            socket.emit('reqsong', t.props)
        }
    })
    range.addEventListener('change', function (e) {
        audio.volume = range.value / 100
    })
    /* events end */


    /* socket.io begin */
    socket
        .on('login', function () {
            var name = prompt('输入名字: ', '')
            songs.innerHTML = ''
            socket.emit('login', (name==null?'':name).trim())
            videoC.style.display = 'none'
            musicBox.style.display = 'none'
            audio.volume = 1
            audio.ended = true
            video.ended = true
            setCurrentPlay(null)
            container.style.backgroundImage = ''
        }).on('bullet', function (data) {
            if(data.forbid) {
                setTip('5s内不能多次发送消息')
            } else {
                ipt.value = ''
                appendBullet(data.val, data.isSelf)
            }
        }).on('message', function (msg) {
            appendMsg(msg)
        }).on('initSongs', function (songs) {
            songs.innerHTML = ''
            songs.forEach(function (song) {
                appendSong(song)
            })
        }).on('putSong', function (data) {
            if(data.code==200) {
                appendSong(data.song)
            } else {
                setTip('错误: ' + data.message)
            }
        }).on('play', function (song) {
            if(song) {
                if(!song.fixTime) {
                    playSong(song)
                } else {
                    socket.emit('play')
                }
            } else {
                setTip('现在还没人点歌哦')
            }
        }).on('currentTime', function (socketId) {
            var curTime = 0
            if(!audio.ended)
                curTime = audio.currentTime
            else if(!video.ended)
                curTime = video.currentTime
            socket.emit('currentTime', {
                id: socketId,
                curTime: curTime
            })
        }).on('deleteSong', function (json) {
            if(json.isSelf) {
                removeSelector('#p'+json.id, songs)
            }else {
                setTip('不能删除不是你点的歌曲')
            }
        })
    /* socket.io end */
}(window, document)