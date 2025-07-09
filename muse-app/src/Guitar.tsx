import { Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import GuitarFretboard from './GuitarFretboard'

export default function Guitar() {
    const navigate = useNavigate()


  return (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',     // horizontally center children
            gap: '1.5rem',            // vertical spacing between fretboard and button
        }}
    >

        <h2>This is the Guitar Page 🎸</h2>
        <GuitarFretboard />
        <Button variant='contained' onClick={() => navigate('/')}>
            Home
        </Button>
    </div>
  )
}