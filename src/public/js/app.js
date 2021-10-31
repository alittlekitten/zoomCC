// app.js

const socket = io(); // io function은 알아서 socket.io를 실행하고 있는 서버를 찾을 것이다!

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");


const call = document.getElementById("call");

call.hidden = true;


// stream받기 : stream은 비디오와 오디오가 결합된 것
let myStream;

let muted = false; // 처음에는 음성을 받음
let cameraOff = false; // 처음에는 영상을 받음
let roomName;
let myPeerConnection; // 누군가 getMedia함수를 불렀을 때와 똑같이 stream을 공유하기 위한 변수
let myDataChannel;

async function getCameras(){
    try {
        const devices = await navigator.mediaDevices.enumerateDevices(); // 장치 리스트 가져오기
        const cameras = devices.filter(device => device.kind === "videoinput"); // 비디오인풋만 가져오기
        const currentCamera = myStream.getVideoTracks()[0]; // 비디오 트랙의 첫 번째 track 가져오기 : 이게 cameras에 있는 label과 같다면 그 label은 선택된 것이다!

        cameras.forEach(camera => {
            const option = document.createElement("option"); // 새로운 옵션 생성
            option.value = camera.deviceId; // 카메라의 고유 값을 value에 넣기
            option.innerText = camera.label; // 사용자가 선택할 때는 label을 보고 선택할 수 있게 만들기
            if(currentCamera.label === camera.label) { // 현재 선택된 카메라 체크하기
                option.selected = true;
            }
            camerasSelect.appendChild(option); // 카메라의 정보들을 option항목에 넣어주기
        })
    } catch (e) {
        console.log(e);
    }
}

// https://developer.mozilla.org/ko/docs/Web/API/MediaDevices/getUserMedia 사용 : 유저의 유저미디어 string을 받기위함
async function getMedia(deviceId){
    const initialConstraints = { // initialConstraints는 deviceId가 없을 때 실행
        audio: true,
        video: {facingMode: "user"}, // 카메라가 전후면에 달려있을 경우 전면 카메라의 정보를 받음 (후면의 경우 "environment")
    };
    const cameraConstraints = { // CameraConstraints는 deviceId가 있을 때 실행
        audio: true,
        video: {deviceId: {exact: deviceId}}, // exact를 쓰면 받아온 deviceId가 아니면 출력하지 않는다
    };

    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initialConstraints
        )
        myFace.srcObject = myStream;
        if (!deviceId) { // 처음 딱 1번만 실행! 우리가 맨 처음 getMedia를 할 때만 실행됨!!
            await getCameras();
        }
        
        
    } catch (e) {
        console.log(e);
    }
}

function handleMuteClick() {
    myStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    if(!muted) {
        muteBtn.innerText = "Unmute";
        muted = true;
    }
    else {
        muteBtn.innerText = "Mute";
        muted = false;
    }
}

function handleCameraClick() {
    myStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    if(cameraOff) {
        cameraBtn.innerText = "Turn Camera Off";
        cameraOff = false;
    }
    else {
        cameraBtn.innerText = "Turn Camera On";
        cameraOff = true;
    }
}

async function handleCameraChange() {
    await getMedia(camerasSelect.value); // video device의 새로운 id로 또 다른 stream을 생성
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
            .getSenders()
            .find(sender => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);

// 카메라 변경 확인
camerasSelect.addEventListener("input", handleCameraChange);



// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall(){
    welcome.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleWelcomeSubmit(event){
    event.preventDefault();
    const input = welcomeForm.querySelector("input");
    await initCall();
    socket.emit("join_room", input.value, ); // 서버로 input value를 보내는 과정!! initCall 함수도 같이 보내준다!
    roomName = input.value; // 방에 참가했을 때 나중에 쓸 수 있도록 방 이름을 변수에 저장
    input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);


// Socket Code

socket.on("welcome", async () => {
    myDataChannel = myPeerConnection.createDataChannel("chat"); // offer를 만드는 peer가 DataChannel을 만드는 주체
    myDataChannel.addEventListener("message", event => console.log(event.data)); // 메세지를 받는 곳
    console.log("made data channel");
    const offer = await myPeerConnection.createOffer(); // 다른 사용자를 초대하기 위한 초대장!! (내가 누구인지를 알려주는 내용이 들어있음!)
    myPeerConnection.setLocalDescription(offer); // myPeerConnection에 내 초대장의 위치 정보를 연결해 주는 과정 https://developer.mozilla.org/ko/docs/Web/API/RTCPeerConnection/setLocalDescription
    console.log("sent the offer");
    socket.emit("offer", offer, roomName);
})

socket.on("offer", async (offer) => {
    myPeerConnection.addEventListener("datachannel", event => { // offer를 받는 쪽에서는 새로운 DataChannel이 있을 때 eventListener를 추가한다
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", event => console.log(event.data)); // 메세지를 받는 곳
    });
    console.log("received the offer");
    myPeerConnection.setRemoteDescription(offer); // 다른 브라우저의 위치를 myPeerConnection에 연결해 주는 과정
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer); // 현재 브라우저에서 생성한 answer를 현재 브라우저의 myPeerConnection의 LocalDescription으로 등록!!
    socket.emit("answer", answer, roomName);
    console.log("sent the answer");
})

socket.on("answer", answer => {
    console.log("received the answer");
    myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", ice => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
})

// RTC code

function makeConnection() {
    myPeerConnection = new RTCPeerConnection({ // 구글의 STUN 서버를 빌려서 사용!! 테스트용도로만 쓸 것!!
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ]
            },
        ],
    }); // peerConnection을 각각의 브라우저에 생성 https://developer.mozilla.org/ko/docs/Web/API/RTCPeerConnection 참조
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream)); // 영상과 음성 트랙을 myPeerConnection에 추가해줌 -> Peer-to-Peer 연결!!
}

function handleIce(data){
    console.log("sent candidate");
    socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data){
    const peersFace = document.getElementById("peersFace");
    peersFace.srcObject = data.stream;
}









/* 채팅부분 주석처리

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

*/