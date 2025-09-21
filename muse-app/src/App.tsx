import { Routes, Route } from 'react-router-dom';
import './App.css';
import Muse from './Muse.tsx';
import { Box, Typography, Container, Button } from "@mui/material";

// function Home() {
//   return (
//     <>
//       <div>
//         <h1>Welcome to Muse</h1>

//         <img src='public/kermit_prs_copy.png' className="kermit-prs" alt="Kermit PRS Picture" />
//         <Muse />
//       </div>
//     </>
//   )
// }

function Home() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "#f5f5f5",
        textAlign: "center",
        gap: 4
      }}
    >
      <Typography variant="h2" component="h1" gutterBottom>
        Welcome to Muse
      </Typography>

      <Box
        component="img"
        src="/kermit_prs_copy.png"
        alt="Kermit PRS Picture"
          sx={{
            width: 300,
            borderRadius: 2,
            boxShadow: 3,
            transition: "transform 0.4s ease, filter 0.4s ease",
              "&:hover": {
                transform: "scale(1.1) rotate(-5deg)",
                filter: "brightness(1.1) saturate(1.2)",
                boxShadow: "0 0 30px 10px rgba(0, 255, 0, 0.7)"
              }
          }}
      />

      <Typography variant="h5" sx={{ maxWidth: 600 }}>
        Combining Computation and Creativity
      </Typography>

      <Button variant="contained" color="primary" href="#app" sx={{ mt: 2 }}>
        Get Started
      </Button>

      <Container id="app" sx={{ mt: 2 }}>
        <Muse />
      </Container>
    </Box>
  );
}


export default function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  )
}