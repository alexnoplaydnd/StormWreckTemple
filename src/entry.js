import './style.css';
import './temple.css';
import { currentRoom, mountRoomNavigation } from './rooms.js';
const room=currentRoom();
mountRoomNavigation(room);
if (room.id==='library') import('./main.js');
else import('./temple.js').then(({startTempleRoom})=>startTempleRoom(room));
