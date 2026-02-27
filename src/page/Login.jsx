import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { API_BASE_URL, getApiHeaders } from "../network";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setEmailError("");
    setPasswordError("");

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: getApiHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        console.log("Utilisateur authentifié :", data.user);
        localStorage.setItem("userData", JSON.stringify(data.user)); 
        navigate("/home");
      } else {
        if (data.message === "Utilisateur introuvable") {
          setEmailError(data.message);
        } else if (data.message === "Mot de passe incorrect") {
          setPasswordError(data.message);
        } else {
          alert(data.message);
        }
      }
    } catch (err) {
      console.error("Erreur serveur :", err);
      alert("Impossible de contacter le serveur");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Facebook
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email ou téléphone"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {emailError && <p className="text-red-500 text-sm">{emailError}</p>}
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
          >
            Se connecter
          </button>
        </form>
        <div className="text-center mt-4 text-sm">
          <a href="#" className="text-blue-600 hover:underline">
            Mot de passe oublié ?
          </a>
        </div>
        <div className="text-center mt-4">
         
        <Link
          to="/signup"
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition inline-block text-center"
        >
          Créer un compte
        </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
