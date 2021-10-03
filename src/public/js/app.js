// app.js

const socket = io(); // io function은 알아서 socket.io를 실행하고 있는 서버를 찾을 것이다!

// 방을 만들것!! (socket IO에는 이미 방기능이 있다!)

const welcome = document.getElementById("welcome");
const form = welcome.querySelector("form");
const room = document.getElementById("room");

room.hidden = true; // 처음에는 방안에서 할 수 있는 것들 안보이게!

let roomName;

function addMessage(message){
    const ul = room.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#msg input");
    const value = input.value;
    socket.emit("new_message", input.value, roomName, () => {
        addMessage(`You: ${value}`);
    }); // 백엔드로 new_message 이벤트를 날림, (input.value이랑 방이름도 같이 보냄!), 마지막 요소는 백엔드에서 시작시킬 수 있는 함수!
    input.value = "";
}

function handleNicknameSubmit(event){
    event.preventDefault();
    const input = room.querySelector("#name input");
    socket.emit("nickname", input.value);
}


function showRoom() { // 방에 들어가면 방 내용이 보이게
    welcome.hidden = true;
    room.hidden = false; 
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName}` // 저장된 방 이름을 pug의 요소에 전달해서 띄움! 
    const msgForm = room.querySelector("#msg");
    const nameForm = room.querySelector("#name");
    msgForm.addEventListener("submit", handleMessageSubmit);
    nameForm.addEventListener("submit", handleNicknameSubmit);
}

function handleRoomSubmit(event){
    event.preventDefault();
    const input = form.querySelector("input");
    // argument 보내기 가능 (socketIO는 Object 전달가능)
    // 첫 번째는 이벤트명(아무거나 상관없음), 두 번째는 front-end에서 전송하는 object(보내고 싶은 payload), 세 번째는 서버에서 호출하는 function
    socket.emit( // emit의 마지막 요소가 function이면 가능
        "enter_room",
        input.value,
        showRoom // 백엔드에서 끝났다는 사실을 알리기 위해 function을 넣고 싶다면 맨 마지막에 넣자!
    ); // 1. socketIO를 이용하면 모든 것이 메세지일 필요가 없다! / 2. client는 어떠한 이벤트든 모두 emit 가능 / 아무거나 전송할 수 있다(text가 아니어도 되고 여러개 전송 가능!)
    roomName = input.value; // roomName에 입력한 방 이름 저장
    input.value = "";
}

// 서버는 back-end에서 function을 호출하지만 function은 front-end에서 실행됨!!

form.addEventListener("submit", handleRoomSubmit);

socket.on("welcome", (user, newCount) => {
    const h3 = room.querySelector("h3"); // 지금은 showRoom 함수에서 copy&paste 했지만, title을 새로고침해주는 함수를 만들어줘도 좋다!
    h3.innerText = `Room ${roomName} (${newCount})` // 저장된 방 이름을 pug의 요소에 전달해서 띄움! 
    addMessage(`${user} arrived!`);
})

socket.on("bye", (left, newCount) => {
    const h3 = room.querySelector("h3");
    h3.innerText = `Room ${roomName} (${newCount})` // 저장된 방 이름을 pug의 요소에 전달해서 띄움! 
    addMessage(`${left} left ㅠㅠ`);
})

socket.on("new_message", addMessage); // addMessage만 써도 알아서 msg를 매개변수로 넣는다!

socket.on("room_change", (rooms) => {
    const roomList = welcome.querySelector("ul"); // home.pug에 만든 ul을 가져와서
    roomList.innerHTML = ""; // roomList의 HTML을 초기화
    
    rooms.forEach(room => { // rooms 데이터로 받아온 자료들을 li에 하나씩 뿌려준 후 roomsList에 넣어서 출력시킨다
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    })
}); // 이 작업은 socket.on("room_change", (msg) => console.log(msg));와 같다!