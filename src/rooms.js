// The query parameter produces one shareable, static-host-friendly URL per room.
// Keep these ids stable so bookmarks and Game Master links continue working.
export const ROOMS = [
  { id:'mass-chamber', name:'01 · Mass Chamber', short:'Mass Chamber', subtitle:'The Great Sanctuary of Bahamut' },
  { id:'library', name:'02 · Hidden Library', short:'Hidden Library', subtitle:'The Library of the Last Wyrm' },
  { id:'dining-hall', name:'03 · Dining Hall', short:'Dining Hall', subtitle:'The Pilgrims’ Refectory' },
  { id:'kitchen', name:'04 · Kitchen & Pantry', short:'Kitchen & Pantry', subtitle:'The Hearth and Stores' },
  { id:'healing-ward', name:'05 · Healing Ward', short:'Healing Ward', subtitle:'Sanctuary of Mercy' },
  { id:'reliquary', name:'06 · Reliquary', short:'Reliquary', subtitle:'Treasures of the Platinum Dragon' },
  { id:'crypts', name:'07 · Crypts & Catacombs', short:'Crypts & Catacombs', subtitle:'Hall of Honoured Ancestors' },
  { id:'hotspring', name:'08 · Hot Spring', short:'Hot Spring', subtitle:'The Moonlit Onsen' },
  { id:'toilets', name:'09 · Toilets', short:'Toilets', subtitle:'Temple Washrooms' },
  { id:'training-field', name:'10 · Training Field', short:'Training Field', subtitle:'The Monks’ Practice Grounds' },
  { id:'loom-room', name:'11 · Loom Room', short:'Loom Room', subtitle:'The Temple Seamstress' },
  { id:'apple-garden', name:'12 · Apple Garden', short:'Apple Garden', subtitle:'Garden of the Seven Dwarfs' },
  { id:'store-room', name:'13 · Store Room', short:'Store Room', subtitle:'The Forgotten Supplies' },
];
export const roomURL = id => `?room=${encodeURIComponent(id)}`;
export const currentRoom = () => ROOMS.find(r => r.id === new URLSearchParams(location.search).get('room')) || ROOMS[0];
export function mountRoomNavigation(room) {
  let select = document.getElementById('room-select');
  if (!select) {
    const wrap=document.createElement('label'); wrap.className='room-picker';
    const text=document.createElement('span'); text.textContent='TEMPLE ROOM';
    select=document.createElement('select'); select.id='room-select'; select.setAttribute('aria-label','Navigate to temple room');
    wrap.append(text,select); document.querySelector('.topbar-right').prepend(wrap);
  }
  for (const r of ROOMS) {const option=new Option(r.name,r.id);select.add(option);}
  select.value=room.id;
  select.addEventListener('change',()=>{ location.href=roomURL(select.value); });
  return select;
}
