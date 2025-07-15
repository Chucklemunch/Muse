import { Routes, Route } from 'react-router-dom';
import './App.css';
import AudioToMidiClient from './AudioToMidiClient.tsx';

export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}

function Home() {
  return (
    <>
      <div>
        <AudioToMidiClient />
        <img src='public/kermit_prs_copy.png' className="kermit-prs" alt="Kermit PRS Picture" />
      </div>
      <h1>Welcome to Muse</h1>
    </>
  )
}