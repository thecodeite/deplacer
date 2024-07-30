import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { IoMdRefreshCircle } from "react-icons/io";


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

const Button = styled.button`
  padding: 0 0.2em 0.1em;
  margin: 0.2em;
  font-size: 1em;
  border-radius: 0.25em;
  background-color: #3b3c2e;
  color: #ccc;
  border: 1px solid #ccc;
  cursor: pointer;
`

const IconButton = styled.button`
  margin: 0;
  padding: 4px;
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
`

function App() {
  const { list, reloadList, name, setName, key, setKey, text, setText, cypherText, setCypherText, onGet, onPut, onDel } = useSync();  

  return (
    <AppWrapper>
      <HeaderBar>
        <HeadText>Deplacer</HeadText>
        <IconButton onClick={() => reloadList()}><IoMdRefreshCircle /></IconButton>
        {list.map((name, i) => <Button key={i} onClick={() => setName(name)}>{name}</Button>)}
      </HeaderBar>
      <HeaderBar>
        <Button onClick={() => onGet() } >get</Button>
        <Button onClick={() => onPut() } >put</Button>
        <Button onClick={() => onDel() } >del</Button>
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



function useSync() {
  const [list, setList] = useState<string[]>([])
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [text, setTextSetter] = useState('')
  const [cypherText, setCypherText] = useState('');
  const payloadRef = useRef('');
  const textDebounceRef = useRef(0);

  async function onGet() {
    const r = await fetch(`/api/item?id=${name}`)
    if (r.ok) {
      const data = await r.json()
      console.log('data:', data.encryptedText)
      const decrypted = await decrypt(toBytes(data.encryptedText), toBytes(data.ivBase64), key);
      setTextSetter(decrypted)
    }
    if (!r.ok) {
      alert('Error getting');
    }
  }

  async function onPut() {
    const r = await fetch(`/api/item?id=${name}`, {
      method: 'PUT',
      body: payloadRef.current,
    })
    if (!r.ok) {
      alert('Error putting');
    }
  }

  async function onDel() {
    const r = await fetch(`/api/item?id=${name}`, {
      method: 'DELETE',
      body: text,
    })
    if (r.ok) {
      reloadList();
      setTextSetter('');
    }
  }

  async function reloadList() {
    const r = await fetch('/api/list')
    if (r.ok) {
      const data = await r.json()
      setList(data)
    }
  }


  const setText = (text: string) => {
    setTextSetter(text);
    clearTimeout(textDebounceRef.current);
    textDebounceRef.current = window.setTimeout(async () => {
      const {encryptedBytes, iv} = await encrypt(text, key);
      
      const ivBase64 = toBase64(iv);
      const encryptedText = toBase64(encryptedBytes);

      setCypherText(encryptedText);

      const message = { ivBase64, encryptedText }
      payloadRef.current = JSON.stringify(message);
 
    }, 1000);
  }


  useEffect(() => {
    reloadList()
  }, [])

  return { list, reloadList, name, setName, key, setKey, text, setText, cypherText, setCypherText, onGet, onPut, onDel }
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
  return Buffer.from(bytes).toString('base64');
}

function toBytes(base64: string) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
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
