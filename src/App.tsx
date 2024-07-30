import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import Ably, { RealtimeChannel } from 'ably'



const AppWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  height: 100%;
  width: 100%;
`

const HeadText = styled.h1`
  margin: 0;
  font-size: 16px;
`

const HeaderBar = styled.div`
  display: flex;
  
  input {
    flex: 1
  }
`

const EditorArea = styled.div`
  display: flex;
  flex: 1;
`

const Editor = styled.textarea`
  flex: 1;
`

function App() {
  const { name, setName, key, setKey, text, setText, cypherText, setCypherText, peerCount } = useSync();  

  return (
    <AppWrapper>
      <HeadText>Deplacer</HeadText>
      <HeaderBar>
        <span>
          Peers: {peerCount}
        </span>
        <input type="text" placeholder="deplacer name" value={name} onChange={e => setName(e.target.value)} />
        <input type="password" placeholder="deplacer key" value={key} onChange={e => setKey(e.target.value)}
        />
      </HeaderBar>
      <EditorArea>
      <Editor value={text} onChange={e => setText(e.target.value)} />
      <Editor value={cypherText} onChange={e => setCypherText(e.target.value)} />
      </EditorArea>
    </AppWrapper>
  )
}

const ably = new Ably.Realtime("ZEuzyg.-vg56A:1Asw56dAORRy2UmcY8J7FC48v8nBla6UrLiox3HTlqI")
ably.connection.once("connected", () => {
  console.log("Connected to Ably!")
})

const browserId = readBrowserId()
function readBrowserId() {
  const key = "deplacer-browser-id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = Math.random().toString(36).slice(2)
    localStorage.setItem(key, id)
  }
  return id
}


function useSync() {
  const [name, setName] = useState('sam')
  const [key, setKey] = useState('P@55word')
  const [text, setTextSetter] = useState('')
  const [cypherText, setCypherText] = useState('');
  const [peerCount, setPeerCount] = useState(0)
  const channelRef = useRef<RealtimeChannel>();
  const handleRef = useRef(0);
  const peersRef = useRef<Record<string, number>>({});
  const peerCheckIntervalRef = useRef(0);
  const textDebounceRef = useRef(0);
  const channelNameRef = useRef('');

  function countPeers(){
    return Object.keys(peersRef.current).filter(key => key !== browserId).length;
  }

  const setText = (text: string) => {
    setTextSetter(text);
    clearTimeout(textDebounceRef.current);
    textDebounceRef.current = window.setTimeout(async () => {
      const {encryptedBytes, iv} = await encrypt(text, key);
      
      const ivBase64 = toBase64(iv);
      const encryptedText = toBase64(encryptedBytes);

      setCypherText(encryptedText);

      const message = { browserId, ivBase64, encryptedText }
      channelRef.current?.publish("text", message);
      console.log('published:', message)
    }, 1000);
  }
  
  
  useEffect(() => {
    clearTimeout(peerCheckIntervalRef.current);
    peerCheckIntervalRef.current = window.setInterval(() => {
      channelRef.current?.publish("hello", { browserId});
      const now = Date.now();
      peersRef.current = Object.fromEntries(Object.entries(peersRef.current).filter(([,value]) => now - value < 120000));
      setPeerCount(countPeers());
    }, 60000);
    return () => {
      clearTimeout(peerCheckIntervalRef.current);
    }
  }, [])

  useEffect(() => {
    clearTimeout(handleRef.current);
    handleRef.current = window.setTimeout(async () => {
      if (!name || name.length === 0) return;

      const newChannelName = `deplacer-${name}`;

      if (newChannelName === channelNameRef.current) return;
      channelNameRef.current = newChannelName;

      setTextSetter('');
      channelRef.current = ably.channels.get(channelNameRef.current);

      await channelRef.current.subscribe("hello", (message) => {
        peersRef.current[message.data.browserId] = Date.now();
        setPeerCount(countPeers());
      });
      await channelRef.current.subscribe("text", (message) => {
        console.log(message.data);
        if (message.data.browserId === browserId) return;
        if (message.data.text){
          setTextSetter(message.data.text);
        }else if (message.data.ivBase64 && message.data.encryptedText){
          setCypherText(message.data.encryptedText);
          const iv = toBytes(message.data.ivBase64);
          const encryptedBytes = toBytes(message.data.encryptedText);
          decrypt(encryptedBytes, iv, key).then(text => setTextSetter(text));
        } else {
          setTextSetter('eh?');
        }
        
      });

      console.log(`subscribed to hello and text on ${newChannelName}`);

      await channelRef.current.publish("hello", { browserId});
    }, 1000);
   
  }, [name])

  return { name, setName, key, setKey, text, setText, cypherText, setCypherText, peerCount }
}

async function deriveKey(password: string) {
  const salt = "deplacer";
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  const aesKey =  await window.crypto.subtle.deriveKey(
    {
        "name": "PBKDF2",
        "salt": new TextEncoder().encode(salt),
        "iterations": 1000,
        "hash": "SHA-256"
    },
    baseKey,
    {"name": "AES-CBC", "length": 128}, // Key we want
    true,                               // Extrable
    ["encrypt", "decrypt"]              // For new key
    );

  return aesKey;
//  return  window.crypto.subtle.exportKey("raw", aesKey);
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function toBytes(base64: string) {
  return new Uint8Array(Array.from(atob(base64), c => c.charCodeAt(0)));
}

async function encrypt(message: string, password: string) {
  const enc = new TextEncoder();
  const encoded =  enc.encode(message);

  const key = await deriveKey(password);
  
  // counter will be needed for decryption
  const iv = window.crypto.getRandomValues(new Uint8Array(16));

  const encryptedBytes = new Uint8Array(await window.crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
      length: 64,
    },
    key,
    encoded,
  ));

  return {encryptedBytes, iv};
}

async function decrypt(encryptedBytes: Uint8Array, iv: Uint8Array, password: string) {
  const key = await deriveKey(password);
  const decrypted = new Uint8Array(await window.crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv,
      length: 64,
    },
    key,
    encryptedBytes,
  ));

  return new TextDecoder().decode(decrypted);
}

export default App
