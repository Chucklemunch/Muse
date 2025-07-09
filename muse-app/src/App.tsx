import { Routes, Route, useNavigate } from 'react-router-dom'
import { Button } from '@mui/material'
import './App.css'
import Guitar from './Guitar'

export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/guitar" element={<Guitar />} />
    </Routes>
  )
}

function Home() {
    const navigate = useNavigate()
  return (
    <>
      <div>
        <img src='public/kermit_prs_copy.png' className="kermit-prs" alt="Kermit PRS Picture" />
      </div>
      <h1>Welcome to Muse</h1>
      <Button variant='contained' onClick={() => navigate('/guitar')}>Let's Shred!</Button>
    </>
  )
}