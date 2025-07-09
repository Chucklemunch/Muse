import { noteCoords } from '../utilities/NoteCoords'


export default function GuitarFretboard() {


  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <img src='public/prs-neck.png' style={{
          width: '100%',
        }}
      />
      {Object.entries(noteCoords).map(([stringName, frets]) =>
        Object.entries(frets).map(([fretNum, { x, y }]) => (
          <button
            key={`${stringName}-${fretNum}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'white',
              border: '1px solid #222',
              fontSize: '10px',
              color: 'white',
              cursor: 'pointer',
            }}
            title={`${stringName} fret ${fretNum}`}
          />
        ))
      )}
    </div>
  )
}