// useNavigateTo.js
import { useNavigate } from "react-router-dom";

function useNavigateTo() {
  const navigate = useNavigate();
  const goToPath = (path) => {
    navigate(path);
  };
  return goToPath;
}

export default useNavigateTo;