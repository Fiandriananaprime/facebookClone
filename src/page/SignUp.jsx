import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, getApiHeaders } from "../network";

function SignUp() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [errors, setErrors] = useState({});

  const handleSignUp = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!firstName) newErrors.firstName = "Prénom requis";
    if (!lastName) newErrors.lastName = "Nom requis";
    if (!email) newErrors.email = "Email requis";
    if (!password) newErrors.password = "Mot de passe requis";
    if (!birthDate) newErrors.birthDate = "Date de naissance requise";
    if (!gender) newErrors.gender = "Genre requis";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        const res = await fetch(`${API_BASE_URL}/signup`, {
          method: "POST",
          headers: getApiHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
          body: JSON.stringify({ firstName, lastName, email, password, birthDate, gender }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "Erreur serveur");
          alert(errText || `HTTP ${res.status}`);
          return;
        }

        const data = await res.json();

        if (data.message === "Compte créé avec succès") {
          console.log("Inscription réussie !");
          navigate("/home"); // redirection vers Home après signup
        } else {
          alert(data.message);
        }
      } catch (err) {
        console.error("Erreur serveur :", err);
        alert("Impossible de contacter le serveur");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg">
        <h1 className="text-3xl font-bold text-center text-blue-700 mb-6">
          Créer un compte
        </h1>
        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.firstName && <p className="text-red-500 text-sm">{errors.firstName}</p>}
            </div>
            <div className="flex-1">
              <input
                type="text"
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.lastName && <p className="text-red-500 text-sm">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
          </div>

          <div>
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold">Date de naissance</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full p-3 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.birthDate && <p className="text-red-500 text-sm">{errors.birthDate}</p>}
          </div>

          <div>
            <label className="text-sm font-semibold">Genre</label>
            <div className="flex gap-4 mt-1">
              {["Homme", "Femme", "Personnalisé"].map((g) => (
                <label key={g} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={gender === g}
                    onChange={(e) => setGender(e.target.value)}
                  />
                  {g}
                </label>
              ))}
            </div>
            {errors.gender && <p className="text-red-500 text-sm">{errors.gender}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 transition mt-4"
          >
            S’inscrire
          </button>
        </form>
      </div>
    </div>
  );
}

export default SignUp;
