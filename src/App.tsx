import { useEffect, useState } from 'react'
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
  const { list, reloadList, name, setName, key, setKey, text, setText, onGet, onPut, onDel } = useSync();  

  return (
    <AppWrapper>
      <HeaderBar>
        <HeadText>Deplacer v1.0</HeadText>
        <IconButton onClick={() => reloadList()}><IoMdRefreshCircle /></IconButton>
        {list.map((name, i) => <Button key={i} onClick={() => setName(name)}>{name}</Button>)}
      </HeaderBar>
      <HeaderBar>
        <Button onClick={() => onGet() } >get</Button>
        <Button onClick={() => onPut() } >put</Button>
        <Button onClick={() => onDel() } >del</Button>
        <input type="text" placeholder="deplacer key" value={name} onChange={e => setName(e.target.value)} />
        <input type="password" placeholder="deplacer key" value={key} onChange={e => setKey(e.target.value)}
        data-1p-ignore
        />
      </HeaderBar>
      {/* <EditorArea> */}
      <Editor value={text} onChange={e => setText(e.target.value)} />
      {/* <Editor value={cypherText} onChange={e => setCypherText(e.target.value)} /> */}
      {/* </EditorArea> */}
    </AppWrapper>
  )
}



function useSync() {
  const [list, setList] = useState<string[]>([])
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [text, setText] = useState('')

  const effectiveKey = key || name;

  async function onGet() {
    const r = await fetch(`/api/item?id=${name}`)
    if (r.ok) {
      const data = await r.json()
      console.log('data:', data.encryptedText)
      const decrypted = await decrypt(toBytes(data.encryptedText), toBytes(data.ivBase64), effectiveKey);
      setText(decrypted)
    }
    if (!r.ok) {
      alert('Error getting');
    }
  }

  async function onPut() {
    const payload = await doEncrypt();
    const r = await fetch(`/api/item?id=${name}`, {
      method: 'PUT',
      body: payload,
    })
    if (!r.ok) {
      alert('Error putting');
    } else {
      reloadList();
    }
  }

  async function onDel() {
    const r = await fetch(`/api/item?id=${name}&action=delete`, {
      method: 'POST',
    })
    if (r.ok) {
      reloadList();
      setText('');
      setName('');
      setKey('');
    }
  }

  async function reloadList() {
    const r = await fetch('/api/list')
    if (r.ok) {
      const data = await r.json()
      setList(data)
    }
  }

  const doEncrypt = async () => {
    const {encryptedBytes, iv} = await encrypt(text, effectiveKey);
    
    const ivBase64 = toBase64(iv);
    const encryptedText = toBase64(encryptedBytes);

    const message = { ivBase64, encryptedText }
    return  JSON.stringify(message);
  }


  useEffect(() => {
    reloadList()
  }, [])

  return { list, reloadList, name, setName, key, setKey, text, setText, onGet, onPut, onDel }
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
    {"name": "AES-CBC", "length": 128}, 
    true,                               
    ["encrypt", "decrypt"]              
    );

  return aesKey;
//  return  window.crypto.subtle.exportKey("raw", aesKey);
}

function toBase64(bytes: Uint8Array) {
  return window.btoa(String.fromCharCode(...bytes));
}

function toBytes(base64: string) {
  return new Uint8Array(Array.from(window.atob(base64), c => c.charCodeAt(0)));
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
  try {
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
  } catch (e) {
    return "failed to decrypt"
  }
}

export default App
