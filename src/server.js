// server.js

import http from "http"; // 이미 기본 설치되어있음
import WebSocket from "ws"; // 기본설치!
import express from "express"; // npm i express 설치
import { instrument } from "@socket.io/admin-ui";
import { Server } from "socket.io"; 

const app = express(); // app이라는 변수에 가져와서 사용

app.set("view engine", "pug"); // 뷰 엔진을 pug로 하겠다
app.set("views", __dirname + "/views"); // 디렉토리 설정
app.use("/public", express.static(__dirname + "/public")); // public 폴더를 유저에게 공개 (유저가 볼 수 있는 폴더 지정)
app.get("/", (req, res) => res.render("home")); // 홈페이지로 이동할 때 사용될 템플릿을 렌더
app.get("/*", (req, res) => res.redirect("/")) // 홈페이지 내 어느 페이지에 접근해도 홈으로 연결되도록 리다이렉트 (다른 url 사용 안할거라)

const handleListen = () => console.log(`Listening on http://localhost:3000`)
// app.listen(3000, handleListen); // 3000번 포트와 연결

const httpServer = http.createServer(app); // app은 requestlistener 경로 - express application으로부터 서버 생성
const wsServer = new Server(httpServer, {
    cors: {
      origin: ["https://admin.socket.io"], // 이 URL에서 localhost:3000에 액세스할 것이기 때문에! - 온라인에서 Admin UI를 실제로 테스트할 수 있는 데모 사용을 위한 환경설정!
      credentials: true
    }
}); // localhost:3000/socket.io/socket.io.js로 연결 가능 (socketIO는 websocket의 부가기능이 아니다!!)

instrument(wsServer, {
    auth: false, // 실제 비밀번호를 쓰도록 바꿀 수 있음!
});



function publicRooms(){
    const {
        sockets: {
            adapter: {
                sids, rooms
            }
        }
    } = wsServer; // wsServer에서 sids와 rooms 가져오기
    
    // public room list 만들기
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined){
            publicRooms.push(key);
        }
    })
    return publicRooms;
}


function countRoom(roomName){ // 방에 사람이 몇명이 있는지 계산하는 함수(set의 size를 이용)
    return wsServer.sockets.adapter.rooms.get(roomName)?.size; // roomName을 찾을 수도 있지만 못찾을 수도 있기 때문에 ?를 붙여준다
}


// websocket에 비해 개선점 : 1. 어떤 이벤트든지 전달 가능 2. JS Object를 보낼 수 있음
wsServer.on("connection", socket => {
    socket["nickname"] = "Anonymous";
    socket.onAny((event) => { // 미들웨어같은 존재! 어느 이벤트에서든지 console.log를 할 수 있다!
        // console.log(wsServer.sockets.adapter); // 어댑터 동작 확인하기
        console.log(`Socket Event:${event}`)
    })

    socket.on("enter_room", (roomName, done) => {
        // console.log(socket.rooms); // 현재 들어가있는 방을 표시 (기본적으로 User와 Server 사이에 private room이 있다!)
        socket.join(roomName);
        // console.log(socket.rooms);  // 앞은 id, 뒤는 현재 들어가있는 방
        done();
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName)); // welcome 이벤트를 roomName에 있는 모든 사람들에게 emit한 것 (하나의 socket에만 메시지 전달), 들어오면 사람수가 바뀌므로 사람수 count!
        wsServer.sockets.emit("room_change", publicRooms()); // room_change 이벤트의 payload는 publicRooms 함수의 결과 (우리 서버 안에 있는 모든 방의 array = 서버의 모든 socket)
    });

    socket.on("disconnecting", () => { // 클라이언트가 서버와 연결이 끊어지기 직전에 마지막 굿바이 메시지를 보낼 수 있다!
        socket.rooms.forEach(room => socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)); // 방안에 있는 모두에게 보내기 위해 forEach 사용!, 나가면 사람수가 바뀌므로 사람수 count!
    })

    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms()); // 클라이언트가 종료메시지를 모두에게 보내고 room이 변경되었다고 모두에게 알림!
    });

    socket.on("new_message", (msg, room, done) => { // 메세지랑 done 함수를 받을 것
        socket.to(room).emit("new_message", `${socket.nickname}: ${msg}`); // new_message 이벤트를 emit한다! 방금 받은 메시지가 payload가 된다!
        done(); // done은 프론트엔드에서 코드를 실행할 것!! (백엔드에서 작업 다 끝나고!!)
    });

    socket.on("nickname", nickname => socket["nickname"] = nickname);
});


// 웹소켓 사용한 부분 주석처리!
// const wss = new WebSocket.Server({ server }); // http 서버 위에 webSocket서버 생성, 위의 http로 만든 server는 필수 X - 이렇게 하면 http / ws 서버 모두 같은 3000번 포트를 이용해서 돌릴 수 있다!

// const sockets = []; // 누군가 우리 서버에 연결하면 그 connection을 여기에 넣을 것이다!!


// // on method에서는 event가 발동되는 것을 기다린다
// // event가 connection / 뒤에 오는 함수는 event가 일어나면 작동
// // 그리고 on method는 backend에 연결된 사람의 정보를 제공 - 그게 socket에서 옴
// // 익명함수로 바꾸기
// wss.on("connection", socket => { // 여기의 socket이라는 매개변수는 새로운 브라우저를 뜻함!! (wss는 전체 서버, socket은 하나의 연결이라고 생각!!)
//     sockets.push(socket); // 파이어폭스가 연결되면 sockets 배열에 firefox를 넣어줌! (다른 브라우저도 마찬가지!)
//     socket["nickname"] = "Anonymous"; // 익명 소켓인 경우 처리 - 맨 처음 닉네임은 Anonymous
//     console.log("Connected to Browser ✅");
//     socket.on("close", () => console.log("Disconnected to Server ❌")); // 서버를 끄면 동작
//     socket.on("message", msg => {
//         const message = JSON.parse(msg);
//         // new_message일 때 모든 브라우저에 payload를 전송!
//         // if / else if로 해도 잘 돌아간다!
//         // 받아온 String 형태의 메시지(바로 출력하면 Buffer로 뜨지만..!)를 parse로 파싱한 후 구분해서 출력
//         switch(message.type){
//             case "new_message":
//                 sockets.forEach((aSocket) => aSocket.send(`${socket.nickname}: ${message.payload}`));
//             case "nickname":
//                 socket["nickname"] = message.payload; // socket은 기본적으로 객체라 새로운 아이템 추가 가능! : 닉네임을 socket 프로퍼티에 저장중!
//         }
//         // const utf8message = message.toString("utf8"); // 버퍼 형태로 전달되기 때문에 toString 메서드를 이용해서 utf8로 변환 필요!
//         // sockets.forEach(aSocket => aSocket.send(utf8message)); // 연결된 모든 소켓에 메시지를 전달!!
//         // socket.send(utf8message);
//     }); // 프론트엔드로부터 메시지가 오면 콘솔에 출력
// }) // socket을 callback으로 받는다! webSocket은 서버와 브라우저 사이의 연결!!!


httpServer.listen(3000, handleListen); // 서버는 ws, http 프로토콜 모두 이해할 수 있게 된다!

