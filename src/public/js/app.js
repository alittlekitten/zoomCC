import { createWebSocketStream } from "ws";

const socket = io(); // io function은 알아서 socket.io를 실행하고 있는 서버를 찾을 것이다!

// 방을 만들것!! (socket IO에는 이미 방기능이 있다!)

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");

function handleRoomSubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    //- argument 보내기 가능 (socketIO는 Object 전달가능)
    // 첫 번째는 이벤트명(아무거나 상관없음), 두 번째는 front-end에서 전송하는 object(보내고 싶은 payload), 세 번째는 서버에서 호출하는 function
    socket.emit("enter_room", {payload: input.value}, () =>{
        console.log("server is done")
    })
    input.value = "";
}

form.addEventListener("submit", handleRoomSubmit);