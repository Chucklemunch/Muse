import { Routes, Route } from 'react-router-dom';
import './App.css';
import useAudioToMidiClient from './useAudioToMidiClient.tsx';

function Home() {
  return (
    <>
      <div>
        <img src='public/kermit_prs_copy.png' className="kermit-prs" alt="Kermit PRS Picture" />
        {/* <Muse /> */}
      </div>
      <h1>Welcome to Muse</h1>
    </>
  )
}

export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}