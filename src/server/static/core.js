/**
 * Created by Moyu on 16/8/19.
 */

// var source = new EventSource("/stream");
// source.onerror = function (error) {
//     console.error("error", error)
// }
// source.onmessage = function (event) {
//     console.log(event.data);
// }

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
    var lyricDom = d.querySelector('.lyric')
    var color = d.querySelector('input[type=color]')
    var lyricC = d.querySelector('#lyric-c')
    var title = d.head.querySelector('title')
    setProps(title, title.innerText)
    localStorage['bullet'] && insertStyle(localStorage['bullet'])
    localStorage['word'] && insertStyle(localStorage['word'])
    

    /* common begin */
    function bindEventListener(ele, type, fn, bub) {
        bub = bub || false
        ele[type] = fn.bind(ele)
        ele.addEventListener(type, fn, bub)
    }
    function appendBullet(val, isSelf) {
        function randDuration(low, delta) {
            return low + (Math.random()*delta);
        }
        function randTop(el, low) {
            var bound = el.clientHeight - 20
            return low + (Math.random()*(bound - low));
        }
        var span = d.createElement('span')
        span.className = 'bullet-text ' + (isSelf?'isSelf':'')
        span.innerText = val
        if(!video.paused && !video.ended) {
            span.style.top = randTop(videoC, 20)+'px'
            span.style.animationDuration = (videoC.clientWidth < 800 ? randDuration(5, 2) : randDuration(videoC.clientWidth * .01, 2)) +'s'
            videoC.appendChild(span)
            // var all = container.querySelectorAll('.bullet-text')
            // all && all.forEach(a=>{
            //     a.remove()
            // })
        } else {
            span.style.top = randTop(container, 90)+'px'
            span.style.animationDuration = randDuration(5, 2)+'s'
            container.appendChild(span)
            // var all = videoC.querySelectorAll('.bullet-text')
            // all && all.forEach(a=>{
            //     a.remove()
            // })
        }
    }
    function binarySearch(ar, compare_fn) {
        var m = 0;
        var n = ar.length - 1;
        while (m <= n) {
            var k = (n + m) >> 1;
            var cmp = compare_fn(ar[k]);
            if (cmp > 0) {
                m = k + 1;
            } else if(cmp < 0) {
                n = k - 1;
            } else {
                return k;
            }
        }
        return -1;
    }
    function getCurrentWords(lrc, begin, sec, wordnum, curPos) {
        if(curPos==null)
            curPos = parseInt(wordnum/2)
        var tmp = lrc.slice(begin)
        if(tmp.length===0) return null
        var i = tmp.findIndex(function (word) {
            return word[0] >= sec
        })
        i = i>=0 ? i+begin-1 : lrc.length-1
        // if(i>0) {
        //     if(sec - lrc[i-1][0] >= lrc[i][0] - sec){
        //
        //     } else{
        //         i--
        //     }
        // }
        // console.log(i)
        var rlt = new Array(wordnum)
        begin = i - curPos
        for(var j=0; j<wordnum; j++) {
            rlt[j] = j===curPos ? lrc[i]&&lrc[i][1] : lrc[begin]&&lrc[begin][1]
            begin++
        }
        return {
            rlt: rlt,
            hlIndex: i,
            hlPos: curPos
        }
    }
    function renderHlLyric(hlLyric, hlIndex) {
        function makeWord(text, isHl) {
            var t = d.createElement('p')
            t.className = 'word '+(isHl?'hl':'')
            t.innerText = text || ' '
            return t
        }
        lyricDom.innerHTML = ''
        hlLyric.forEach(function (x, i) {
            lyricDom.appendChild(makeWord(x, i==hlIndex))
        })
    }
    function setLyric(lyric, id) {
        function getFormattedLyric(lrc) {
            lrc = lrc.split('\n').filter(function (x) {
                return x.match(/\[.+?\].+/)
            })
            return lrc.map(function (word) {
                var i = word.indexOf(']')
                i = i>=0 ? i : 0
                var time = word.substring(1, i).match(/(\d+):(\d+)\.(\d+)/)
                time = time && time.length>=4 && (parseInt(time[1]*60) + parseInt(time[2]) + parseFloat((time[3]*.001).toFixed(3)))
                return [time, word.substring(i+1)]
            })
        }
        lyricDom.innerHTML = ''
        setProps(lyricDom, {
            id: id,
            lrc: getFormattedLyric(lyric.lrc),
            hlLyric: null
        })

    }
    function setTip(v) {
        tip.innerText = v
        tip.timer!=null && clearTimeout(tip.timer)
        tip.timer = setTimeout(function () {
            tip.innerText = ''
        }, 2000)
    }
    function setTitle(text) {
        title.innerText = text
    }
    function setCurrentPlay(song) {
        var s, info
        if(song) {
            info = '\uD83D\uDC49 '+ song.name + ' - ' + song.author + ' \uD83D\uDC48'
            s = '正在播放: ' + info
            setTitle(info)
        } else {
            s = ''
            setTitle(getProps(title))
        }
        currentPlay.innerText = s
        setProps(currentPlay, {
            song: song
        })
    }
    function appendMsg(msg) {
        function mkP(text) {
            var span = d.createElement('p')
            // span.className = cls
            span.innerText = text
            return span
        }
        var li = d.createElement('li')
        li.appendChild(mkP(msg.welcome ? ('欢迎: '+msg.text) : msg.bye ? ('Bye: '+msg.text) : (msg.name+': '+msg.text)))
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
    function setProps(el, props) {
        if(typeof props === 'object' || typeof props === 'undefined')
            el.props = Object.assign(el.props||{}, props)
        else
            el.props = props
    }
    function getProps(el, key) {
        return key==null ? el.props : (el.props && el.props[key])
    }
    function toggleMiniVideo() {
        if(videoC.classList.contains('mini')) {
            setProps(videoC, {
                miniStyle: {
                    right: videoC.style.right,
                    top: videoC.style.top,
                    width: videoC.style.width
                }
            })
            videoC.style.right = videoC.style.top = videoC.style.width = ''
        } else {
            var style = getProps(videoC, 'miniStyle')
            if(style) {
                for(var k in style) {
                    videoC.style[k] = style[k]
                }
            }
        }

        videoC.classList.toggle('mini')
        var mini = videoC.querySelector('.mini')
        mini.classList.toggle('vertical')
        videoC.querySelector('.mini.second').classList.toggle('show')
    }
    function fixVideoCloseBtn() {
        videoC.style.height = w.getComputedStyle(video).height
        videoC.style.maxHeight = video.style.maxHeight = w.innerHeight+'px'
    }
    function playSong(song) {
        if(!song.id)
            return
        setCurrentPlay(song)
        if(song.mv > 0) {
            var all = videoC.querySelectorAll('.bullet-text')
            all = [].slice.call(all)
            all && all.forEach(a=>{
                a.remove()
            })
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
            lyricDom.style.display = 'none'
        } else {
            videoC.style.display = 'none'
            musicBox.style.display = 'block'
            audio.src = song.url
            audio.dataset['sid'] = song.id
            if(song.curTime)
                audio.currentTime = song.curTime
            audio.play()
            lyricDom.style.display = ''
            container.style.backgroundImage='url("'+song.pic.picUrl+'")'
            song.lyric && song.lyric.code==200 && setLyric(song.lyric, song.id)
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
            setProps(li, song)
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
    function getCurrentSong() {
        return getProps(currentPlay, 'song') || {}
    }
    function insertStyle(css) {
        var h = d.head || d.querySelector('head')
        var sty = d.createElement('style')
        sty.setAttribute('type', 'text/css')
        sty.innerText = css
        h.appendChild(sty)
    }
    /* common end */
    /* events begin */
    bindEventListener(d.body, 'mousedown', function (e) {
        var targ = e.target
        if(videoC.classList.contains('mini')) {
            if(targ === video) {
                videoC.mouseDownMove = true
                videoC.offset = {
                    x: e.offsetX,
                    y: e.offsetY
                }
                videoC.classList.add('moving')
                return
            } else if(targ.classList.contains('resize-left')) {
                videoC.mouseDownResize = true
                return
            }
        }
        if(targ.classList.contains('word')) {
            lyricDom.mouseDownMove = true
            lyricDom.offset = {
                x: e.offsetX,
                y: e.offsetY
            }
            lyricDom.classList.add('moving')
        }
    }, false)
    bindEventListener(d.body, 'mouseup', function (e) {
        videoC.mouseDownMove = false
        videoC.mouseDownResize = 0
        lyricDom.mouseDownMove = false
        videoC.classList.remove('moving')
        lyricDom.classList.remove('moving')
    })
    bindEventListener(d.body, 'mousemove', function (e) {
        var x = e.clientX, y = e.clientY
        function moveHandler(ele) {
            ele.style.width = w.getComputedStyle(ele).width
            if(w.getComputedStyle(ele).position!='fixed')
                ele.style.position = 'fixed'
            var offsetx = ele.offset.x, offsety = ele.offset.y
            ele.style.right = (w.innerWidth- ele.clientWidth - (x-offsetx))+'px'
            ele.style.top = (y-offsety)+'px'
        }
        if(videoC.mouseDownMove) {
            moveHandler(videoC)
        } else if(lyricDom.mouseDownMove){
            moveHandler(lyricDom)
            lyricDom.classList.add('moved')
        }else if(videoC.mouseDownResize) {
            var MIN_WIDTH = 140
            var MAX_WIDTH = w.innerWidth - 10
            var currentWidth = videoC.clientWidth
            var left = videoC.getBoundingClientRect().left
            var delta = left - x

            var computedWidth = currentWidth+delta
            videoC.style.width = (computedWidth>MIN_WIDTH ? computedWidth<MAX_WIDTH? computedWidth: MAX_WIDTH : MIN_WIDTH) + 'px'
            video.resize()
        }
    })
    
    bindEventListener(ipt, 'keydown', function (e) {
        var val = this.value.trim()
        if(e.keyCode === 13) {
            var active = suggest.querySelector('li.active')
            if(active && suggestIsShow())
                socket.emit('reqsong', getProps(active))
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
    bindEventListener(ipt, 'blur', function () {
        setTimeout(function () {
            suggest.style.visibility = 'hidden'
        }, 100)
    })
    bindEventListener(ipt, 'focus', function () {
        var val = this.value.trim()
        showSuggest(val)
    })
    bindEventListener(ipt, 'input', function (e) {
        var val = this.value.trim()
        showSuggest(val)
    })

    bindEventListener(audio, 'ended', function (e) {
        audio.pause()
        audio.src = ''
        musicBox.style.display = 'none'
        setCurrentPlay(null)
        container.style.backgroundImage = ''
        socket.emit('playEnd', audio.dataset.sid)
        removeSelector('.hl', songs)
        lyricDom.style.display = 'none'
        lyricDom.innerHTML = ''
    })
    
    
    bindEventListener(audio, 'timeupdate', function (e) {
        musicBox.style.display = 'block'
        var s = getTimeStr(audio.currentTime) + ' - ' + getTimeStr(audio.duration)
        time.innerText = s
        var p = getProps(lyricDom)
        if(p && p.id == getCurrentSong().id) {
            var bg = hlSec = 0
            if(p.hlLyric && p.hlLyric.hlIndex!=null) {
                bg = p.hlLyric.hlIndex>=0?p.hlLyric.hlIndex:0
                hlSec = p.lrc[bg] && p.lrc[bg][0] || 0
            }
            if(/* audio.currentTime > hlSec && */!p.rendering) {
                // add lock
                bg = audio.currentTime > hlSec ? bg : 0
                setProps(lyricDom, {rendering: true})
                var hlLyric = getCurrentWords(p.lrc, bg, audio.currentTime, 3)
                // p.tlrc ? getCurrentWords(p.tlrc, bg, audio.currentTime, 3) : undefined
                if(hlLyric){
                    p.hlLyric = hlLyric
                    renderHlLyric(hlLyric.rlt, hlLyric.hlPos)
                }
                setProps(lyricDom, {rendering: false})
            }
        }
    })
    bindEventListener(video, 'timeupdate', function (e) {
        // console.log('video timeupdate: ', video.currentTime)
    })
    bindEventListener(video, 'ended', function (e) {
        video.pause()
        video.src = ''
        videoC.style.display = 'none'
        setCurrentPlay(null)
        container.style.backgroundImage = ''
        socket.emit('playEnd', video.dataset.sid)
        removeSelector('.hl', songs)
    })
    bindEventListener(videoC, 'click', function(e) {
        var target = e.target
        if(target.classList.contains('btn-close') || target.parentElement.classList.contains('btn-close')) {
            toggleMiniVideo()
            fixVideoCloseBtn()
        }
    })
    bindEventListener(w, 'resize', function (e) {
        fixVideoCloseBtn()
    })
    bindEventListener(video, 'resize', function (e) {
        fixVideoCloseBtn()
    })
    bindEventListener(songs, 'click', function (e) {
        var t = e.target
        if(t.classList.contains('btn-close')) {
            var sid = t.parentElement.id.substring(1)
            socket.emit('deleteSong', sid)
        }
    })
    bindEventListener(suggest, 'click', function (e) {
        var t = e.target
        if(t.tagName == 'LI') {
            socket.emit('reqsong', getProps(t))
        }
    })
    bindEventListener(range, 'change', function (e) {
        audio.volume = range.value / 100
    })
    bindEventListener(container, 'click', function (e) {
        var t = e.target
        if(t.classList.contains('btn-bullet-color')) {
            setProps(color, 'bullet')
            color.click()
        }
        if(t.classList.contains('btn-word-color')) {
            setProps(color, 'word')
            color.click()
        }
    })
    bindEventListener(color, 'change', function (e) {
        if(getProps(this) == 'bullet') {
            var s = "main .bullet-text {color: "+this.value+";}"
            localStorage['bullet'] = s
            insertStyle(s)
        }
        if(getProps(this) == 'word') {
            var s = ".container .lyric .word {color: "+this.value+";}"
            localStorage['word'] = s
            insertStyle(s)
        }
    })
    /* events end */

    audio.volume = 1
    /* socket.io begin */
    socket
        .on('login', function () {
            var name = prompt('输入名字: ', '')
            songs.innerHTML = ''
            socket.emit('login', (name==null?'':name).trim())
            videoC.style.display = 'none'
            musicBox.style.display = 'none'
            audio.pause()
            video.pause()
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
                playSong(song)
            } else {
                lyricDom.style.display = 'none'
                lyricDom.innerHTML = ''
                setTip('现在还没人点歌哦')
            }
        }).on('currentTime', function (idObj) {
            if(getCurrentSong() && getCurrentSong().id == idObj.songID) {
                var curTime = 0
                if(!audio.paused)
                    curTime = audio.currentTime
                else if(!video.paused)
                    curTime = video.currentTime
                socket.emit('currentTime', {
                    id: idObj.socketID,
                    curTime: curTime
                })    
            }
        }).on('deleteSong', function (json) {
            if(json.isSelf) {
                removeSelector('#p'+json.id, songs)
            }else {
                setTip('不能删除不是你点的歌曲')
            }
        })
    /* socket.io end */
}(window, document)