import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./page/Home";
import Login from "./page/Login";
import SignUp from "./page/SignUp";

function App() {
  return (
    <Router>
      <Routes>
  <Route path="/" element={<Login />} />
  <Route path="/signup" element={<SignUp />} />
  <Route path="/home" element={<Home />} />
      </Routes>
    </Router>
  );
}

export default App;
