import { Routes, Route } from 'react-router-dom';
import './App.css';
import Muse from './Muse.tsx';

function Home() {
  return (
    <>
      <div>
        <h1>Welcome to Muse</h1>

        <img src='public/kermit_prs_copy.png' className="kermit-prs" alt="Kermit PRS Picture" />
        <Muse />
      </div>
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